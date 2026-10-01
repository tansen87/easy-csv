//! Built-in sample data for first-run onboarding.
//!
//! The CSV is embedded with `include_str!` so the app ships no extra resource
//! files, and written next to the other per-user data (`templates/`,
//! `versions/`, `plugins/`) on first use. Writing is **idempotent**: an
//! existing file is never overwritten, so a user who edits or replaces the
//! sample keeps their version.
//!
//! The sample deliberately contains dirty rows (4 empty amounts, 1 empty
//! region, 2 exact duplicate rows) so the built-in demo pipeline has something
//! to clean. Every dirty amount is *empty* rather than a non-numeric string
//! like `N/A`: `xan groupby` aborts on a non-numeric value (`cannot safely cast
//! Bytes("N/A") … to type "number"`), which would make the very first thing a
//! new user runs fail.
//!
//! Line endings are pinned to LF by `.gitattributes`: `include_str!` embeds the
//! *working-tree* bytes, so a CRLF checkout would silently change what users
//! get. `embedded_sample_has_expected_shape` guards that.

use std::path::{Path, PathBuf};

use crate::config::get_resources_dir;

const SAMPLE_CSV: &str = include_str!("../samples/easy-csv-sample-sales.csv");

/// File name inside `<data dir>/samples/`.
pub const SAMPLE_FILE_NAME: &str = "easy-csv-sample-sales.csv";

/// Write the embedded sample under `base_dir` when it is missing and return its
/// path. Split out from the command so tests can point it at a throwaway
/// directory instead of the real (or `cfg!(test)`) data directory.
pub fn ensure_sample_data_in(base_dir: &Path) -> Result<PathBuf, String> {
  let samples_dir = base_dir.join("samples");
  let path = samples_dir.join(SAMPLE_FILE_NAME);

  if path.is_file() {
    return Ok(path);
  }

  std::fs::create_dir_all(&samples_dir)
    .map_err(|e| format!("Failed to create samples directory: {}", e))?;
  std::fs::write(&path, SAMPLE_CSV).map_err(|e| format!("Failed to write sample data: {}", e))?;

  Ok(path)
}

/// Resolve `<data dir>/samples/<SAMPLE_FILE_NAME>`, writing the embedded copy
/// when it is missing. Returns the absolute path.
#[tauri::command]
pub async fn ensure_sample_data() -> Result<String, String> {
  ensure_sample_data_in(&get_resources_dir()).map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  /// A throwaway directory per test, so the three tests below cannot race on a
  /// shared path.
  fn temp_dir(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("easycsv-samples-test-{}", label));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).expect("create temp dir");
    dir
  }

  /// The embedded fixture must keep the shape the demo pipeline relies on:
  /// a header, ~220 data rows, five columns, LF only.
  #[test]
  fn embedded_sample_has_expected_shape() {
    assert!(
      SAMPLE_CSV.starts_with("日期,地区,品类,金额,数量\n"),
      "unexpected header: {:?}",
      &SAMPLE_CSV[..SAMPLE_CSV.len().min(40)]
    );
    assert!(
      !SAMPLE_CSV.contains('\r'),
      "sample data must stay LF-only — see .gitattributes"
    );

    let lines: Vec<&str> = SAMPLE_CSV.lines().collect();
    assert!(
      lines.len() > 200,
      "expected >200 lines, got {}",
      lines.len()
    );

    for (i, line) in lines.iter().enumerate() {
      // Dirty rows have empty amounts/regions, so only assert the column count.
      assert_eq!(
        line.split(',').count(),
        5,
        "line {} does not have 5 columns: {:?}",
        i + 1,
        line
      );
    }
  }

  /// The sample must contain dirty data — otherwise the demo pipeline has
  /// nothing to clean and the whole "why clean your data" lesson disappears.
  #[test]
  fn embedded_sample_contains_dirty_rows() {
    let rows: Vec<Vec<&str>> = SAMPLE_CSV
      .lines()
      .skip(1)
      .map(|l| l.split(',').collect())
      .collect();

    let empty_amount = rows.iter().filter(|r| r[3].is_empty()).count();
    let empty_region = rows.iter().filter(|r| r[1].is_empty()).count();
    let unique = rows.iter().collect::<std::collections::HashSet<_>>().len();

    assert_eq!(empty_amount, 4, "expected 4 empty amounts");
    assert_eq!(empty_region, 1, "expected 1 empty region");
    assert_eq!(
      rows.len() - unique,
      2,
      "expected 2 duplicate rows for the dedup step"
    );
  }

  #[test]
  fn writes_the_embedded_sample_on_first_call() {
    let base = temp_dir("first");
    let path = ensure_sample_data_in(&base).expect("first write");

    assert_eq!(path, base.join("samples").join(SAMPLE_FILE_NAME));
    assert!(path.is_file());
    assert_eq!(std::fs::read_to_string(&path).unwrap(), SAMPLE_CSV);
  }

  /// Idempotent: an existing file — including one the user edited — is never
  /// overwritten.
  #[test]
  fn existing_sample_is_never_overwritten() {
    let base = temp_dir("idempotent");
    let path = ensure_sample_data_in(&base).expect("first write");

    let sentinel = "日期,地区,品类,金额,数量\n2026-01-01,华东,数码,1.00,1\n";
    std::fs::write(&path, sentinel).expect("simulate user edit");

    let again = ensure_sample_data_in(&base).expect("second call");
    assert_eq!(again, path, "path must be stable across calls");
    assert_eq!(
      std::fs::read_to_string(&path).unwrap(),
      sentinel,
      "an existing sample file must not be overwritten"
    );
  }
}
