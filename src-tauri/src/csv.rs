use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter, Cursor, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::xan::find_xan_executable;

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
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

#[tauri::command]
pub async fn read_csv_file(
  file_path: String,
  delimiter: String,
  limit: Option<usize>,
) -> Result<CsvData, String> {
  let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;

  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(delimiter.as_bytes()[0])
    .from_reader(BufReader::new(file));

  let headers = rdr
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

  Ok(CsvData { headers, rows })
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

    gw.write_byte_record(&good_hdr)
      .map_err(|e| format!("Failed to write good header: {e}"))?;
    bw.write_byte_record(&header_rec)
      .map_err(|e| format!("Failed to write bad header: {e}"))?;

    // Reach-back grouping, streamed. `pending_good` holds the last
    // valid-looking row: it goes to good as soon as another valid row shows up,
    // and to bad as soon as a malformed row shows up.
    let mut pending_good: Option<csv::ByteRecord> = None;

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
) -> Result<SeparateOutput, String> {
  let mut good = Vec::with_capacity(input.len() / 2);
  let mut bad = Vec::with_capacity(input.len() / 2);

  let counts = separate_stream(
    Cursor::new(input),
    delimiter,
    quoting,
    expected_columns,
    skiprows,
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
#[tauri::command]
pub async fn separate_csv(
  path: String,
  delimiter: String,
  quoting: bool,
  expected_columns: Option<String>,
  skiprows: usize,
  out_dir: Option<String>,
  streaming: Option<bool>,
) -> Result<SeparateResult, String> {
  tokio::task::spawn_blocking(move || -> Result<SeparateResult, String> {
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

    let counts = if streaming.unwrap_or(false) {
      separate_csv_to_files(
        &path, &good_path, &bad_path, delim, quoting, expected, skiprows,
      )?
    } else {
      let input = std::fs::read(&path).map_err(|e| format!("Failed to read input file: {e}"))?;
      let out = separate_csv_inner(&input, delim, quoting, expected, skiprows)?;
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
    })
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

  // ── separate_csv_inner ──────────────────────────────────────────────

  #[test]
  fn separate_all_bad_rows_written_together() {
    // Regression: the original per-line parser dropped/lost consecutive bad
    // rows. `1,tom,man` is followed only by under-column rows, so the whole
    // run (including `1,tom,man`) lands in bad.
    let input = "age,name,gender\n1,tom,man\n2\n2.1\n2.3\n3,jerry\n4\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

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
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    assert_eq!(out.good, "a,b\n1,x\n2,\"hello\nworld\"\n".as_bytes());
  }

  #[test]
  fn separate_captures_parse_error_rows_to_bad() {
    // Unterminated quote at EOF: the reader swallows to EOF as a single bad
    // record, which also pulls the preceding clean `1,2` into bad.
    let input = "a,b\n1,2\n\"oops\nx,ok\nlast,row\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert!(String::from_utf8_lossy(&out.bad).contains("oops\nx,ok"));
  }

  #[test]
  fn separate_ignores_blank_lines() {
    // csv treats blank lines as non-records; trailing empty lines are simply
    // skipped, not classified as bad.
    let input = "a,b\n1,2\n\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

    assert_eq!(out.good_rows, 1);
    assert_eq!(out.bad_rows, 0);
  }

  #[test]
  fn separate_handles_crlf() {
    let input = "a,b\r\n1,2\r\n3,4\r\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    // Output is canonically normalized to LF (re-serialized), not CRLF.
    assert_eq!(out.good, "a,b\n1,2\n3,4\n".as_bytes());
  }

  #[test]
  fn separate_empty_file_errors() {
    let err = separate_csv_inner(b"", b',', true, None, 0).unwrap_err();
    assert!(err.contains("empty") || err.contains("header"));
  }

  #[test]
  fn separate_expected_columns_override_pads_header() {
    // Override to 2 columns while header has 3: `1,2` matches, but `x,y,z`
    // (3 cols) is a malformed run that pulls `1,2` into bad too. The good
    // header is rebuilt to `expected` (truncate 3 → 2).
    let input = "a,b,c\n1,2\nx,y,z\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, Some(2), 0).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 0);
    assert_eq!(out.bad_rows, 2);
    assert_eq!(out.good, "a,b\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\n1,2\nx,y,z\n".as_bytes());
  }

  #[test]
  fn separate_skiprows_discards_junk_before_header() {
    let input = "junk line\nage,name\n1,tom\n";
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 1).unwrap();

    assert_eq!(out.expected_columns, 2);
    assert_eq!(out.good_rows, 1);
    assert_eq!(out.good, "age,name\n1,tom\n".as_bytes());
  }

  #[test]
  fn separate_tsv_delimiter() {
    let input = "a\tb\n1\t2\n3\n";
    let out = separate_csv_inner(input.as_bytes(), b'\t', true, None, 0).unwrap();

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
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

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
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

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
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

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
    let out = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

    assert_eq!(out.good_rows, 2);
    assert_eq!(out.bad_rows, 0);
    assert_eq!(out.good, "a,b,c\n1,2,3\n4,5,6\n".as_bytes());
    assert_eq!(out.bad, "a,b,c\n".as_bytes());
  }

  #[test]
  fn separate_group_bad_single_bad_taints_preceding() {
    // A malformed `x,y` pulls the preceding clean `1,2,3` into bad too.
    let out = separate_csv_inner("a,b,c\n1,2,3\nx,y\n".as_bytes(), b',', true, None, 0).unwrap();
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
  ) -> (Vec<u8>, Vec<u8>, usize, usize, usize) {
    let mut good: Vec<u8> = Vec::new();
    let mut bad: Vec<u8> = Vec::new();
    let counts = separate_stream(
      Cursor::new(input),
      b',',
      true,
      expected,
      skiprows,
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
  fn assert_stream_matches_inner(input: &str, expected: Option<usize>, skiprows: usize) {
    let mem = separate_csv_inner(input.as_bytes(), b',', true, expected, skiprows).unwrap();
    let (good, bad, good_rows, bad_rows, expected_columns) =
      separate_via_stream(input.as_bytes(), expected, skiprows);
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
      assert_stream_matches_inner(input, None, 0);
    }
    assert_stream_matches_inner("junk line\nage,name\n1,tom\n", None, 1);
    assert_stream_matches_inner("a,b,c\n1,2\nx,y,z\n", Some(2), 0);
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
    assert_stream_matches_inner(&input, None, 0);
  }

  #[test]
  fn separate_stream_empty_file_errors() {
    let err = separate_stream(
      Cursor::new(b"".as_slice()),
      b',',
      true,
      None,
      0,
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
    let mem = separate_csv_inner(input.as_bytes(), b',', true, None, 0).unwrap();

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
}
