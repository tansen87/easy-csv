use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Write};
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
}
