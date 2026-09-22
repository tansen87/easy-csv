use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, BufWriter, Cursor, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::xan::find_xan_executable;

/// Result of reading a CSV file for preview.
///
/// `delimiter` / `delimiter_source` / `delimiter_confidence` describe the
/// delimiter that was actually used, so the UI can show what was picked and the
/// pipeline can run with the very same value ("what you see is what runs").
#[derive(Debug, Serialize, Deserialize)]
pub struct CsvData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
  /// Delimiter the file was parsed with (single byte).
  pub delimiter: String,
  /// [`PROBE_SOURCE_DETECTED`], [`PROBE_SOURCE_FORCED`] or [`PROBE_SOURCE_FALLBACK`].
  pub delimiter_source: String,
  /// `"high"` | `"low"` | `"none"` (always `"high"` when forced).
  pub delimiter_confidence: String,
  /// Field count of the header row.
  pub columns: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvDiffEntry {
  pub status: String,
  pub left_line: Option<usize>,
  pub right_line: Option<usize>,
  pub left_cells: Option<Vec<String>>,
  pub right_cells: Option<Vec<String>>,
  pub changed_cols: Vec<usize>,
  pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvDiffResult {
  pub headers_left: Vec<String>,
  pub headers_right: Vec<String>,
  pub key_cols: Vec<usize>,
  pub entries: Vec<CsvDiffEntry>,
  pub equal_count: usize,
  pub added_count: usize,
  pub removed_count: usize,
  pub modified_count: usize,
}

/// Resolve which delimiter a file should be read with, and how that choice was
/// made. `delimiter = Some(_)` forces the value and skips detection entirely;
/// otherwise the head of the file is sampled (64 KiB, see [`read_head_sample`])
/// and scored by [`detect_delimiter_with_fallback`]. When detection is
/// inconclusive the caller-supplied fallback (default `,`) is used.
fn resolve_read_delimiter(
  file_path: &str,
  delimiter: Option<&str>,
  fallback_delimiter: Option<&str>,
) -> Result<(u8, &'static str, &'static str), String> {
  let forced = delimiter
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.as_bytes()[0]);
  if let Some(d) = forced {
    return Ok((d, PROBE_SOURCE_FORCED, "high"));
  }

  let fallback = fallback_delimiter
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.as_bytes()[0])
    .unwrap_or(b',');

  let (sample, _truncated) = read_head_sample(file_path)?;
  if sample.is_empty() {
    // Nothing to detect from: let the reader below report the real problem.
    return Ok((fallback, PROBE_SOURCE_FALLBACK, "none"));
  }

  let (best, _candidates, confidence, _quoting_used) =
    detect_delimiter_with_fallback(&sample, true, 0);
  match best {
    Some(d) => Ok((d, PROBE_SOURCE_DETECTED, confidence)),
    None => Ok((fallback, PROBE_SOURCE_FALLBACK, "none")),
  }
}

/// Synchronous body of [`read_csv_file`], kept separate so the delimiter
/// resolution logic can be unit tested without an async runtime.
fn read_csv_sync(
  file_path: &str,
  delimiter: Option<&str>,
  fallback_delimiter: Option<&str>,
  limit: Option<usize>,
) -> Result<CsvData, String> {
  let (delimiter, source, confidence) =
    resolve_read_delimiter(file_path, delimiter, fallback_delimiter)?;

  let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;

  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(delimiter)
    .from_reader(BufReader::new(file));

  let headers: Vec<String> = rdr
    .headers()
    .map_err(|e| format!("Failed to read headers: {}", e))?
    .iter()
    .map(|s| s.to_string())
    .collect();

  let row_limit = limit.unwrap_or(51);
  let mut rows = Vec::new();
  for result in rdr.records() {
    if rows.len() >= row_limit {
      break;
    }
    let record = result.map_err(|e| format!("Failed to read row: {}", e))?;
    rows.push(record.iter().map(|s| s.to_string()).collect());
  }

  let columns = headers.len();
  Ok(CsvData {
    headers,
    rows,
    delimiter: (delimiter as char).to_string(),
    delimiter_source: source.to_string(),
    delimiter_confidence: confidence.to_string(),
    columns,
  })
}

/// Read a CSV file for preview, resolving the delimiter on the way.
///
/// `delimiter = None` (or an empty string) turns auto-detection on: only the
/// first 64 KiB are sampled, so this stays fast on huge files. When detection is
/// inconclusive the delimiter falls back to `fallback_delimiter` (default `,`)
/// and `delimiter_confidence` is `"none"`. The resolved delimiter is returned so
/// the caller can display it and run the pipeline with the same value.
#[tauri::command]
pub async fn read_csv_file(
  file_path: String,
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  limit: Option<usize>,
) -> Result<CsvData, String> {
  tokio::task::spawn_blocking(move || {
    read_csv_sync(
      &file_path,
      delimiter.as_deref(),
      fallback_delimiter.as_deref(),
      limit,
    )
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

/// Interner for cell strings: each unique string maps to a stable u32 id and
/// the original value can be recovered via `value`. The empty string always
/// has id 0, which serves as the "missing cell" value.
struct Interner {
  map: HashMap<String, u32>,
  strings: Vec<String>,
}

impl Interner {
  fn new() -> Self {
    let mut this = Self {
      map: HashMap::new(),
      strings: Vec::new(),
    };
    this.intern("");
    this
  }

  fn intern(&mut self, s: &str) -> u32 {
    if let Some(&id) = self.map.get(s) {
      return id;
    }
    let id = self.strings.len() as u32;
    self.strings.push(s.to_string());
    self.map.insert(s.to_string(), id);
    id
  }

  fn value(&self, id: u32) -> &str {
    &self.strings[id as usize]
  }
}

/// Flat, interned CSV table. All cells live in one contiguous `Vec<u32>` of
/// interned ids; `row_off[i]..row_off[i+1]` is row i. This avoids the
/// per-cell `String` + `Vec` allocation overhead of `Vec<Vec<String>>`.
///
/// Both files being diffed must share the same `Interner` so that equal strings
/// get equal ids across tables.
struct Table<'a> {
  headers: Vec<String>,
  interner: &'a Interner,
  cells: Vec<u32>,
  row_off: Vec<usize>,
}

impl<'a> Table<'a> {
  fn row(&self, i: usize) -> &[u32] {
    &self.cells[self.row_off[i]..self.row_off[i + 1]]
  }

  fn cell_id(&self, i: usize, c: usize) -> u32 {
    self.row(i).get(c).copied().unwrap_or(0)
  }

  fn cell(&self, i: usize, c: usize) -> &str {
    self.interner.value(self.cell_id(i, c))
  }

  fn len(&self) -> usize {
    self.row_off.len() - 1
  }
}

/// Read a CSV file and intern its cells into `pool`, returning headers, the
/// flat cell id array and row offsets. Call twice (once per file) with the same
/// `pool` so ids are comparable across the two tables.
fn read_table_parts(
  pool: &mut Interner,
  file_path: &str,
  delimiter: &str,
) -> Result<(Vec<String>, Vec<u32>, Vec<usize>), String> {
  let file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;

  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(delimiter.as_bytes()[0])
    .from_reader(BufReader::new(file));

  let headers = rdr
    .headers()
    .map_err(|e| format!("Failed to read headers: {}", e))?
    .iter()
    .map(|s| s.to_string())
    .collect();

  let mut cells = Vec::new();
  let mut row_off = vec![0usize];

  for result in rdr.records() {
    let record = result.map_err(|e| format!("Failed to read row: {}", e))?;
    for field in record.iter() {
      cells.push(pool.intern(field));
    }
    row_off.push(cells.len());
  }

  Ok((headers, cells, row_off))
}

/// Collect the values of `shown` columns for one row into owned strings.
fn build_projected_cells(table: &Table, row_idx: usize, shown: &[usize]) -> Vec<String> {
  shown
    .iter()
    .map(|&c| table.cell(row_idx, c).to_string())
    .collect()
}

/// Values of every column present in `row_idx` (used for added/removed rows).
fn full_row_cells(table: &Table, row_idx: usize) -> Vec<String> {
  (0..table.row(row_idx).len())
    .map(|c| table.cell(row_idx, c).to_string())
    .collect()
}

/// Columns that must be sent for a modified row: key columns plus every
/// changed column, deduplicated and sorted.
fn shown_columns(key_cols: &[usize], changed_cols: &[usize]) -> Vec<usize> {
  let mut shown: Vec<usize> = key_cols.to_vec();
  shown.extend(changed_cols.iter().copied());
  shown.sort_unstable();
  shown.dedup();
  shown
}

#[tauri::command]
pub async fn diff_csv_files(
  file_a: String,
  file_b: String,
  delimiter_a: String,
  delimiter_b: String,
  key_columns: Option<Vec<usize>>,
) -> Result<CsvDiffResult, String> {
  // The diff is CPU-bound (parsing + matching); run it on the blocking pool so
  // the async runtime / other IPC commands stay responsive.
  tokio::task::spawn_blocking(move || -> Result<CsvDiffResult, String> {
    // One shared interner so equal strings map to equal ids in both tables.
    let mut pool = Interner::new();
    let (headers_a, cells_a, row_off_a) = read_table_parts(&mut pool, &file_a, &delimiter_a)?;
    let (headers_b, cells_b, row_off_b) = read_table_parts(&mut pool, &file_b, &delimiter_b)?;

    let table_a = Table {
      headers: headers_a,
      interner: &pool,
      cells: cells_a,
      row_off: row_off_a,
    };
    let table_b = Table {
      headers: headers_b,
      interner: &pool,
      cells: cells_b,
      row_off: row_off_b,
    };

    if let Some(keys) = &key_columns {
      if let Some(&max) = keys.iter().max() {
        if max >= table_a.headers.len() {
          return Err(format!(
            "Key column index {max} out of range for file A ({} columns)",
            table_a.headers.len()
          ));
        }
      }
    }

    let mut entries: Vec<CsvDiffEntry> = Vec::new();
    let mut added_count = 0usize;
    let mut removed_count = 0usize;
    let mut modified_count = 0usize;

    let key_cols = key_columns.clone().unwrap_or_default();

    match key_columns {
      Some(cols) => {
        diff_by_key(
          &mut entries,
          &table_a,
          &table_b,
          &cols,
          &mut added_count,
          &mut removed_count,
          &mut modified_count,
        );
      }
      None => {
        diff_positional(
          &mut entries,
          &table_a,
          &table_b,
          &mut added_count,
          &mut removed_count,
          &mut modified_count,
        );
      }
    }

    let equal_count = entries
      .iter()
      .filter(|e| e.status == "equal")
      .map(|e| e.count)
      .sum();

    Ok(CsvDiffResult {
      headers_left: table_a.headers,
      headers_right: table_b.headers,
      key_cols,
      entries,
      equal_count,
      added_count,
      removed_count,
      modified_count,
    })
  })
  .await
  .map_err(|e| format!("Task join error: {}", e))?
}

/// Append an "equal" run covering `count` rows starting at 0-based
/// `(left_line0, right_line0)`. Contiguous runs are merged into a single entry
/// so that long identical stretches only occupy one row in the result.
fn push_equal(
  entries: &mut Vec<CsvDiffEntry>,
  left_line0: usize,
  right_line0: usize,
  count: usize,
) {
  if count == 0 {
    return;
  }
  if let Some(last) = entries.last_mut() {
    if last.status == "equal"
      && last.left_line.map(|l| l + last.count - 1) == Some(left_line0)
      && last.right_line.map(|r| r + last.count - 1) == Some(right_line0)
    {
      last.count += count;
      return;
    }
  }
  entries.push(CsvDiffEntry {
    status: "equal".to_string(),
    left_line: Some(left_line0 + 1),
    right_line: Some(right_line0 + 1),
    left_cells: None,
    right_cells: None,
    changed_cols: Vec::new(),
    count,
  });
}

/// Positional diff using the `similar` crate's Myers algorithm on interned row
/// ids. Myers is O(ND) instead of O(n*m), so it scales to large files without
/// a DP-matrix cap. Consecutive equal rows are emitted as a single run.
fn diff_positional(
  entries: &mut Vec<CsvDiffEntry>,
  table_a: &Table,
  table_b: &Table,
  added_count: &mut usize,
  removed_count: &mut usize,
  modified_count: &mut usize,
) {
  let rows_a: Vec<&[u32]> = (0..table_a.len()).map(|i| table_a.row(i)).collect();
  let rows_b: Vec<&[u32]> = (0..table_b.len()).map(|i| table_b.row(i)).collect();

  let ops = similar::capture_diff_slices(similar::Algorithm::Myers, &rows_a, &rows_b);

  for op in ops {
    match op {
      similar::DiffOp::Equal {
        old_index,
        new_index,
        len,
      } => {
        push_equal(entries, old_index, new_index, len);
      }
      similar::DiffOp::Delete {
        old_index, old_len, ..
      } => {
        let removed_block: Vec<usize> = (old_index..old_index + old_len).collect();
        emit_change_block(
          entries,
          table_a,
          table_b,
          &[],
          &removed_block,
          &[],
          added_count,
          removed_count,
          modified_count,
        );
      }
      similar::DiffOp::Insert {
        new_index, new_len, ..
      } => {
        let added_block: Vec<usize> = (new_index..new_index + new_len).collect();
        emit_change_block(
          entries,
          table_a,
          table_b,
          &[],
          &[],
          &added_block,
          added_count,
          removed_count,
          modified_count,
        );
      }
      similar::DiffOp::Replace {
        old_index,
        old_len,
        new_index,
        new_len,
      } => {
        let removed_block: Vec<usize> = (old_index..old_index + old_len).collect();
        let added_block: Vec<usize> = (new_index..new_index + new_len).collect();
        emit_change_block(
          entries,
          table_a,
          table_b,
          &[],
          &removed_block,
          &added_block,
          added_count,
          removed_count,
          modified_count,
        );
      }
    }
  }
}

/// Key-based hash join: rows sharing the same key column values are paired and
/// compared field-by-field. Rows present in only one file are removed/added.
/// This is O(n + m) and avoids the O(n*m) LCS matrix on large files.
fn diff_by_key(
  entries: &mut Vec<CsvDiffEntry>,
  table_a: &Table,
  table_b: &Table,
  key_cols: &[usize],
  added_count: &mut usize,
  removed_count: &mut usize,
  modified_count: &mut usize,
) {
  use std::collections::VecDeque;

  fn cell_key(table: &Table, row_idx: usize, cols: &[usize]) -> Vec<u32> {
    cols.iter().map(|&c| table.cell_id(row_idx, c)).collect()
  }

  let mut index: HashMap<Vec<u32>, VecDeque<usize>> = HashMap::new();
  for j in 0..table_b.len() {
    index
      .entry(cell_key(table_b, j, key_cols))
      .or_default()
      .push_back(j);
  }

  let mut matched_b = vec![false; table_b.len()];

  for i in 0..table_a.len() {
    let key = cell_key(table_a, i, key_cols);
    if let Some(bucket) = index.get_mut(&key) {
      if let Some(j) = bucket.pop_front() {
        matched_b[j] = true;

        let max_cols = table_a.row(i).len().max(table_b.row(j).len());
        let mut changed_cols = Vec::new();
        for c in 0..max_cols {
          if table_a.cell_id(i, c) != table_b.cell_id(j, c) {
            changed_cols.push(c);
          }
        }

        if changed_cols.is_empty() {
          push_equal(entries, i, j, 1);
        } else {
          let shown = shown_columns(key_cols, &changed_cols);
          entries.push(CsvDiffEntry {
            status: "modified".to_string(),
            left_line: Some(i + 1),
            right_line: Some(j + 1),
            left_cells: Some(build_projected_cells(table_a, i, &shown)),
            right_cells: Some(build_projected_cells(table_b, j, &shown)),
            changed_cols,
            count: 1,
          });
          *modified_count += 1;
        }
        continue;
      }
    }
    entries.push(CsvDiffEntry {
      status: "removed".to_string(),
      left_line: Some(i + 1),
      right_line: None,
      left_cells: Some(full_row_cells(table_a, i)),
      right_cells: None,
      changed_cols: Vec::new(),
      count: 1,
    });
    *removed_count += 1;
  }

  for j in 0..table_b.len() {
    if !matched_b[j] {
      entries.push(CsvDiffEntry {
        status: "added".to_string(),
        left_line: None,
        right_line: Some(j + 1),
        left_cells: None,
        right_cells: Some(full_row_cells(table_b, j)),
        changed_cols: Vec::new(),
        count: 1,
      });
      *added_count += 1;
    }
  }
}

fn emit_change_block(
  entries: &mut Vec<CsvDiffEntry>,
  table_a: &Table,
  table_b: &Table,
  key_cols: &[usize],
  removed_block: &[usize],
  added_block: &[usize],
  added_count: &mut usize,
  removed_count: &mut usize,
  modified_count: &mut usize,
) {
  if removed_block.is_empty() && added_block.is_empty() {
    return;
  }

  if removed_block.len() == added_block.len() {
    for k in 0..removed_block.len() {
      let ia = removed_block[k];
      let ib = added_block[k];
      let mut changed_cols = Vec::new();
      let max_cols = table_a.row(ia).len().max(table_b.row(ib).len());
      for c in 0..max_cols {
        if table_a.cell_id(ia, c) != table_b.cell_id(ib, c) {
          changed_cols.push(c);
        }
      }
      if changed_cols.is_empty() {
        push_equal(entries, ia, ib, 1);
      } else {
        let shown = shown_columns(key_cols, &changed_cols);
        entries.push(CsvDiffEntry {
          status: "modified".to_string(),
          left_line: Some(ia + 1),
          right_line: Some(ib + 1),
          left_cells: Some(build_projected_cells(table_a, ia, &shown)),
          right_cells: Some(build_projected_cells(table_b, ib, &shown)),
          changed_cols,
          count: 1,
        });
        *modified_count += 1;
      }
    }
    return;
  }

  for &ia in removed_block {
    entries.push(CsvDiffEntry {
      status: "removed".to_string(),
      left_line: Some(ia + 1),
      right_line: None,
      left_cells: Some(full_row_cells(table_a, ia)),
      right_cells: None,
      changed_cols: Vec::new(),
      count: 1,
    });
    *removed_count += 1;
  }
  for &ib in added_block {
    entries.push(CsvDiffEntry {
      status: "added".to_string(),
      left_line: None,
      right_line: Some(ib + 1),
      left_cells: None,
      right_cells: Some(full_row_cells(table_b, ib)),
      changed_cols: Vec::new(),
      count: 1,
    });
    *added_count += 1;
  }
}

#[tauri::command]
pub async fn profile_csv(file_path: String, delimiter: String) -> Result<String, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let output = tokio::task::spawn_blocking(move || -> Result<std::process::Output, String> {
    let mut command = Command::new(&xan_path);
    command
      .arg("stats")
      .arg("-t")
      .arg("4")
      .arg("--delimiter")
      .arg(&delimiter)
      .arg(&file_path);

    #[cfg(target_os = "windows")]
    {
      command.creation_flags(0x08000000);
    }

    command
      .output()
      .map_err(|e| format!("Failed to execute xan stats: {}", e))
  })
  .await
  .map_err(|e| format!("Task join error: {}", e))?
  .map_err(|e| e)?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!("xan stats failed: {}", stderr));
  }

  Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvEncodingResult {
  pub output_path: String,
  pub bytes_read: usize,
  pub bytes_written: usize,
  /// Wall-clock duration of the conversion itself (excludes IPC/render time).
  pub elapsed_ms: u64,
}

/// Common encodings supported by the conversion dialog.
pub const ENCODING_GBK: &str = "gbk";
pub const ENCODING_GB18030: &str = "gb18030";
pub const ENCODING_UTF8: &str = "utf-8";
pub const ENCODING_UTF16_LE: &str = "utf-16le";
pub const ENCODING_UTF16_BE: &str = "utf-16be";
pub const ENCODING_LATIN1: &str = "latin1";

/// Convert a CSV file from `source_encoding` to `target_encoding` and write
/// the result directly to `output_path`. Byte-level text conversion: the file
/// is streamed through a stateful `encoding_rs` decoder/encoder pair in chunks,
/// so memory usage stays constant regardless of file size. The CSV structure
/// (delimiters, quoting, line endings) is preserved untouched. Returns nothing
/// on stdout.
#[tauri::command]
pub async fn convert_csv_encoding(
  input_path: String,
  output_path: String,
  source_encoding: String,
  target_encoding: String,
) -> Result<CsvEncodingResult, String> {
  tokio::task::spawn_blocking(move || -> Result<CsvEncodingResult, String> {
    const CHUNK_SIZE: usize = 64 * 1024;

    let started = std::time::Instant::now();
    let source = resolve_encoding(&source_encoding)?;
    let target = resolve_encoding(&target_encoding)?;

    let mut input =
      std::fs::File::open(&input_path).map_err(|e| format!("Failed to read input file: {}", e))?;
    let mut output = std::fs::File::create(&output_path)
      .map_err(|e| format!("Failed to write output file: {}", e))?;

    let (bytes_read, bytes_written) =
      stream_convert(source, target, &mut input, &mut output, CHUNK_SIZE)
        .map_err(|e| format!("Streaming conversion failed: {}", e))?;

    Ok(CsvEncodingResult {
      output_path,
      bytes_read,
      bytes_written,
      elapsed_ms: started.elapsed().as_millis() as u64,
    })
  })
  .await
  .map_err(|e| format!("Task join error: {}", e))?
}

/// Stream `input` (in `source` encoding) through a stateful decoder/encoder
/// pair, writing `target`-encoded bytes to `output`. Reads are done in
/// `chunk_size` blocks; incomplete multi-byte sequences spanning chunk
/// boundaries are buffered by the decoder/encoder, so no carry-over is needed.
/// Returns `(bytes_read, bytes_written)`.
fn stream_convert(
  source: &'static encoding_rs::Encoding,
  target: &'static encoding_rs::Encoding,
  input: &mut impl Read,
  output: &mut impl Write,
  chunk_size: usize,
) -> Result<(usize, usize), String> {
  use encoding_rs::CoderResult;

  let mut decoder = source.new_decoder();
  let mut encoder = target.new_encoder();

  let mut in_buf = vec![0u8; chunk_size];
  let mut text_buf = vec![0u8; chunk_size.max(16) * 4];
  let mut out_buf = vec![0u8; chunk_size.max(16) * 4];

  let mut bytes_read = 0usize;
  let mut bytes_written = 0usize;

  loop {
    let n = input
      .read(&mut in_buf)
      .map_err(|e| format!("Failed to read input file: {}", e))?;
    bytes_read += n;
    let last = n == 0;

    // Decode the chunk (or flush at EOF), then re-encode the produced text.
    let mut used = 0usize;
    loop {
      let (result, read, written, _had_errors) =
        decoder.decode_to_utf8(&in_buf[used..n], &mut text_buf, last);
      used += read;

      // Encode whatever UTF-8 text was produced.
      let text = std::str::from_utf8(&text_buf[..written])
        .map_err(|_| "Failed to decode input: invalid UTF-8 output".to_string())?;
      let mut text_used = 0usize;
      loop {
        let (enc_result, enc_read, enc_written, _replaced) =
          encoder.encode_from_utf8(&text[text_used..], &mut out_buf, last);
        text_used += enc_read;
        output
          .write_all(&out_buf[..enc_written])
          .map_err(|e| format!("Failed to write output file: {}", e))?;
        bytes_written += enc_written;
        match enc_result {
          CoderResult::OutputFull => continue,
          CoderResult::InputEmpty => break,
        }
      }

      match result {
        CoderResult::OutputFull => continue,
        CoderResult::InputEmpty => break,
      }
    }

    if last {
      break;
    }
  }

  Ok((bytes_read, bytes_written))
}

/// Resolve an encoding label to an `encoding_rs` `Encoding`.
fn resolve_encoding(label: &str) -> Result<&'static encoding_rs::Encoding, String> {
  use encoding_rs::Encoding;

  match label {
    ENCODING_GBK => Ok(encoding_rs::GBK),
    ENCODING_GB18030 => Ok(encoding_rs::GB18030),
    ENCODING_UTF8 => Ok(encoding_rs::UTF_8),
    ENCODING_UTF16_LE => Ok(encoding_rs::UTF_16LE),
    ENCODING_UTF16_BE => Ok(encoding_rs::UTF_16BE),
    ENCODING_LATIN1 => Ok(encoding_rs::WINDOWS_1252),
    _ => {
      Encoding::for_label(label.as_bytes()).ok_or_else(|| format!("Unsupported encoding: {label}"))
    }
  }
}

/// Result of splitting a CSV into good and bad rows.
#[derive(Debug, Serialize, Deserialize)]
pub struct SeparateResult {
  pub good_path: String,
  pub bad_path: String,
  pub good_rows: usize,
  pub bad_rows: usize,
  pub expected_columns: usize,
  /// Wall-clock duration of the split itself (excludes IPC/render time).
  pub elapsed_ms: u64,
}

/// In-memory outcome of the core separation logic (used for unit testing).
#[derive(Debug)]
struct SeparateOutput {
  good: Vec<u8>,
  bad: Vec<u8>,
  good_rows: usize,
  bad_rows: usize,
  expected_columns: usize,
}

/// Row counts produced by [`separate_stream`].
#[derive(Debug)]
struct SeparateCounts {
  good_rows: usize,
  bad_rows: usize,
  expected_columns: usize,
}

/// Streaming core of the good/bad split: reads one record at a time from
/// `input` and writes each record to `good_out` / `bad_out` the moment it is
/// classified.
///
/// Memory stays O(1) with respect to the input size — at most one record (the
/// "pending" valid-looking row of the reach-back rule) is held back, so this is
/// the path used for very large files. [`separate_csv_inner`] wraps it with
/// in-memory sinks for the default (whole-file-in-memory) mode.
///
/// A single shared `flexible(true)` reader is used so that column-count
/// mismatches are *not* promoted into parse errors (which would lose the bad
/// rows) and so that records spanning multiple physical lines (quoted embedded
/// newlines) are handled as one record. Both outputs are written through
/// `flexible(true)` csv writers — the reader's rigid column check and the
/// writer's own rigid check are the two places the original implementation used
/// to silently drop bad rows; enabling `flexible` on both fixes the bug.
///
/// `expected_columns` overrides the column count only when `Some(n)` with
/// `n > 0`; otherwise the header's column count is used. `skiprows` records
/// before the header are discarded.
///
/// `no_headers` treats the first record as a data row: no header row is
/// written to either output and the first record itself is classified
/// normally (seeding the reach-back slot when it matches `expected`).
///
/// Classification uses reach-back grouping: a run of under-column rows collects
/// the immediately preceding valid-looking row into the same bad group. For
/// rows `X` (3 cols), `Y` (1 col), `Z` (1 col) all three go to bad, because a
/// clean row directly followed only by malformed rows is itself suspect; an
/// independent clean row that is directly followed by another clean row stays
/// good. A malformed row can never be "un-followed", so the moment one arrives
/// the pending row is committed to bad and both records can be written out
/// immediately — which is what makes this single-pass form equivalent to
/// buffering the whole bad group (and keeps memory constant even when a huge
/// run of malformed rows occurs).
fn separate_stream<R, GW, BW>(
  input: R,
  delimiter: u8,
  quoting: bool,
  expected_columns: Option<usize>,
  skiprows: usize,
  no_headers: bool,
  good_out: GW,
  bad_out: BW,
) -> Result<SeparateCounts, String>
where
  R: Read,
  GW: Write,
  BW: Write,
{
  let quote_style = if quoting {
    csv::QuoteStyle::Necessary
  } else {
    csv::QuoteStyle::Never
  };

  let mut rdr = csv::ReaderBuilder::new()
    .has_headers(false)
    .delimiter(delimiter)
    .flexible(true)
    .quoting(quoting)
    .from_reader(input);

  // Read the header record once (skipping `skiprows` junk records first). The
  // same reader then continues with the data records: one pass over the input.
  let mut rec = csv::ByteRecord::new();
  for _ in 0..skiprows {
    match rdr.read_byte_record(&mut rec) {
      Ok(false) => return Err("No rows remain after skipping the requested rows".to_string()),
      Err(e) => return Err(format!("Failed to skip rows before header: {e}")),
      Ok(true) => {}
    }
  }
  if !rdr
    .read_byte_record(&mut rec)
    .map_err(|e| format!("Failed to parse header line: {e}"))?
  {
    return Err("Input file is empty (missing header)".to_string());
  }
  let header_rec = rec.clone();
  let expected = match expected_columns {
    Some(n) if n > 0 => n,
    _ => header_rec.len(),
  };

  // The good header is aligned to `expected` columns (pad empty fields or
  // truncate) so it stays structurally valid; the bad header keeps the
  // original fields. The headers themselves are emitted by the writers below.
  let mut good_hdr = header_rec.clone();
  if good_hdr.len() > expected {
    good_hdr.truncate(expected);
  }
  while good_hdr.len() < expected {
    good_hdr.push_field(b"");
  }

  let mut good_rows = 0usize;
  let mut bad_rows = 0usize;

  {
    let mut gw = csv::WriterBuilder::new()
      .delimiter(delimiter)
      .flexible(true)
      .quote_style(quote_style)
      .from_writer(good_out);
    let mut bw = csv::WriterBuilder::new()
      .delimiter(delimiter)
      .flexible(true)
      .quote_style(quote_style)
      .from_writer(bad_out);

    let mut pending_good: Option<csv::ByteRecord> = None;

    if no_headers {
      // Headerless input: the first record is data, not a header. Neither
      // output gets a header row; the first record joins the normal
      // classification — seeding the reach-back slot when it matches
      // `expected`, falling to bad when it does not.
      if header_rec.len() == expected {
        pending_good = Some(header_rec);
      } else {
        bw.write_byte_record(&header_rec)
          .map_err(|e| format!("Failed to write bad row: {e}"))?;
        bad_rows += 1;
      }
    } else {
      gw.write_byte_record(&good_hdr)
        .map_err(|e| format!("Failed to write good header: {e}"))?;
      bw.write_byte_record(&header_rec)
        .map_err(|e| format!("Failed to write bad header: {e}"))?;
    }

    loop {
      match rdr.read_byte_record(&mut rec) {
        Ok(true) => {
          if rec.len() == expected {
            // The held row is now known to be followed by another clean row,
            // so it is confirmed good.
            if let Some(pg) = pending_good.take() {
              gw.write_byte_record(&pg)
                .map_err(|e| format!("Failed to write good row: {e}"))?;
              good_rows += 1;
            }
            pending_good = Some(rec.clone());
          } else {
            // Under/over-column row: reach back, pull the pending clean row
            // into the bad group, then write both out (order preserved).
            if let Some(pg) = pending_good.take() {
              bw.write_byte_record(&pg)
                .map_err(|e| format!("Failed to write bad row: {e}"))?;
              bad_rows += 1;
            }
            bw.write_byte_record(&rec)
              .map_err(|e| format!("Failed to write bad row: {e}"))?;
            bad_rows += 1;
          }
        }
        Ok(false) => break,
        Err(_) => {
          // A parse error (e.g. an unterminated quote) yields no usable record;
          // it also pulls the pending clean row into the bad group.
          if let Some(pg) = pending_good.take() {
            bw.write_byte_record(&pg)
              .map_err(|e| format!("Failed to write bad row: {e}"))?;
            bad_rows += 1;
          }
          bw.write_byte_record(&rec)
            .map_err(|e| format!("Failed to write bad row: {e}"))?;
          bad_rows += 1;
        }
      }
    }

    // EOF: a trailing valid row was never followed by anything, so it is good.
    if let Some(pg) = pending_good.take() {
      gw.write_byte_record(&pg)
        .map_err(|e| format!("Failed to write good row: {e}"))?;
      good_rows += 1;
    }

    gw.flush()
      .map_err(|e| format!("Failed to flush good file: {e}"))?;
    bw.flush()
      .map_err(|e| format!("Failed to flush bad file: {e}"))?;
  }

  Ok(SeparateCounts {
    good_rows,
    bad_rows,
    expected_columns: expected,
  })
}

/// In-memory wrapper around [`separate_stream`]: splits `input` into good rows
/// (matching the expected column count, including for the header) and bad rows
/// (everything else), re-serializing every record so no row is ever dropped.
///
/// The whole input and both outputs live in memory, which is the fast path for
/// small and medium files; [`separate_stream`] is the constant-memory variant
/// used for very large files.
fn separate_csv_inner(
  input: &[u8],
  delimiter: u8,
  quoting: bool,
  expected_columns: Option<usize>,
  skiprows: usize,
  no_headers: bool,
) -> Result<SeparateOutput, String> {
  let mut good = Vec::with_capacity(input.len() / 2);
  let mut bad = Vec::with_capacity(input.len() / 2);

  let counts = separate_stream(
    Cursor::new(input),
    delimiter,
    quoting,
    expected_columns,
    skiprows,
    no_headers,
    &mut good,
    &mut bad,
  )?;

  Ok(SeparateOutput {
    good,
    bad,
    good_rows: counts.good_rows,
    bad_rows: counts.bad_rows,
    expected_columns: counts.expected_columns,
  })
}

/// Derive the `_good`/`_bad` output paths next to the input (or in `out_dir`).
/// The input extension is preserved; a file without an extension gets none.
fn separate_output_paths(
  path: &str,
  out_dir: Option<&str>,
) -> (std::path::PathBuf, std::path::PathBuf) {
  let p = std::path::Path::new(path);
  let stem = p
    .file_stem()
    .map(|s| s.to_string_lossy().into_owned())
    .unwrap_or_default();
  let ext = p
    .extension()
    .map(|e| format!(".{}", e.to_string_lossy()))
    .unwrap_or_default();
  let dir = match out_dir {
    Some(d) if !d.trim().is_empty() => std::path::PathBuf::from(d),
    _ => p
      .parent()
      .map(std::path::Path::to_path_buf)
      .unwrap_or_default(),
  };
  (
    dir.join(format!("{stem}_good{ext}")),
    dir.join(format!("{stem}_bad{ext}")),
  )
}

/// Streaming (constant-memory) variant of the split, used for very large files.
///
/// The input is read through a `BufReader` and both outputs are written through
/// `BufWriter`s, so neither the input nor either output is ever held in memory.
/// The output files are written directly (no temporary file + rename), so an
/// error raised after the first write leaves a partial output file behind.
fn separate_csv_to_files(
  path: &str,
  good_path: &std::path::Path,
  bad_path: &std::path::Path,
  delimiter: u8,
  quoting: bool,
  expected_columns: Option<usize>,
  skiprows: usize,
  no_headers: bool,
) -> Result<SeparateCounts, String> {
  /// Buffer size for both ends of the streaming path.
  const STREAM_BUF_SIZE: usize = 1 << 20; // 1 MiB

  let input = File::open(path).map_err(|e| format!("Failed to open input file: {e}"))?;
  let good_file =
    File::create(good_path).map_err(|e| format!("Failed to create good file: {e}"))?;
  let bad_file = File::create(bad_path).map_err(|e| format!("Failed to create bad file: {e}"))?;

  separate_stream(
    BufReader::with_capacity(STREAM_BUF_SIZE, input),
    delimiter,
    quoting,
    expected_columns,
    skiprows,
    no_headers,
    BufWriter::with_capacity(STREAM_BUF_SIZE, good_file),
    BufWriter::with_capacity(STREAM_BUF_SIZE, bad_file),
  )
}

/// Split a CSV file into a `_good` rows file and a `_bad` rows file. The good
/// file keeps independent complete records; a run of under-column rows is
/// grouped with the immediately preceding valid-looking row into the bad file.
/// The bad file receives every other record verbatim.
///
/// `streaming` (opt-in, default `false`) selects the constant-memory single-pass
/// implementation for very large files; by default the whole input is read into
/// memory, which is faster for small and medium files.
///
/// `no_headers` (opt-in, default `false`) treats the file as headerless: the
/// first record is classified as a data row and no header line is emitted to
/// either output. Without it the first row is copied into both files as the
/// header row.
#[tauri::command]
pub async fn separate_csv(
  path: String,
  delimiter: String,
  quoting: bool,
  expected_columns: Option<String>,
  skiprows: usize,
  out_dir: Option<String>,
  streaming: Option<bool>,
  no_headers: Option<bool>,
) -> Result<SeparateResult, String> {
  tokio::task::spawn_blocking(move || -> Result<SeparateResult, String> {
    let started = std::time::Instant::now();
    let delim = if delimiter.is_empty() {
      b','
    } else {
      delimiter.as_bytes()[0]
    };
    let expected = match expected_columns.as_deref().map(str::trim) {
      Some(s) if !s.is_empty() => Some(
        s.parse::<usize>()
          .map_err(|_| format!("Invalid expected_columns: {s}"))?,
      ),
      _ => None,
    };

    let (good_path, bad_path) = separate_output_paths(&path, out_dir.as_deref());
    if let Some(dir) = good_path.parent() {
      std::fs::create_dir_all(dir)
        .map_err(|e| format!("Failed to create output directory: {e}"))?;
    }

    let no_headers = no_headers.unwrap_or(false);
    let counts = if streaming.unwrap_or(false) {
      separate_csv_to_files(
        &path, &good_path, &bad_path, delim, quoting, expected, skiprows, no_headers,
      )?
    } else {
      let input = std::fs::read(&path).map_err(|e| format!("Failed to read input file: {e}"))?;
      let out = separate_csv_inner(&input, delim, quoting, expected, skiprows, no_headers)?;
      std::fs::write(&good_path, &out.good)
        .map_err(|e| format!("Failed to write good file: {e}"))?;
      std::fs::write(&bad_path, &out.bad).map_err(|e| format!("Failed to write bad file: {e}"))?;
      SeparateCounts {
        good_rows: out.good_rows,
        bad_rows: out.bad_rows,
        expected_columns: out.expected_columns,
      }
    };

    Ok(SeparateResult {
      good_path: good_path.to_string_lossy().into_owned(),
      bad_path: bad_path.to_string_lossy().into_owned(),
      good_rows: counts.good_rows,
      bad_rows: counts.bad_rows,
      expected_columns: counts.expected_columns,
      elapsed_ms: started.elapsed().as_millis() as u64,
    })
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

// ── Splitting a text file into N-line parts ──────────────────────────

/// Result of splitting a text file into parts of at most N lines each.
#[derive(Debug, Serialize, Deserialize)]
pub struct SplitLinesResult {
  /// Directory every part was written to (equals the input's directory when
  /// `out_dir` was omitted).
  pub output_dir: String,
  /// `{stem}_part1{ext}`, `{stem}_part2{ext}`, … in order.
  pub output_paths: Vec<String>,
  pub file_count: usize,
  /// Requested maximum number of data rows per part.
  pub lines_per_file: usize,
  /// Data rows written across all parts (excludes the header when it is
  /// treated as a header).
  pub total_rows: usize,
  /// Whether the first line was copied into every part as a header row.
  pub header_written: bool,
  /// Wall-clock duration of the split itself (excludes IPC/render time).
  pub elapsed_ms: u64,
}

/// Outcome of [`split_lines_stream`] (used for unit testing and reporting).
#[derive(Debug, PartialEq, Eq)]
struct SplitLinesCounts {
  file_count: usize,
  total_rows: usize,
}

/// Buffer size for the line-splitting reader and writers.
const SPLIT_LINES_BUF_SIZE: usize = 1 << 20; // 1 MiB

/// Resolve the directory the parts go to plus the input's stem/extension.
///
/// The extension is preserved (a `.txt` input yields `.txt` parts) because —
/// unlike [`separate_csv`] — this splitter never parses CSV and works on any
/// line-based text file.
fn split_lines_target(path: &str, out_dir: Option<&str>) -> (std::path::PathBuf, String, String) {
  let p = std::path::Path::new(path);
  let stem = p
    .file_stem()
    .map(|s| s.to_string_lossy().into_owned())
    .unwrap_or_default();
  let ext = p
    .extension()
    .map(|e| format!(".{}", e.to_string_lossy()))
    .unwrap_or_default();
  let dir = match out_dir {
    Some(d) if !d.trim().is_empty() => std::path::PathBuf::from(d),
    _ => p
      .parent()
      .map(std::path::Path::to_path_buf)
      .unwrap_or_default(),
  };
  (dir, stem, ext)
}

/// Path of part `index` (1-based) inside `dir`.
fn split_part_path(
  dir: &std::path::Path,
  stem: &str,
  ext: &str,
  index: usize,
) -> std::path::PathBuf {
  dir.join(format!("{stem}_part{index}{ext}"))
}

/// Split a line-based text file into parts of at most `lines_per_file` rows.
///
/// The input is read as **raw lines** through a `BufReader` and each line is
/// written out byte-for-byte as it is read, so neither the input nor any output
/// part is ever held in memory (constant memory for arbitrarily large files)
/// and line terminators (`\n` / `\r\n`) are preserved as-is.
///
/// `no_headers` (opt-in, default `false`) treats the first line as a data row:
/// it joins part 1 and no header line is written. Without it the first line is
/// remembered as the header and copied into the top of every part, so each part
/// stays self-describing.
///
/// Parts are named `{stem}_part{N}{ext}` starting at `N = 1`; the input's
/// extension is preserved. A non-empty input always produces at least one part,
/// even when it holds fewer rows than `lines_per_file`.
fn split_lines_stream<R, W, F>(
  input: R,
  lines_per_file: usize,
  no_headers: bool,
  mut new_part: F,
) -> Result<SplitLinesCounts, String>
where
  R: BufRead,
  W: Write,
  F: FnMut(usize) -> Result<W, String>,
{
  if lines_per_file == 0 {
    return Err("Lines per file must be at least 1".to_string());
  }

  let mut reader = input;
  let mut line: Vec<u8> = Vec::new();
  let mut header: Option<Vec<u8>> = None;
  let mut writer: Option<W> = None;
  let mut rows_in_part = 0usize;
  let mut counts = SplitLinesCounts {
    file_count: 0,
    total_rows: 0,
  };
  let mut is_first_line = true;

  loop {
    line.clear();
    let read = reader
      .read_until(b'\n', &mut line)
      .map_err(|e| format!("Failed to read input: {e}"))?;
    if read == 0 {
      break;
    }
    if is_first_line {
      is_first_line = false;
      if !no_headers {
        // The first line is the header: held back and replayed into every
        // part. It is not part of any row count.
        header = Some(line.clone());
        continue;
      }
    }

    // Open a new part when starting out or when the current one is full.
    if writer.is_none() || rows_in_part == lines_per_file {
      if let Some(mut previous) = writer.take() {
        previous
          .flush()
          .map_err(|e| format!("Failed to flush output part: {e}"))?;
      }
      let index = counts.file_count + 1;
      let mut next = new_part(index)?;
      if let Some(h) = &header {
        next
          .write_all(h)
          .map_err(|e| format!("Failed to write header row: {e}"))?;
      }
      writer = Some(next);
      counts.file_count = index;
      rows_in_part = 0;
    }

    {
      let out = writer.as_mut().expect("a writer was opened above");
      out
        .write_all(&line)
        .map_err(|e| format!("Failed to write row: {e}"))?;
      if !line.ends_with(b"\n") {
        // The last line of the input carried no terminator; terminate it so
        // every part is a well-formed text file.
        out
          .write_all(b"\n")
          .map_err(|e| format!("Failed to write row: {e}"))?;
      }
    }
    rows_in_part += 1;
    counts.total_rows += 1;
  }

  if is_first_line {
    return Err("Input file is empty (no lines to split)".to_string());
  }

  if writer.is_none() {
    // Header-only input: still produce one part so the run leaves a file behind.
    let mut only = new_part(1)?;
    if let Some(h) = &header {
      only
        .write_all(h)
        .map_err(|e| format!("Failed to write header row: {e}"))?;
    }
    writer = Some(only);
    counts.file_count = 1;
  }

  if let Some(mut out) = writer.take() {
    out
      .flush()
      .map_err(|e| format!("Failed to flush output part: {e}"))?;
  }

  Ok(counts)
}

/// Streaming implementation behind [`split_lines`]: reads `path` as raw lines
/// and writes `{stem}_part{N}{ext}` parts into `out_dir` (or next to the input).
///
/// The output directory is created if needed. Parts are written directly (no
/// temporary file + rename), so a mid-run failure leaves the parts already
/// written on disk.
fn split_lines_to_files(
  path: &str,
  out_dir: Option<&str>,
  lines_per_file: usize,
  no_headers: bool,
) -> Result<(std::path::PathBuf, String, String, SplitLinesCounts), String> {
  let (dir, stem, ext) = split_lines_target(path, out_dir);
  std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create output directory: {e}"))?;

  let input = File::open(path).map_err(|e| format!("Failed to open input file: {e}"))?;

  let counts = {
    let dir = dir.clone();
    let stem = stem.clone();
    let ext = ext.clone();
    split_lines_stream(
      BufReader::with_capacity(SPLIT_LINES_BUF_SIZE, input),
      lines_per_file,
      no_headers,
      |index| {
        let part = split_part_path(&dir, &stem, &ext, index);
        let file = File::create(&part).map_err(|e| format!("Failed to create output part: {e}"))?;
        Ok(BufWriter::with_capacity(SPLIT_LINES_BUF_SIZE, file))
      },
    )?
  };

  Ok((dir, stem, ext, counts))
}

/// Split a text file into parts of at most `lines_per_file` rows each.
///
/// Lines are treated as raw text, not as CSV records: the file is never parsed
/// and no delimiter is involved, so this works on any line-based file (`.csv`,
/// `.txt`, logs) and is safe for very large inputs — memory stays constant.
///
/// `no_headers` (opt-in, default `false`) treats the first line as data. By
/// default the first line is treated as a header row and copied into every
/// part. Output files are named `{stem}_part{N}{ext}` (N from 1) and written
/// next to the input, or into `out_dir` when given. Existing parts from an
/// earlier run are not deleted.
#[tauri::command]
pub async fn split_lines(
  path: String,
  lines_per_file: usize,
  out_dir: Option<String>,
  no_headers: Option<bool>,
) -> Result<SplitLinesResult, String> {
  tokio::task::spawn_blocking(move || -> Result<SplitLinesResult, String> {
    let started = std::time::Instant::now();
    let no_headers = no_headers.unwrap_or(false);
    let (dir, stem, ext, counts) =
      split_lines_to_files(&path, out_dir.as_deref(), lines_per_file, no_headers)?;

    let output_paths = (1..=counts.file_count)
      .map(|index| {
        split_part_path(&dir, &stem, &ext, index)
          .to_string_lossy()
          .into_owned()
      })
      .collect();

    Ok(SplitLinesResult {
      output_dir: dir.to_string_lossy().into_owned(),
      output_paths,
      file_count: counts.file_count,
      lines_per_file,
      total_rows: counts.total_rows,
      header_written: !no_headers,
      elapsed_ms: started.elapsed().as_millis() as u64,
    })
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

// File probing: first-row columns + delimiter detection

/// Candidate delimiters for automatic detection, mirroring the list offered in
/// the app settings (`src/components/setting/SettingsTabContent.tsx`).
const DELIMITER_CANDIDATES: [u8; 5] = [b',', b';', b'\t', b'|', b'^'];

/// Maximum number of bytes read from the head of a file when probing it.
const PROBE_SAMPLE_BYTES: usize = 64 * 1024;

/// Maximum number of records considered when scoring a delimiter candidate.
const PROBE_SAMPLE_RECORDS: usize = 200;

/// How a delimiter was resolved by [`probe_csv_sync`].
pub const PROBE_SOURCE_DETECTED: &str = "detected";
pub const PROBE_SOURCE_FORCED: &str = "forced";
pub const PROBE_SOURCE_FALLBACK: &str = "fallback";

/// Score of a candidate delimiter over a sampled head.
#[derive(Debug, Serialize, Deserialize)]
pub struct DelimiterCandidate {
  /// The delimiter itself, as a one-character string (`"\t"` for tab).
  pub delimiter: String,
  /// Field count of the first record (header) under this delimiter.
  pub header_fields: usize,
  /// Dominant field count of the sampled body (excluding the header).
  pub fields: usize,
  /// Whether `fields` covers at least 90% of the sampled records.
  pub consistent: bool,
  /// Composite score; `-1` means the candidate cannot explain the sample.
  pub score: i32,
}

/// Result of probing the head of a CSV file.
#[derive(Debug, Serialize, Deserialize)]
pub struct CsvProbe {
  pub path: String,
  /// Delimiter used for `columns` / `header` / `sample_rows`.
  pub delimiter: String,
  /// [`PROBE_SOURCE_DETECTED`], [`PROBE_SOURCE_FORCED`] or [`PROBE_SOURCE_FALLBACK`].
  pub source: String,
  /// `"high"` | `"low"` | `"none"` (always `"high"` when forced).
  pub confidence: String,
  /// Field count of the first record — "the first row's column count".
  pub columns: usize,
  /// First record's fields (capped at [`PROBE_HEADER_FIELDS`]).
  pub header: Vec<String>,
  /// The next few records, for preview.
  pub sample_rows: Vec<Vec<String>>,
  /// Number of records the detection saw.
  pub sampled_records: usize,
  /// Whether the sample was cut off by [`PROBE_SAMPLE_BYTES`].
  pub truncated: bool,
  /// Quoting mode the detection settled on; `false` means the quoting-enabled
  /// pass found nothing and a second pass without quoting was used.
  pub quoting_used: bool,
  /// Every candidate's score, for diagnostics / UI.
  pub candidates: Vec<DelimiterCandidate>,
}

/// First-record fields kept in [`CsvProbe::header`].
const PROBE_HEADER_FIELDS: usize = 50;

/// Convention priority used to break ties between equally plausible delimiters
/// (same order as the settings UI: comma, tab, semicolon, pipe, caret).
fn delimiter_priority(delimiter: u8) -> i32 {
  match delimiter {
    b',' => 5,
    b'\t' => 4,
    b';' => 3,
    b'|' => 2,
    b'^' => 1,
    _ => 0,
  }
}

/// Read at most [`PROBE_SAMPLE_BYTES`] (plus one byte, to detect truncation)
/// from the head of `path`. When the head was cut off, drop everything after
/// the last newline so no half-parsed record reaches the detectors.
fn read_head_sample(path: &str) -> Result<(Vec<u8>, bool), String> {
  let file = File::open(path).map_err(|e| format!("Failed to open file: {e}"))?;
  let mut buf = Vec::with_capacity(PROBE_SAMPLE_BYTES);
  BufReader::with_capacity(PROBE_SAMPLE_BYTES, file)
    .take(PROBE_SAMPLE_BYTES as u64 + 1)
    .read_to_end(&mut buf)
    .map_err(|e| format!("Failed to read file: {e}"))?;

  let truncated = buf.len() > PROBE_SAMPLE_BYTES;
  if truncated {
    buf.truncate(PROBE_SAMPLE_BYTES);
    if let Some(last_newline) = buf.iter().rposition(|&b| b == b'\n') {
      buf.truncate(last_newline + 1);
    }
  }
  Ok((buf, truncated))
}

/// Parse at most `max_records` records out of `sample`, discarding `skiprows`
/// records first. Best effort: a parse error simply ends the iteration (the
/// caller only uses these records for statistics and preview).
fn parse_sample(
  sample: &[u8],
  delimiter: u8,
  quoting: bool,
  skiprows: usize,
  max_records: usize,
) -> Vec<csv::ByteRecord> {
  let mut rdr = csv::ReaderBuilder::new()
    .has_headers(false)
    .delimiter(delimiter)
    .flexible(true)
    .quoting(quoting)
    .from_reader(Cursor::new(sample));

  let mut out = Vec::new();
  let mut rec = csv::ByteRecord::new();
  for _ in 0..skiprows {
    match rdr.read_byte_record(&mut rec) {
      Ok(true) => {}
      _ => return out,
    }
  }
  while out.len() < max_records {
    match rdr.read_byte_record(&mut rec) {
      Ok(true) => out.push(rec.clone()),
      _ => break,
    }
  }
  out
}

/// Convert a record to owned strings (lossy: probing must never fail on
/// non-UTF-8 input, the split itself is byte level).
fn record_to_strings(rec: &csv::ByteRecord) -> Vec<String> {
  rec
    .iter()
    .map(|field| String::from_utf8_lossy(field).into_owned())
    .collect()
}

/// The header's first field may still carry a BOM; hide it from the preview.
fn strip_bom(fields: &mut [String]) {
  if let Some(first) = fields.first_mut() {
    *first = first.trim_start_matches('\u{feff}').to_string();
  }
}

/// Score every candidate delimiter over the sampled head.
///
/// The header's field count is weighted higher (60) than body consistency (30)
/// on purpose: this tool is fed *dirty* files, where the body frequently has a
/// dominant field count of 1 and only the header still identifies the delimiter
/// (see the acceptance data in design 016). Candidates whose score stays `-1`
/// cannot explain the sample at all.
///
/// Only the sample's *content* is considered: the file extension deliberately
/// carries no weight, because plenty of CSVs are named `.csv` while using `;`,
/// `\t` or any other delimiter.
fn score_delimiters(sample: &[u8], quoting: bool, skiprows: usize) -> Vec<DelimiterCandidate> {
  let mut candidates = Vec::with_capacity(DELIMITER_CANDIDATES.len());

  for &delimiter in DELIMITER_CANDIDATES.iter() {
    let records = parse_sample(sample, delimiter, quoting, skiprows, PROBE_SAMPLE_RECORDS);
    if records.is_empty() {
      candidates.push(DelimiterCandidate {
        delimiter: (delimiter as char).to_string(),
        header_fields: 0,
        fields: 0,
        consistent: false,
        score: -1,
      });
      continue;
    }

    let header_fields = records[0].len();
    let mut histogram: HashMap<usize, usize> = HashMap::new();
    for rec in &records {
      *histogram.entry(rec.len()).or_insert(0) += 1;
    }
    // Dominant body field count, ignoring single-field records: `> 1` is what
    // makes a delimiter plausible at all.
    let (body_mode, body_count) = histogram
      .iter()
      .filter(|(fields, _)| **fields > 1)
      .max_by_key(|(fields, count)| (**count, **fields))
      .map(|(fields, count)| (*fields, *count))
      .unwrap_or((1, *histogram.get(&1).unwrap_or(&0)));
    let body_ratio = body_count as f64 / records.len() as f64;
    let consistent = body_ratio >= 0.9;

    if header_fields <= 1 && body_mode <= 1 {
      candidates.push(DelimiterCandidate {
        delimiter: (delimiter as char).to_string(),
        header_fields,
        fields: body_mode,
        consistent,
        score: -1,
      });
      continue;
    }

    let score = 60 * i32::from(header_fields > 1)
      + (30.0 * body_ratio) as i32
      + body_mode.min(20) as i32
      + delimiter_priority(delimiter);

    candidates.push(DelimiterCandidate {
      delimiter: (delimiter as char).to_string(),
      header_fields,
      fields: body_mode,
      consistent,
      score,
    });
  }

  candidates
}

/// Pick the winning candidate out of [`score_delimiters`]' output.
///
/// Returns `(winner, candidates, confidence)`. Ties are broken by, in order:
/// score, dominant body field count, convention priority.
fn detect_delimiter(
  sample: &[u8],
  quoting: bool,
  skiprows: usize,
) -> (Option<u8>, Vec<DelimiterCandidate>, &'static str) {
  let candidates = score_delimiters(sample, quoting, skiprows);
  let viable: Vec<&DelimiterCandidate> = candidates.iter().filter(|c| c.score >= 0).collect();
  if viable.is_empty() {
    return (None, candidates, "none");
  }

  let best_score = viable.iter().map(|c| c.score).max().unwrap_or(0);
  let tied = viable.iter().filter(|c| c.score == best_score).count();
  let Some(best) = viable.iter().max_by_key(|c| {
    (
      c.score,
      c.fields as i32,
      delimiter_priority(c.delimiter.as_bytes().first().copied().unwrap_or(0)),
    )
  }) else {
    return (None, candidates, "none");
  };

  // A unique winner backed by the header is trustworthy; body-only evidence or
  // a tie gets a "please verify" confidence.
  let confidence = if tied == 1 && best.header_fields > 1 {
    "high"
  } else {
    "low"
  };
  (Some(best.delimiter.as_bytes()[0]), candidates, confidence)
}

/// [`detect_delimiter`] plus the quoting fallback: if the quoting-enabled pass
/// finds nothing at all, retry with quoting disabled (files whose fields carry
/// bare delimiters can confuse the quoting-aware parser). Returns the resolved
/// quoting mode alongside the usual tuple.
fn detect_delimiter_with_fallback(
  sample: &[u8],
  quoting: bool,
  skiprows: usize,
) -> (Option<u8>, Vec<DelimiterCandidate>, &'static str, bool) {
  let (best, candidates, confidence) = detect_delimiter(sample, quoting, skiprows);
  if best.is_none() && quoting {
    let (best, candidates, confidence) = detect_delimiter(sample, false, skiprows);
    return (best, candidates, confidence, false);
  }
  (best, candidates, confidence, quoting)
}

/// Synchronous body of [`probe_csv_file`] (kept separate so it can be unit
/// tested without an async runtime).
fn probe_csv_sync(
  path: &str,
  delimiter: Option<&str>,
  fallback_delimiter: Option<&str>,
  skiprows: usize,
  quoting: bool,
  preview_rows: Option<usize>,
) -> Result<CsvProbe, String> {
  let preview = preview_rows.unwrap_or(3).min(20);
  let (sample, truncated) = read_head_sample(path)?;
  if sample.is_empty() {
    return Err("Input file is empty (missing header)".to_string());
  }

  let forced = delimiter
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.as_bytes()[0]);
  let fallback = fallback_delimiter
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(|s| s.as_bytes()[0])
    .unwrap_or(b',');

  let (delimiter, source, confidence, candidates, quoting_used) = match forced {
    Some(d) => (d, PROBE_SOURCE_FORCED, "high", Vec::new(), quoting),
    None => {
      let (best, candidates, confidence, quoting_used) =
        detect_delimiter_with_fallback(&sample, quoting, skiprows);
      match best {
        Some(d) => (
          d,
          PROBE_SOURCE_DETECTED,
          confidence,
          candidates,
          quoting_used,
        ),
        None => (
          fallback,
          PROBE_SOURCE_FALLBACK,
          "none",
          candidates,
          quoting_used,
        ),
      }
    }
  };

  // The header/preview always use the *caller's* quoting mode, so what the UI
  // shows is what the split will compute (both derive `expected` the same way).
  let records = parse_sample(&sample, delimiter, quoting, skiprows, PROBE_SAMPLE_RECORDS);
  if records.is_empty() {
    return Err("No rows remain after skipping the requested rows".to_string());
  }

  let columns = records[0].len();
  let mut header = record_to_strings(&records[0]);
  header.truncate(PROBE_HEADER_FIELDS);
  strip_bom(&mut header);
  let sample_rows = records
    .iter()
    .skip(1)
    .take(preview)
    .map(record_to_strings)
    .collect();

  Ok(CsvProbe {
    path: path.to_string(),
    delimiter: (delimiter as char).to_string(),
    source: source.to_string(),
    confidence: confidence.to_string(),
    columns,
    header,
    sample_rows,
    sampled_records: records.len(),
    truncated,
    quoting_used,
    candidates,
  })
}

/// Inspect the head of a CSV file: resolve the delimiter (auto-detected unless
/// `delimiter` is given), report the first row's column count and return a small
/// preview.
///
/// Only [`PROBE_SAMPLE_BYTES`] are read from disk, so this stays fast on huge
/// files. `delimiter = None` turns detection on; when detection is inconclusive
/// the delimiter falls back to `fallback_delimiter` (default `,`) and reports
/// `confidence = "none"`.
#[tauri::command]
pub async fn probe_csv_file(
  path: String,
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  skiprows: usize,
  quoting: bool,
  preview_rows: Option<usize>,
) -> Result<CsvProbe, String> {
  tokio::task::spawn_blocking(move || {
    probe_csv_sync(
      &path,
      delimiter.as_deref(),
      fallback_delimiter.as_deref(),
      skiprows,
      quoting,
      preview_rows,
    )
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

#[cfg(test)]
mod tests {
  use super::*;

  fn build_tables<'a>(
    pool: &'a mut Interner,
    a_data: &[&[&str]],
    b_data: &[&[&str]],
  ) -> (Table<'a>, Table<'a>) {
    fn parts(pool: &mut Interner, data: &[&[&str]]) -> (Vec<u32>, Vec<usize>) {
      let mut cells = Vec::new();
      let mut row_off = vec![0usize];
      for &row in data {
        for &cell in row {
          cells.push(pool.intern(cell));
        }
        row_off.push(cells.len());
      }
      (cells, row_off)
    }

    let (cells_a, row_off_a) = parts(pool, a_data);
    let (cells_b, row_off_b) = parts(pool, b_data);
    let table_a = Table {
      headers: Vec::new(),
      interner: pool,
      cells: cells_a,
      row_off: row_off_a,
    };
    let table_b = Table {
      headers: Vec::new(),
      interner: pool,
      cells: cells_b,
      row_off: row_off_b,
    };
    (table_a, table_b)
  }

  #[test]
  fn diff_positional_identical_rows_merge_into_one_run() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(
      &mut pool,
      &[&["1", "a"], &["2", "b"], &["3", "c"]],
      &[&["1", "a"], &["2", "b"], &["3", "c"]],
    );

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    diff_positional(
      &mut entries,
      &a,
      &b,
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].status, "equal");
    assert_eq!(entries[0].count, 3);
    assert_eq!(entries[0].left_line, Some(1));
    assert_eq!(entries[0].left_cells, None);
    assert_eq!(added_count, 0);
    assert_eq!(removed_count, 0);
    assert_eq!(modified_count, 0);
  }

  #[test]
  fn diff_positional_detects_insertion_in_middle() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(
      &mut pool,
      &[&["1", "a"], &["3", "c"]],
      &[&["1", "a"], &["2", "b"], &["3", "c"]],
    );

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    diff_positional(
      &mut entries,
      &a,
      &b,
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    let statuses: Vec<&str> = entries.iter().map(|e| e.status.as_str()).collect();
    assert_eq!(statuses, vec!["equal", "added", "equal"]);
    assert_eq!(added_count, 1);
    let added = entries.iter().find(|e| e.status == "added").unwrap();
    assert_eq!(added.right_line, Some(2));
    assert_eq!(
      added.right_cells,
      Some(vec!["2".to_string(), "b".to_string()])
    );
  }

  #[test]
  fn diff_by_key_joins_and_marks_changes() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(
      &mut pool,
      &[
        &["1", "a", "same"],
        &["2", "old", "same"],
        &["3", "c", "same"],
        &["5", "gone", "same"],
      ],
      &[
        &["1", "a", "same"],
        &["2", "new", "same"],
        &["4", "d", "same"],
        &["5", "gone", "same"],
      ],
    );

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    diff_by_key(
      &mut entries,
      &a,
      &b,
      &[0],
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    let statuses: Vec<&str> = entries.iter().map(|e| e.status.as_str()).collect();
    assert_eq!(
      statuses,
      vec!["equal", "modified", "removed", "equal", "added"]
    );
    assert_eq!(modified_count, 1);
    assert_eq!(removed_count, 1);
    assert_eq!(added_count, 1);
    assert_eq!(
      entries
        .iter()
        .filter(|e| e.status == "equal")
        .map(|e| e.count)
        .sum::<usize>(),
      2
    );

    let modified = entries.iter().find(|e| e.status == "modified").unwrap();
    assert_eq!(modified.changed_cols, vec![1]);
    assert_eq!(modified.left_line, Some(2));
    assert_eq!(modified.right_line, Some(2));
    // Only key column 0 + changed column 1 are sent; unchanged column 2 dropped.
    assert_eq!(
      modified.left_cells,
      Some(vec!["2".to_string(), "old".to_string()])
    );
    assert_eq!(
      modified.right_cells,
      Some(vec!["2".to_string(), "new".to_string()])
    );

    // Removed rows carry their full row.
    let removed = entries.iter().find(|e| e.status == "removed").unwrap();
    assert_eq!(
      removed.left_cells,
      Some(vec!["3".to_string(), "c".to_string(), "same".to_string()])
    );
  }

  #[test]
  fn diff_by_key_handles_duplicate_keys() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(
      &mut pool,
      &[&["k", "x1"], &["k", "x2"]],
      &[&["k", "x1"], &["k", "x2"]],
    );

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    diff_by_key(
      &mut entries,
      &a,
      &b,
      &[0],
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    assert_eq!(added_count, 0);
    assert_eq!(removed_count, 0);
    assert_eq!(modified_count, 0);
    assert_eq!(
      entries
        .iter()
        .filter(|e| e.status == "equal")
        .map(|e| e.count)
        .sum::<usize>(),
      2
    );
  }

  #[test]
  fn push_equal_merges_contiguous_runs() {
    let mut entries = Vec::new();
    push_equal(&mut entries, 0, 0, 3);
    push_equal(&mut entries, 3, 3, 2);
    push_equal(&mut entries, 5, 5, 1);
    push_equal(&mut entries, 6, 10, 1);

    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].count, 6);
    assert_eq!(entries[0].left_line, Some(1));
    assert_eq!(entries[1].count, 1);
    assert_eq!(entries[1].left_line, Some(7));
    assert_eq!(entries[1].right_line, Some(11));
  }

  #[test]
  fn diff_marks_added_removed_modified() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(
      &mut pool,
      &[&["1", "a"], &["2", "old"], &["3", "c"]],
      &[&["1", "a"], &["2", "new"], &["4", "d"]],
    );

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    emit_change_block(
      &mut entries,
      &a,
      &b,
      &[0],
      &[1],
      &[1],
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].status, "modified");
    assert_eq!(entries[0].left_line, Some(2));
    assert_eq!(entries[0].right_line, Some(2));
    assert_eq!(entries[0].changed_cols, vec![1]);
    assert_eq!(modified_count, 1);

    // Unequal block lengths fall back to removed + added
    let mut entries2 = Vec::new();
    let mut added_count2 = 0;
    let mut removed_count2 = 0;
    let mut modified_count2 = 0;
    emit_change_block(
      &mut entries2,
      &a,
      &b,
      &[],
      &[1],
      &[1, 2],
      &mut added_count2,
      &mut removed_count2,
      &mut modified_count2,
    );

    assert_eq!(entries2.len(), 3);
    assert_eq!(entries2[0].status, "removed");
    assert_eq!(
      entries2[0].left_cells,
      Some(vec!["2".to_string(), "old".to_string()])
    );
    assert_eq!(entries2[1].status, "added");
    assert_eq!(entries2[2].status, "added");
    assert_eq!(removed_count2, 1);
    assert_eq!(added_count2, 2);
    assert_eq!(modified_count2, 0);
  }

  #[test]
  fn diff_marks_removed_rows() {
    let mut pool = Interner::new();
    let (a, b) = build_tables(&mut pool, &[&["1", "a"], &["gone", "x"]], &[&["1", "a"]]);

    let mut entries = Vec::new();
    let mut added_count = 0;
    let mut removed_count = 0;
    let mut modified_count = 0;

    emit_change_block(
      &mut entries,
      &a,
      &b,
      &[],
      &[1],
      &[],
      &mut added_count,
      &mut removed_count,
      &mut modified_count,
    );

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].status, "removed");
    assert_eq!(entries[0].left_line, Some(2));
    assert_eq!(entries[0].right_line, None);
    assert_eq!(
      entries[0].left_cells,
      Some(vec!["gone".to_string(), "x".to_string()])
    );
    assert_eq!(removed_count, 1);
  }

  #[test]
  fn convert_encoding_utf8_to_gbk_roundtrip() {
    let dir = std::env::temp_dir();
    let input = dir.join("easy_csv_enc_in.csv");
    let output = dir.join("easy_csv_enc_out.csv");

    std::fs::write(&input, "name,value\ncaf\u{e9},1\n").unwrap();

    let result = std::fs::read(&input).unwrap();
    let (decoded, _, _) = encoding_rs::UTF_8.decode(&result);
    let (encoded, _, _) = encoding_rs::GBK.encode(&decoded);
    std::fs::write(&output, &encoded).unwrap();

    // GBK bytes are not valid UTF-8 for "café".
    let out_bytes = std::fs::read(&output).unwrap();
    assert!(String::from_utf8(out_bytes.clone()).is_err());

    // Round-trip back to UTF-8 and verify content.
    let (back, _, _) = encoding_rs::GBK.decode(&out_bytes);
    assert_eq!(back, "name,value\ncaf\u{e9},1\n");

    let _ = std::fs::remove_file(&input);
    let _ = std::fs::remove_file(&output);
  }

  #[test]
  fn stream_convert_handles_multibyte_chunk_boundaries() {
    // "姓名"/"地址" and "café" produce multi-byte sequences in GBK. Use a
    // tiny chunk size so a single character is guaranteed to span chunks.
    let text = "姓名,地址\ncaf\u{e9},1\n中文混合,ok\n";
    let (src_bytes, _, _) = encoding_rs::GBK.encode(text);

    let mut out = Vec::new();
    let (read, written) = stream_convert(
      encoding_rs::GBK,
      encoding_rs::UTF_8,
      &mut &src_bytes[..],
      &mut out,
      1,
    )
    .unwrap();

    assert_eq!(read, src_bytes.len());
    assert!(written > 0);
    assert_eq!(out, text.as_bytes());
  }

  #[test]
  fn stream_convert_large_ascii_passthrough() {
    // ASCII CSV should pass through byte-for-byte regardless of chunk size.
    let text = "id,name,value\n1,a,10\n2,b,20\n";
    let mut out = Vec::new();
    let (read, written) = stream_convert(
      encoding_rs::UTF_8,
      encoding_rs::UTF_8,
      &mut text.as_bytes(),
      &mut out,
      5,
    )
    .unwrap();

    assert_eq!(read, text.len());
    assert_eq!(written, text.len());
    assert_eq!(out, text.as_bytes());
  }

  #[test]
  fn resolve_encoding_supports_common_labels() {
    assert_eq!(resolve_encoding(ENCODING_GBK).unwrap(), encoding_rs::GBK);
    assert_eq!(
      resolve_encoding(ENCODING_GB18030).unwrap(),
      encoding_rs::GB18030
    );
    assert_eq!(resolve_encoding(ENCODING_UTF8).unwrap(), encoding_rs::UTF_8);
    assert_eq!(
      resolve_encoding(ENCODING_UTF16_LE).unwrap(),
      encoding_rs::UTF_16LE
    );
    assert_eq!(
      resolve_encoding(ENCODING_UTF16_BE).unwrap(),
      encoding_rs::UTF_16BE
    );
    assert_eq!(
      resolve_encoding(ENCODING_LATIN1).unwrap(),
      encoding_rs::WINDOWS_1252
    );
    assert!(resolve_encoding("bogus").is_err());
  }

  // separate_csv_inner

  #[test]
  fn separate_all_bad_rows_written_together() {
    // Regression: the original per-line parser dropped/lost consecutive bad
    // rows. `1,tom,man` is followed only by under-column rows, so the whole
    // run (including `1,tom,man`) lands in bad.
    let input = "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.expected_columns, 3);
    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 6);
    assert_eq!(out.good, "age,name,gender\n".as_bytes());
    assert_eq!(
      out.bad,
      "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n".as_bytes()
    );
  }

  #[test]
  fn separate_keeps_multiline_quoted_field_as_one_good_row() {
    // A quoted embedded newline is one record; since every record is clean,
    // everything stays good.
    let input = "a,b\n1,x\n2,\"hello\nworld\"\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    assert_eq!(out.good, "a,b\n1,x\n2,\"hello\nworld\"\n".as_bytes());
  }

  #[test]
  fn separate_captures_parse_error_rows_to_bad() {
    // Unterminated quote at EOF: the reader swallows to EOF as a single bad
    // record, which also pulls the preceding clean `1,2` into bad.
    let input = "a,b\n1,2\n\"oops\nx,ok\nlast,row\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert!(String::from_utf8_lossy(&out.bad).contains("oops\nx,ok"));
  }

  #[test]
  fn separate_ignores_blank_lines() {
    // csv treats blank lines as non-records; trailing empty lines are simply
    // skipped, not classified as bad.
    let input = "a,b\n1,2\n\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 1);
    assert_eq!(out.bad_rows, 0);
  }

  #[test]
  fn separate_handles_crlf() {
    let input = "a,b\r\n1,2\r\n3,4\r\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    // Output is canonically normalized to LF (re-serialized), not CRLF.
    assert_eq!(out.good, "a,b\n1,2\n3,4\n".as_bytes());
  }

  #[test]
  fn separate_empty_file_errors() {
    let err = separate_csv_inner(b"", b',', true, None, 0, false).unwrap_err();
    assert!(err.contains("empty") || err.contains("header"));
  }

  #[test]
  fn separate_expected_columns_override_pads_header() {
    // Override to 2 columns while header has 3: `1,2` matches, but `x,y,z`
    // (3 cols) is a malformed run that pulls `1,2` into bad too. The good
    // header is rebuilt to `expected` (truncate 3 → 2).
    let input = "a,b,c\n1,2\nx,y,z\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, Some(2), 0, false).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert_eq!(out.good, "a,b\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\n1,2\nx,y,z\n".as_bytes());
  }

  #[test]
  fn separate_skiprows_discards_junk_before_header() {
    let input = "junk line\nage,name\n1,tom\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 1, false).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 1);
    assert_eq!(out.good, "age,name\n1,tom\n".as_bytes());
  }

  #[test]
  fn separate_tsv_delimiter() {
    let input = "a\tb\n1\t2\n3\n";
    let out = separate_csv_inner(input.as_bytes(), b'\t', true, None, 0, false).unwrap();

    // `3` is a malformed run that pulls the preceding `1,2` into bad too.
    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert_eq!(out.good, "a\tb\n".as_bytes());
    assert_eq!(out.bad, "a\tb\n1\t2\n3\n".as_bytes());
  }

  #[test]
  fn separate_output_paths_formats_good_and_bad() {
    let (g, b) = separate_output_paths(r"C:\data\foo.csv", None);
    assert!(g.to_string_lossy().ends_with("foo_good.csv"));
    assert!(b.to_string_lossy().ends_with("foo_bad.csv"));

    let (g2, _) = separate_output_paths(r"C:\data\foo.csv", Some(r"D:\out"));
    assert!(g2.to_string_lossy().starts_with(r"D:\out"));
  }

  #[test]
  fn separate_group_bad_pulls_valid_looking_row_into_bad_run() {
    // group_bad=true and rows X(3), Y(1), Z(1): the clean-looking X is
    // immediately followed only by malformed rows, so X,Y,Z all go to bad.
    let input = "a,b,c\nx,1,2\ny\nz\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 3);
    assert_eq!(out.good, "a,b,c\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\nx,1,2\ny\nz\n".as_bytes());
  }

  #[test]
  fn separate_group_bad_keeps_later_clean_rows_good() {
    // After the bad run, a new clean row that is followed by another clean row
    // stays good: X(3),Y(1),Z(1) -> bad; D(3),E(3) -> good.
    let input = "a,b,c\nx,1,2\ny\nz\nd,1,2\ne,3,4\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 3);
    assert_eq!(out.good, "a,b,c\nd,1,2\ne,3,4\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\nx,1,2\ny\nz\n".as_bytes());
  }

  #[test]
  fn separate_group_bad_original_example_all_to_bad() {
    // The user's example: `1,tom,man` is followed only by malformed rows, so
    // every data row goes to bad and only the header stays in good.
    let input = "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 6);
    assert_eq!(out.good, "age,name,gender\n".as_bytes());
    assert_eq!(
      out.bad,
      "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n".as_bytes()
    );
  }

  #[test]
  fn separate_group_bad_clean_file_all_good() {
    // A fully clean file (every row matches, each followed by another match)
    // sends every row to good.
    let input = "a,b,c\n1,2,3\n4,5,6\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    assert_eq!(out.good, "a,b,c\n1,2,3\n4,5,6\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\n".as_bytes());
  }

  #[test]
  fn separate_group_bad_single_bad_taints_preceding() {
    // A malformed `x,y` pulls the preceding clean `1,2,3` into bad too.
    let out =
      separate_csv_inner("a,b,c\n1,2,3\nx,y\n".as_bytes(), b',', true, None, 0, false).unwrap();
    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert_eq!(out.bad, "a,b,c\n1,2,3\nx,y\n".as_bytes());
  }

  // ── separate_stream (streaming / large-file path) ────────────────────

  /// Run the streaming core into byte buffers so it can be compared with the
  /// in-memory core.
  fn separate_via_stream(
    input: &[u8],
    expected: Option<usize>,
    skiprows: usize,
    no_headers: bool,
  ) -> (Vec<u8>, Vec<u8>, usize, usize, usize) {
    let mut good: Vec<u8> = Vec::new();
    let mut bad: Vec<u8> = Vec::new();
    let counts = separate_stream(
      Cursor::new(input),
      b',',
      true,
      expected,
      skiprows,
      no_headers,
      &mut good,
      &mut bad,
    )
    .unwrap();
    (
      good,
      bad,
      counts.good_rows,
      counts.bad_rows,
      counts.expected_columns,
    )
  }

  /// The streaming path must be byte-for-byte equivalent to the in-memory path.
  fn assert_stream_matches_inner(
    input: &str,
    expected: Option<usize>,
    skiprows: usize,
    no_headers: bool,
  ) {
    let mem =
      separate_csv_inner(input.as_bytes(), b',', true, expected, skiprows, no_headers).unwrap();
    let (good, bad, good_rows, bad_rows, expected_columns) =
      separate_via_stream(input.as_bytes(), expected, skiprows, no_headers);
    assert_eq!(good, mem.good, "good bytes differ for {input:?}");
    assert_eq!(bad, mem.bad, "bad bytes differ for {input:?}");
    assert_eq!(good_rows, mem.good_rows, "good_rows differ for {input:?}");
    assert_eq!(bad_rows, mem.bad_rows, "bad_rows differ for {input:?}");
    assert_eq!(
      expected_columns, mem.expected_columns,
      "expected_columns differ for {input:?}"
    );
  }

  #[test]
  fn separate_stream_matches_in_memory_on_edge_cases() {
    let cases = [
      // Acceptance data: the whole run lands in bad.
      "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n",
      // Quoted embedded newline stays one record.
      "a,b\n1,x\n2,\"hello\nworld\"\n",
      // Unterminated quote swallowed to EOF.
      "a,b\n1,2\n\"oops\nx,ok\nlast,row\n",
      // Blank / trailing blank lines are not records.
      "a,b\n1,2\n\n",
      // CRLF input, LF output.
      "a,b\r\n1,2\r\n3,4\r\n",
      // Bad run then independent clean rows.
      "a,b,c\nx,1,2\ny\nz\nd,1,2\ne,3,4\n",
      // Junk line before the header (skiprows=1 below).
      "junk line\nage,name\n1,tom\n",
      // expected_columns override (Some(2) below).
      "a,b,c\n1,2\nx,y,z\n",
      // Single bad row taints the preceding clean row.
      "a,b,c\n1,2,3\nx,y\n",
      // Clean file, no data behind the header.
      "a,b,c\n",
    ];
    for input in cases {
      assert_stream_matches_inner(input, None, 0, false);
    }
    assert_stream_matches_inner("junk line\nage,name\n1,tom\n", None, 1, false);
    assert_stream_matches_inner("a,b,c\n1,2\nx,y,z\n", Some(2), 0, false);
  }

  #[test]
  fn separate_stream_matches_in_memory_on_large_input() {
    // ~5000 data rows mixing clean rows, under/over-column rows and quoted
    // embedded newlines: the two implementations must agree exactly.
    let mut input = String::from("a,b,c\n");
    for i in 0..5000 {
      match i % 5 {
        0 => input.push_str(&format!("{i},x,y\n")),
        1 => input.push_str(&format!("{i}\n")),
        2 => input.push_str(&format!("{i},x\n")),
        3 => input.push_str(&format!("{i},x,y,z\n")),
        _ => input.push_str(&format!("{i},\"x\ny\",z\n")),
      }
    }
    assert_stream_matches_inner(&input, None, 0, false);
  }

  #[test]
  fn separate_stream_empty_file_errors() {
    let err = separate_stream(
      Cursor::new(b"".as_slice()),
      b',',
      true,
      None,
      0,
      false,
      Vec::<u8>::new(),
      Vec::<u8>::new(),
    )
    .unwrap_err();
    assert!(err.contains("empty") || err.contains("header"));

    // Nothing left after skipping is an error too.
    let err = separate_stream(
      Cursor::new(b"junk\n".as_slice()),
      b',',
      true,
      None,
      2,
      false,
      Vec::<u8>::new(),
      Vec::<u8>::new(),
    )
    .unwrap_err();
    assert!(err.contains("skipping"), "{err}");
  }

  #[test]
  fn separate_stream_to_files_writes_both_outputs() {
    let dir = std::env::temp_dir();
    let tag = format!("easy_csv_sep_{}", std::process::id());
    let input_path = dir.join(format!("{tag}_in.csv"));
    let good_path = dir.join(format!("{tag}_good.csv"));
    let bad_path = dir.join(format!("{tag}_bad.csv"));
    std::fs::write(&input_path, "a,b\n1,2\n3\n").unwrap();

    let counts = separate_csv_to_files(
      input_path.to_str().unwrap(),
      &good_path,
      &bad_path,
      b',',
      true,
      None,
      0,
      false,
    )
    .unwrap();

    // `1,2` is followed only by the malformed `3`, so both go to bad.
    assert_eq!(counts.good_rows, 0);
    assert_eq!(counts.bad_rows, 2);
    assert_eq!(counts.expected_columns, 2);
    assert_eq!(std::fs::read_to_string(&good_path).unwrap(), "a,b\n");
    assert_eq!(std::fs::read_to_string(&bad_path).unwrap(), "a,b\n1,2\n3\n");

    for p in [&input_path, &good_path, &bad_path] {
      let _ = std::fs::remove_file(p);
    }
  }

  #[test]
  fn separate_stream_to_files_matches_in_memory_across_buffer_boundaries() {
    // Build an input larger than the 1 MiB streaming buffer so records are read
    // through several `BufReader` refills — including quoted fields whose
    // embedded newline straddles a chunk boundary — and check that both output
    // files are byte-identical to the in-memory implementation.
    let mut input = String::from("a,b,c\n");
    while input.len() < 3 << 20 {
      let i = input.len();
      input.push_str(&format!("{i},x,y\n")); // good
      input.push_str(&format!("{i},x,y,z\n")); // over-column
      input.push_str(&format!("{i},\"x\ny\",z\n")); // good, embedded newline
      input.push_str(&format!("{i}\n")); // under-column
    }
    let mem = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();

    let dir = std::env::temp_dir();
    let tag = format!("easy_csv_sep_big_{}", std::process::id());
    let input_path = dir.join(format!("{tag}_in.csv"));
    let good_path = dir.join(format!("{tag}_good.csv"));
    let bad_path = dir.join(format!("{tag}_bad.csv"));
    std::fs::write(&input_path, &input).unwrap();

    let counts = separate_csv_to_files(
      input_path.to_str().unwrap(),
      &good_path,
      &bad_path,
      b',',
      true,
      None,
      0,
      false,
    )
    .unwrap();

    assert_eq!(counts.good_rows, mem.good_rows);
    assert_eq!(counts.bad_rows, mem.bad_rows);
    assert_eq!(counts.expected_columns, mem.expected_columns);
    assert_eq!(std::fs::read(&good_path).unwrap(), mem.good);
    assert_eq!(std::fs::read(&bad_path).unwrap(), mem.bad);

    for p in [&input_path, &good_path, &bad_path] {
      let _ = std::fs::remove_file(p);
    }
  }

  #[test]
  fn separate_no_headers_treats_first_row_as_data() {
    // No header row is emitted; the first record joins normal classification.
    // `1,2` is followed only by the malformed `3`, so reach-back pulls it into
    // bad as well; `4,5` survives as good.
    let input = "1,2\n3\n4,5\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, true).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 1);
    assert_eq!(out.bad_rows, 2);
    assert_eq!(out.good, "4,5\n".as_bytes());
    assert_eq!(out.bad, "1,2\n3\n".as_bytes());
  }

  #[test]
  fn separate_no_headers_clean_file_all_good() {
    let input = "1,2,3\n4,5,6\n5,6,7\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, true).unwrap();

    assert_eq!(out.good_rows, 3);
    assert_eq!(out.bad_rows, 0);
    assert_eq!(out.good, "1,2,3\n4,5,6\n5,6,7\n".as_bytes());
    assert_eq!(out.bad, "".as_bytes());
  }

  #[test]
  fn separate_no_headers_with_expected_columns_override() {
    // expected=2 while the first (data) row has 3 columns: it goes to bad
    // directly; `1,2` stays good.
    let input = "x,y,z\n1,2\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, Some(2), 0, true).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 1);
    assert_eq!(out.bad_rows, 1);
    assert_eq!(out.good, "1,2\n".as_bytes());
    assert_eq!(out.bad, "x,y,z\n".as_bytes());
  }

  #[test]
  fn separate_no_headers_streaming_matches_in_memory() {
    let input = "1,2\n3\n4,5\n";
    let mem = separate_csv_inner(input.as_bytes(), b',', true, None, 0, true).unwrap();
    let (good, bad, good_rows, bad_rows, expected_columns) =
      separate_via_stream(input.as_bytes(), None, 0, true);
    assert_eq!(good, mem.good);
    assert_eq!(bad, mem.bad);
    assert_eq!(good_rows, mem.good_rows);
    assert_eq!(bad_rows, mem.bad_rows);
    assert_eq!(expected_columns, mem.expected_columns);
  }

  // split_lines (line-count split into *_partN files)

  /// In-memory `Write` that keeps its bytes in a shared buffer so a test can
  /// read back what [`split_lines_stream`] wrote to a part.
  #[derive(Clone, Default)]
  struct SharedBuf(std::rc::Rc<std::cell::RefCell<Vec<u8>>>);

  impl SharedBuf {
    fn text(&self) -> String {
      String::from_utf8(self.0.borrow().clone()).unwrap()
    }
  }

  impl Write for SharedBuf {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
      self.0.borrow_mut().extend_from_slice(buf);
      Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
      Ok(())
    }
  }

  /// Run the splitter in memory, collecting every part's content.
  fn split_lines_in_memory(
    input: &[u8],
    lines_per_file: usize,
    no_headers: bool,
  ) -> (Vec<String>, SplitLinesCounts) {
    let mut parts: Vec<SharedBuf> = Vec::new();
    let counts = split_lines_stream(Cursor::new(input), lines_per_file, no_headers, |index| {
      assert_eq!(index, parts.len() + 1, "parts must be numbered from 1");
      let buf = SharedBuf::default();
      parts.push(buf.clone());
      Ok(buf)
    })
    .unwrap();
    (parts.iter().map(SharedBuf::text).collect(), counts)
  }

  #[test]
  fn split_lines_writes_every_n_rows_and_copies_the_header() {
    let input = "id,name\n1,a\n2,b\n3,c\n4,d\n5,e\n";
    let (parts, counts) = split_lines_in_memory(input.as_bytes(), 2, false);

    assert_eq!(counts.file_count, 3);
    assert_eq!(counts.total_rows, 5);
    assert_eq!(
      parts,
      vec![
        "id,name\n1,a\n2,b\n".to_string(),
        "id,name\n3,c\n4,d\n".to_string(),
        "id,name\n5,e\n".to_string(),
      ]
    );
  }

  #[test]
  fn split_lines_no_headers_treats_the_first_line_as_data() {
    let input = "id,name\n1,a\n2,b\n3,c\n4,d\n5,e\n";
    let (parts, counts) = split_lines_in_memory(input.as_bytes(), 2, true);

    // Six data rows now (the first line counts), so 3 parts of 2 rows each.
    assert_eq!(counts.file_count, 3);
    assert_eq!(counts.total_rows, 6);
    assert_eq!(
      parts,
      vec![
        "id,name\n1,a\n".to_string(),
        "2,b\n3,c\n".to_string(),
        "4,d\n5,e\n".to_string(),
      ]
    );
  }

  #[test]
  fn split_lines_keeps_exactly_n_rows_per_part() {
    let (parts, counts) = split_lines_in_memory(b"h\n1\n2\n3\n4\n", 2, false);

    assert_eq!(counts.file_count, 2);
    assert_eq!(counts.total_rows, 4);
    assert_eq!(
      parts,
      vec!["h\n1\n2\n".to_string(), "h\n3\n4\n".to_string()]
    );
  }

  #[test]
  fn split_lines_single_part_when_rows_fit() {
    let (parts, counts) = split_lines_in_memory(b"h\n1\n2\n", 1000, false);

    assert_eq!(counts.file_count, 1);
    assert_eq!(counts.total_rows, 2);
    assert_eq!(parts, vec!["h\n1\n2\n".to_string()]);
  }

  #[test]
  fn split_lines_preserves_crlf_and_terminates_a_missing_final_newline() {
    let (parts, counts) = split_lines_in_memory(b"h\r\n1\r\n2", 5, false);

    assert_eq!(counts.file_count, 1);
    assert_eq!(counts.total_rows, 2);
    // CRLF survives; the unterminated last line gets a terminator.
    assert_eq!(parts, vec!["h\r\n1\r\n2\n".to_string()]);
  }

  #[test]
  fn split_lines_header_only_input_still_writes_one_part() {
    let (parts, counts) = split_lines_in_memory(b"id,name\n", 10, false);

    assert_eq!(counts.file_count, 1);
    assert_eq!(counts.total_rows, 0);
    assert_eq!(parts, vec!["id,name\n".to_string()]);
  }

  #[test]
  fn split_lines_rejects_degenerate_input() {
    let zero = split_lines_stream(Cursor::new(b"h\n1\n".as_slice()), 0, false, |_| {
      Ok(Vec::<u8>::new())
    })
    .unwrap_err();
    assert!(zero.contains("at least 1"), "{zero}");

    let empty = split_lines_stream(Cursor::new(b"".as_slice()), 10, false, |_| {
      Ok(Vec::<u8>::new())
    })
    .unwrap_err();
    assert!(empty.contains("empty"), "{empty}");
  }

  #[test]
  fn split_lines_reads_across_buffer_boundaries() {
    // A tiny `BufReader` capacity forces many refills, so lines are reassembled
    // from several reads.
    let mut input = String::from("h\n");
    for i in 0..500 {
      input.push_str(&format!("row-{i},aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n"));
    }

    let mut parts: Vec<SharedBuf> = Vec::new();
    let counts = split_lines_stream(
      BufReader::with_capacity(16, Cursor::new(input.as_bytes())),
      128,
      false,
      |_| {
        let buf = SharedBuf::default();
        parts.push(buf.clone());
        Ok(buf)
      },
    )
    .unwrap();

    assert_eq!(counts.total_rows, 500);
    assert_eq!(counts.file_count, 4);
    // Reassembling the parts (minus the header copied into each one) must give
    // back every row exactly once, in order.
    let joined: String = parts
      .iter()
      .map(|p| p.text().replace("h\n", ""))
      .collect::<Vec<_>>()
      .join("");
    let expected: String = input.lines().skip(1).map(|l| format!("{l}\n")).collect();
    assert_eq!(joined, expected);
  }

  #[test]
  fn split_lines_part_naming_preserves_the_extension() {
    assert_eq!(
      split_part_path(std::path::Path::new("/tmp/out"), "log", ".txt", 2)
        .to_string_lossy()
        .replace('\\', "/"),
      "/tmp/out/log_part2.txt"
    );
    assert_eq!(
      split_part_path(std::path::Path::new("/tmp/out"), "data", "", 1)
        .to_string_lossy()
        .replace('\\', "/"),
      "/tmp/out/data_part1"
    );
  }

  #[test]
  fn split_lines_target_defaults_next_to_the_input() {
    let (dir, stem, ext) = split_lines_target("/data/a/b.csv", None);
    assert_eq!(dir.to_string_lossy().replace('\\', "/"), "/data/a");
    assert_eq!(stem, "b");
    assert_eq!(ext, ".csv");

    let (dir, stem, ext) = split_lines_target("/data/a/b.txt", Some("/out"));
    assert_eq!(dir.to_string_lossy().replace('\\', "/"), "/out");
    assert_eq!(stem, "b");
    assert_eq!(ext, ".txt");
  }

  #[test]
  fn split_lines_to_files_matches_the_in_memory_layout() {
    let dir = std::env::temp_dir();
    let tag = format!("easy_csv_split_{}", std::process::id());
    let stem = format!("{tag}_in");
    let input_path = dir.join(format!("{stem}.txt"));
    std::fs::write(&input_path, "h\n1\n2\n3\n4\n5\n").unwrap();

    let (out_dir, resolved_stem, ext, counts) =
      split_lines_to_files(input_path.to_str().unwrap(), None, 2, false).unwrap();

    assert_eq!(counts.file_count, 3);
    assert_eq!(counts.total_rows, 5);
    assert_eq!(out_dir, dir);
    assert_eq!(resolved_stem, stem);
    assert_eq!(ext, ".txt");

    let first = split_part_path(&dir, &stem, ".txt", 1);
    assert_eq!(std::fs::read_to_string(&first).unwrap(), "h\n1\n2\n");
    let third = split_part_path(&dir, &stem, ".txt", 3);
    assert_eq!(std::fs::read_to_string(&third).unwrap(), "h\n5\n");

    for index in 1..=3 {
      let _ = std::fs::remove_file(split_part_path(&dir, &stem, ".txt", index));
    }
    let _ = std::fs::remove_file(&input_path);
  }

  #[test]
  fn split_lines_to_files_honours_out_dir_and_no_headers() {
    let dir = std::env::temp_dir();
    let tag = format!("easy_csv_split_out_{}", std::process::id());
    let stem = format!("{tag}_in");
    let input_path = dir.join(format!("{stem}.csv"));
    let out_dir = dir.join(format!("{tag}_out"));
    std::fs::write(&input_path, "1,a\n2,b\n3,c\n").unwrap();

    let (written_to, resolved_stem, ext, counts) = split_lines_to_files(
      input_path.to_str().unwrap(),
      Some(out_dir.to_str().unwrap()),
      2,
      true,
    )
    .unwrap();

    assert_eq!(written_to, out_dir);
    assert_eq!(resolved_stem, stem);
    assert_eq!(ext, ".csv");
    assert_eq!(counts.file_count, 2);
    assert_eq!(counts.total_rows, 3);
    assert_eq!(
      std::fs::read_to_string(split_part_path(&out_dir, &stem, ".csv", 1)).unwrap(),
      "1,a\n2,b\n"
    );
    assert_eq!(
      std::fs::read_to_string(split_part_path(&out_dir, &stem, ".csv", 2)).unwrap(),
      "3,c\n"
    );

    let _ = std::fs::remove_dir_all(&out_dir);
    let _ = std::fs::remove_file(&input_path);
  }

  // detect_delimiter / probe_csv_file

  fn detect(sample: &str, skiprows: usize) -> (Option<String>, String) {
    let (best, _, confidence, _) =
      detect_delimiter_with_fallback(sample.as_bytes(), true, skiprows);
    (
      best.map(|d| (d as char).to_string()),
      confidence.to_string(),
    )
  }

  fn candidate_of(sample: &str, delimiter: &str) -> DelimiterCandidate {
    score_delimiters(sample.as_bytes(), true, 0)
      .into_iter()
      .find(|c| c.delimiter == delimiter)
      .unwrap()
  }

  fn temp_csv(tag: &str, contents: &str) -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("easy_csv_{tag}_{}.csv", std::process::id()));
    std::fs::write(&path, contents).unwrap();
    path
  }

  #[test]
  fn detect_delimiter_picks_each_conventional_delimiter() {
    let cases = [
      ("a,b,c\n1,2,3\n", ","),
      ("a;b;c\n1;2;3\n", ";"),
      ("a\tb\tc\n1\t2\t3\n", "\t"),
      ("a|b|c\n1|2|3\n", "|"),
      ("a^b^c\n1^2^3\n", "^"),
    ];
    for (sample, expected) in cases {
      let (best, confidence) = detect(sample, 0);
      assert_eq!(best.as_deref(), Some(expected), "sample {sample:?}");
      assert_eq!(confidence, "high", "sample {sample:?}");
    }
  }

  #[test]
  fn detect_delimiter_handles_dirty_acceptance_data() {
    // 016 acceptance data: the body's dominant field count is 1 (4 of 7 rows are
    // single-field), so only the 3-column header can justify the comma.
    let sample = "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n";
    let (best, confidence) = detect(sample, 0);
    assert_eq!(best.as_deref(), Some(","));
    assert_eq!(confidence, "high");

    let comma = candidate_of(sample, ",");
    assert_eq!(comma.header_fields, 3);
    assert_eq!(comma.fields, 3);
    assert!(!comma.consistent, "body alone is inconsistent here");
  }

  #[test]
  fn detect_delimiter_ignores_delimiters_inside_quotes() {
    let (best, confidence) = detect("a,b\n1,\"x,y\"\n2,\"p,q\"\n", 0);
    assert_eq!(best.as_deref(), Some(","));
    assert_eq!(confidence, "high");
  }

  #[test]
  fn detect_delimiter_returns_none_for_single_column_files() {
    let (best, confidence) = detect("name\nAlice\nBob\n", 0);
    assert!(best.is_none());
    assert_eq!(confidence, "none");
    let candidates = score_delimiters(b"name\nAlice\nBob\n", true, 0);
    assert!(candidates.iter().all(|c| c.score < 0));
  }

  #[test]
  fn detect_delimiter_breaks_ties_by_field_count() {
    // Single line `a,b;c;d;e`: `,` yields 2 fields and `;` yields 4, both
    // explaining the header, so their scores tie — the richer split wins.
    let (best, confidence) = detect("a,b;c;d;e\n", 0);
    assert_eq!(best.as_deref(), Some(";"));
    assert_eq!(confidence, "low");
  }

  #[test]
  fn detect_delimiter_marks_body_only_evidence_low() {
    // Single-column file whose values contain commas: only the body explains
    // the delimiter, so the result is flagged for user review.
    let (best, confidence) = detect("name\n1,5\n2,3\n", 0);
    assert_eq!(best.as_deref(), Some(","));
    assert_eq!(confidence, "low");
  }

  #[test]
  fn detect_delimiter_skips_records_before_the_header() {
    let (best, confidence) = detect("# note\n# note2\na;b\n1;2\n", 2);
    assert_eq!(best.as_deref(), Some(";"));
    assert_eq!(confidence, "high");
  }

  #[test]
  fn detect_delimiter_ignores_the_file_extension() {
    // Plenty of CSVs are named `.csv` while using `;`/`|`/tab, so the extension
    // must carry no weight: `a|b;c` is consistently read as `;` (2 columns)
    // whatever the file is called.
    for ext in ["csv", "psv", "tsv", "txt"] {
      let path =
        std::env::temp_dir().join(format!("easy_csv_ext_{ext}_{}.{ext}", std::process::id()));
      std::fs::write(&path, "a|b;c\n1|2;3\n").unwrap();

      let probe = probe_csv_sync(path.to_str().unwrap(), None, None, 0, true, None).unwrap();
      assert_eq!(probe.delimiter, ";", "extension {ext}");
      assert_eq!(probe.source, PROBE_SOURCE_DETECTED, "extension {ext}");
      assert_eq!(probe.columns, 2, "extension {ext}");

      let _ = std::fs::remove_file(&path);
    }
  }

  #[test]
  fn detect_delimiter_retries_without_quoting() {
    // An unterminated quote makes the quoting-aware parser swallow the whole
    // sample into one field, leaving no viable candidate — the second pass
    // without quoting recovers the real delimiter.
    let sample = "\"a;b\n1;2\n3;4\n";
    let (best, _, confidence, quoting_used) =
      detect_delimiter_with_fallback(sample.as_bytes(), true, 0);
    assert_eq!(best, Some(b';'));
    assert_eq!(confidence, "high");
    assert!(!quoting_used);

    // Already quoting-free: no second pass is attempted.
    let (best, _, _, quoting_used) = detect_delimiter_with_fallback(sample.as_bytes(), false, 0);
    assert_eq!(best, Some(b';'));
    assert!(!quoting_used);
  }

  #[test]
  fn probe_reports_first_row_columns_matching_separate_expected() {
    let input = "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n";
    let path = temp_csv("probe_cols", input);
    let probe = probe_csv_sync(path.to_str().unwrap(), None, None, 0, true, Some(2)).unwrap();

    assert_eq!(probe.columns, 3);
    assert_eq!(probe.header.join(","), "age,name,gender");
    assert_eq!(probe.delimiter, ",");
    assert_eq!(probe.source, PROBE_SOURCE_DETECTED);
    assert_eq!(probe.confidence, "high");
    assert_eq!(probe.sample_rows.len(), 2);
    assert_eq!(probe.sample_rows[0].join("|"), "1|tom|man");
    assert!(!probe.truncated);
    assert!(probe.quoting_used);

    // Same source of truth as the split's automatic `expected`.
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0, false).unwrap();
    assert_eq!(out.expected_columns, probe.columns);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn probe_forced_delimiter_skips_detection() {
    let path = temp_csv("probe_forced", "a;b\n1;2\n");
    let probe = probe_csv_sync(path.to_str().unwrap(), Some(";"), None, 0, true, None).unwrap();

    assert_eq!(probe.source, PROBE_SOURCE_FORCED);
    assert_eq!(probe.delimiter, ";");
    assert_eq!(probe.confidence, "high");
    assert!(probe.candidates.is_empty());
    assert_eq!(probe.columns, 2);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn probe_falls_back_to_the_default_delimiter() {
    let path = temp_csv("probe_fallback", "name\nAlice\nBob\n");

    let probe = probe_csv_sync(path.to_str().unwrap(), None, Some(";"), 0, true, None).unwrap();
    assert_eq!(probe.source, PROBE_SOURCE_FALLBACK);
    assert_eq!(probe.confidence, "none");
    assert_eq!(probe.delimiter, ";");
    assert_eq!(probe.columns, 1);

    // No fallback given → comma.
    let probe = probe_csv_sync(path.to_str().unwrap(), None, None, 0, true, None).unwrap();
    assert_eq!(probe.delimiter, ",");
    assert_eq!(probe.source, PROBE_SOURCE_FALLBACK);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn probe_errors_match_separate_csv() {
    let empty = temp_csv("probe_empty", "");
    let err = probe_csv_sync(empty.to_str().unwrap(), None, None, 0, true, None).unwrap_err();
    assert!(err.contains("empty") || err.contains("header"), "{err}");
    let _ = std::fs::remove_file(&empty);

    let junk = temp_csv("probe_skiprows", "junk\n");
    let err = probe_csv_sync(junk.to_str().unwrap(), None, None, 3, true, None).unwrap_err();
    assert!(err.contains("skipping"), "{err}");
    let _ = std::fs::remove_file(&junk);

    let missing = std::env::temp_dir().join("easy_csv_probe_missing_file.csv");
    let _ = std::fs::remove_file(&missing);
    let err = probe_csv_sync(missing.to_str().unwrap(), None, None, 0, true, None).unwrap_err();
    assert!(err.contains("Failed to open"), "{err}");
  }

  #[test]
  fn probe_truncated_sample_drops_incomplete_tail() {
    // Sample larger than the 64 KiB probe window, ending without a newline.
    let mut input = String::from("a,b\n");
    while input.len() < PROBE_SAMPLE_BYTES + 1024 {
      input.push_str("1,2\n");
    }
    input.push_str("9,9,9,9,9");
    let path = temp_csv("probe_truncated", &input);

    let probe = probe_csv_sync(path.to_str().unwrap(), None, None, 0, true, Some(1)).unwrap();
    assert!(probe.truncated);
    assert_eq!(probe.delimiter, ",");
    assert_eq!(probe.columns, 2);
    assert_eq!(probe.sampled_records, PROBE_SAMPLE_RECORDS);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_auto_detects_the_delimiter() {
    let path = temp_csv("read_auto_semicolon", "a;b;c\n1;2;3\n4;5;6\n");
    let data = read_csv_sync(path.to_str().unwrap(), None, None, None).unwrap();

    assert_eq!(data.delimiter, ";");
    assert_eq!(data.delimiter_source, PROBE_SOURCE_DETECTED);
    assert_eq!(data.delimiter_confidence, "high");
    assert_eq!(data.columns, 3);
    assert_eq!(data.headers, vec!["a", "b", "c"]);
    assert_eq!(data.rows.len(), 2);
    assert_eq!(data.rows[0], vec!["1", "2", "3"]);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_forced_delimiter_skips_detection() {
    // Comma separated content read with a forced `;`: detection must not
    // override the caller, even though the sample clearly says `,`.
    let path = temp_csv("read_forced", "a,b\n1,2\n");
    let data = read_csv_sync(path.to_str().unwrap(), Some(";"), None, None).unwrap();

    assert_eq!(data.delimiter_source, PROBE_SOURCE_FORCED);
    assert_eq!(data.delimiter_confidence, "high");
    assert_eq!(data.delimiter, ";");
    assert_eq!(data.columns, 1);
    assert_eq!(data.headers, vec!["a,b"]);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_empty_delimiter_falls_back_to_detection() {
    // Regression: an empty delimiter used to index `as_bytes()[0]` and panic.
    let path = temp_csv("read_empty_delim", "a;b\n1;2\n");
    let data = read_csv_sync(path.to_str().unwrap(), Some(""), Some(","), None).unwrap();

    assert_eq!(data.delimiter, ";");
    assert_eq!(data.delimiter_source, PROBE_SOURCE_DETECTED);
    assert_eq!(data.columns, 2);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_falls_back_when_detection_is_inconclusive() {
    let path = temp_csv("read_fallback", "name\nAlice\nBob\n");

    // Explicit fallback wins over the built-in `,`.
    let data = read_csv_sync(path.to_str().unwrap(), None, Some(";"), None).unwrap();
    assert_eq!(data.delimiter_source, PROBE_SOURCE_FALLBACK);
    assert_eq!(data.delimiter_confidence, "none");
    assert_eq!(data.delimiter, ";");
    assert_eq!(data.columns, 1);

    // No fallback given → comma.
    let data = read_csv_sync(path.to_str().unwrap(), None, None, None).unwrap();
    assert_eq!(data.delimiter, ",");
    assert_eq!(data.delimiter_source, PROBE_SOURCE_FALLBACK);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_delimiter_matches_probe_csv_file() {
    // Both entry points must resolve the same file to the same delimiter, or
    // the split dialog and the preview table would disagree.
    for (tag, contents, expected) in [
      ("same_comma", "a,b\n1,2\n", ","),
      ("same_semicolon", "a;b\n1;2\n", ";"),
      ("same_tab", "a\tb\n1\t2\n", "\t"),
      ("same_single", "name\nAlice\n", ","),
    ] {
      let path = temp_csv(tag, contents);
      let data = read_csv_sync(path.to_str().unwrap(), None, None, None).unwrap();
      let probe = probe_csv_sync(path.to_str().unwrap(), None, None, 0, true, None).unwrap();

      assert_eq!(data.delimiter, expected, "{tag}");
      assert_eq!(probe.delimiter, data.delimiter, "{tag}");
      assert_eq!(probe.columns, data.columns, "{tag}");

      let _ = std::fs::remove_file(&path);
    }
  }

  #[test]
  fn read_csv_rejects_ragged_rows() {
    // Known limitation (design 018 §6): the preview reader is rigid, so a file
    // whose rows do not match the header's field count fails to preview even
    // though the delimiter was detected correctly. Locked in so a future change
    // to `flexible(true)` is a deliberate one.
    let path = temp_csv("read_ragged", "age,name,gender\n1,tom,man\n2\n2.1\n");
    let err = read_csv_sync(path.to_str().unwrap(), None, None, None).unwrap_err();
    assert!(err.contains("Failed to read row"), "{err}");

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_honours_the_row_limit() {
    let path = temp_csv("read_limit", "a,b\n1,2\n3,4\n5,6\n");

    let head_only = read_csv_sync(path.to_str().unwrap(), None, None, Some(0)).unwrap();
    assert_eq!(head_only.headers, vec!["a", "b"]);
    assert!(head_only.rows.is_empty());

    let limited = read_csv_sync(path.to_str().unwrap(), None, None, Some(2)).unwrap();
    assert_eq!(limited.rows.len(), 2);

    // Default limit is 51 rows.
    let default_limited = read_csv_sync(path.to_str().unwrap(), None, None, None).unwrap();
    assert_eq!(default_limited.rows.len(), 3);

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn read_csv_reports_a_missing_file() {
    let missing = std::env::temp_dir().join("easy_csv_read_missing_file.csv");
    let _ = std::fs::remove_file(&missing);
    let err = read_csv_sync(missing.to_str().unwrap(), None, None, None).unwrap_err();
    assert!(err.contains("Failed to open"), "{err}");
  }
}
