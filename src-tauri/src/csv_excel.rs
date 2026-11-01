//! CSV → XLSX conversion.
//!
//! Two output shapes share one streaming pipeline:
//! - `multi = false`: every data row lands on one worksheet (Excel's hard
//!   1,048,576-row limit applies and is reported as an error);
//! - `multi = true`: the data rows are chunked into several worksheets of
//!   `chunk_size` rows each (header repeated on every sheet), so files larger
//!   than a single sheet can still be opened.
//!
//! Reading mirrors the other file tools (`has_headers(false)` so `skiprows`
//! runs before the header and the first data row is never swallowed), and
//! writing goes through `rust_xlsxwriter` — the same writer `excel_merge`
//! uses — on the blocking pool.

use std::fs::File;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use std::time::Instant;

use serde::Serialize;

use crate::csv::resolve_read_delimiter;

/// Excel's hard sheet limits.
const EXCEL_MAX_ROWS: usize = 1_048_576;
const EXCEL_MAX_COLUMNS: usize = 16_384;
/// Rows available for data once the repeated header takes row 1.
const MAX_DATA_ROWS_PER_SHEET: usize = EXCEL_MAX_ROWS - 1;
/// Rows per worksheet when the caller does not pick a size.
const DEFAULT_CHUNK_SIZE: usize = 100_000;
const BUF_SIZE: usize = 1 << 20;

#[derive(Debug, Serialize)]
pub struct CsvToXlsxResult {
  pub output_path: String,
  pub sheet_count: usize,
  pub total_rows: usize,
  pub columns: usize,
  pub multi: bool,
  pub chunk_size: usize,
  pub delimiter: String,
  pub elapsed_ms: u64,
}

/// `{stem}.xlsx` next to the input, or inside `out_dir` when one is given.
pub(crate) fn csv_to_xlsx_output_path(path: &str, out_dir: Option<&str>) -> PathBuf {
  let source = Path::new(path);
  let stem = source
    .file_stem()
    .map(|s| s.to_string_lossy().into_owned())
    .unwrap_or_else(|| "output".to_string());
  let file_name = format!("{stem}.xlsx");

  match out_dir.map(str::trim).filter(|dir| !dir.is_empty()) {
    Some(dir) => Path::new(dir).join(file_name),
    None => source.with_file_name(file_name),
  }
}

/// Stream `input` into `output`, returning
/// `(total data rows, sheet count, column count)`.
fn write_csv_as_xlsx<R: Read>(
  input: R,
  delimiter: u8,
  quoting: bool,
  flexible: bool,
  skiprows: usize,
  multi: bool,
  chunk_size: usize,
  output: &Path,
) -> Result<(usize, usize, usize), String> {
  let mut rdr = csv::ReaderBuilder::new()
    .has_headers(false)
    .delimiter(delimiter)
    .quoting(quoting)
    .flexible(flexible)
    .from_reader(input);

  let mut record = csv::ByteRecord::new();
  for row in 0..skiprows {
    if !rdr
      .read_byte_record(&mut record)
      .map_err(|e| format!("Failed to skip row {}: {e}", row + 1))?
    {
      return Err(format!(
        "skiprows is {skiprows}, but the file has fewer than {skiprows} rows"
      ));
    }
  }

  if !rdr
    .read_byte_record(&mut record)
    .map_err(|e| format!("Failed to read header: {e}"))?
  {
    return Err("The file is empty (no header row to convert)".to_string());
  }
  let header = record.clone();
  if header.len() > EXCEL_MAX_COLUMNS {
    return Err(format!(
      "The header has {} columns; Excel supports at most {EXCEL_MAX_COLUMNS}",
      header.len()
    ));
  }

  let mut workbook = rust_xlsxwriter::Workbook::new();
  let mut total_rows = 0usize;
  let mut sheet_count = 0usize;
  let rows_per_sheet = if multi {
    chunk_size
  } else {
    MAX_DATA_ROWS_PER_SHEET
  };

  loop {
    let worksheet = workbook.add_worksheet();
    sheet_count += 1;
    for (column, value) in header.iter().enumerate() {
      let text = std::str::from_utf8(value)
        .map_err(|_| format!("Header column {} is not valid UTF-8", column + 1))?;
      worksheet
        .write_string(0, column as u16, text)
        .map_err(|e| format!("Failed to write the header: {e}"))?;
    }

    let mut rows_on_sheet = 0usize;
    let mut eof = false;
    while rows_on_sheet < rows_per_sheet {
      if !rdr
        .read_byte_record(&mut record)
        .map_err(|e| format!("Failed to read row {}: {e}", total_rows + 2))?
      {
        eof = true;
        break;
      }
      total_rows += 1;
      rows_on_sheet += 1;
      if record.len() > EXCEL_MAX_COLUMNS {
        return Err(format!(
          "Row {} has {} columns; Excel supports at most {EXCEL_MAX_COLUMNS}",
          total_rows + 1,
          record.len()
        ));
      }

      for (column, value) in record.iter().enumerate() {
        let text = std::str::from_utf8(value).map_err(|_| {
          format!(
            "Row {}, column {} is not valid UTF-8; convert the file to UTF-8 first",
            total_rows + 1,
            column + 1
          )
        })?;
        worksheet
          .write_string(rows_on_sheet as u32, column as u16, text)
          .map_err(|e| {
            format!(
              "Failed to write row {} (column {}): {e}",
              total_rows + 1,
              column + 1
            )
          })?;
      }
    }

    if eof {
      break;
    }
    if !multi {
      return Err(format!(
        "The file has more than {MAX_DATA_ROWS_PER_SHEET} data rows, which a single Excel sheet cannot hold. Enable split mode to write several sheets."
      ));
    }
  }

  workbook
    .save(output)
    .map_err(|e| format!("Failed to write {}: {e}", output.display()))?;

  Ok((total_rows, sheet_count, header.len()))
}

#[tauri::command]
pub async fn csv_to_xlsx(
  path: String,
  multi: Option<bool>,
  chunk_size: Option<usize>,
  skiprows: Option<usize>,
  quoting: Option<bool>,
  flexible: Option<bool>,
  delimiter: Option<String>,
  out_dir: Option<String>,
) -> Result<CsvToXlsxResult, String> {
  tokio::task::spawn_blocking(move || -> Result<CsvToXlsxResult, String> {
    let started = Instant::now();
    let multi = multi.unwrap_or(false);
    let chunk_size = chunk_size.unwrap_or(DEFAULT_CHUNK_SIZE);
    if multi && chunk_size == 0 {
      return Err("Rows per sheet must be at least 1".to_string());
    }
    if multi && chunk_size > MAX_DATA_ROWS_PER_SHEET {
      return Err(format!(
        "Rows per sheet must not exceed {MAX_DATA_ROWS_PER_SHEET} (Excel's row limit minus the header)"
      ));
    }

    let delimiter = match delimiter
      .as_deref()
      .map(str::trim)
      .filter(|value| !value.is_empty())
    {
      Some(value) => value.as_bytes()[0],
      None => resolve_read_delimiter(&path, None, None)?.0,
    };

    let output_path = csv_to_xlsx_output_path(&path, out_dir.as_deref());
    if let Some(parent) = output_path.parent() {
      if !parent.as_os_str().is_empty() {
        std::fs::create_dir_all(parent)
          .map_err(|e| format!("Failed to create {}: {e}", parent.display()))?;
      }
    }

    let file = File::open(&path).map_err(|e| format!("Failed to open {path}: {e}"))?;
    let (total_rows, sheet_count, columns) = write_csv_as_xlsx(
      BufReader::with_capacity(BUF_SIZE, file),
      delimiter,
      quoting.unwrap_or(true),
      flexible.unwrap_or(false),
      skiprows.unwrap_or(0),
      multi,
      chunk_size,
      &output_path,
    )?;

    Ok(CsvToXlsxResult {
      output_path: output_path.to_string_lossy().into_owned(),
      sheet_count,
      total_rows,
      columns,
      multi,
      chunk_size,
      delimiter: (delimiter as char).to_string(),
      elapsed_ms: started.elapsed().as_millis() as u64,
    })
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Cursor;

  fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("easy_csv_xlsx_{}_{label}.xlsx", std::process::id()))
  }

  fn write_memory(
    label: &str,
    input: &[u8],
    multi: bool,
    chunk: usize,
    skiprows: usize,
  ) -> (PathBuf, usize, usize) {
    let path = temp_path(label);
    let (rows, sheets, _) = write_csv_as_xlsx(
      Cursor::new(input),
      b',',
      true,
      true,
      skiprows,
      multi,
      chunk,
      &path,
    )
    .unwrap();
    (path, rows, sheets)
  }

  #[test]
  fn csv_to_xlsx_writes_one_sheet_and_keeps_the_first_data_row() {
    let input = b"name,group\naone,x\nbtwo,y\n";
    let (path, rows, sheets) = write_memory("one_sheet", input, false, 0, 0);
    assert_eq!(rows, 2);
    assert_eq!(sheets, 1);
    assert!(std::fs::metadata(&path).unwrap().len() > 0);
    let _ = std::fs::remove_file(path);
  }

  #[test]
  fn csv_to_xlsx_multi_splits_rows_and_repeats_the_header() {
    let input = b"name,group\n1,x\n2,x\n3,x\n4,x\n5,x\n";
    let (path, rows, sheets) = write_memory("multi_sheet", input, true, 2, 0);
    assert_eq!(rows, 5);
    assert_eq!(sheets, 3);
    let _ = std::fs::remove_file(path);
  }

  #[test]
  fn csv_to_xlsx_skiprows_runs_before_the_header() {
    let input = b"preamble\nname,group\n1,x\n";
    let (path, rows, sheets) = write_memory("skiprows", input, false, 0, 1);
    assert_eq!(rows, 1);
    assert_eq!(sheets, 1);
    let _ = std::fs::remove_file(path);
  }

  #[test]
  fn csv_to_xlsx_header_only_files_still_produce_one_sheet() {
    let (path, rows, sheets) = write_memory("header_only", b"name,group\n", false, 0, 0);
    assert_eq!(rows, 0);
    assert_eq!(sheets, 1);
    let _ = std::fs::remove_file(path);
  }

  #[test]
  fn csv_to_xlsx_output_path_uses_the_stem_and_optional_dir() {
    assert_eq!(
      csv_to_xlsx_output_path("/data/orders.csv", None),
      PathBuf::from("/data/orders.xlsx")
    );
    assert_eq!(
      csv_to_xlsx_output_path("/data/orders.csv", Some(" /out ")),
      PathBuf::from("/out/orders.xlsx")
    );
    assert_eq!(
      csv_to_xlsx_output_path("/data/orders.csv", Some("")),
      PathBuf::from("/data/orders.xlsx")
    );
  }
}
