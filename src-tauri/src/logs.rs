//! Runtime log persistence
//!
//! One JSONL file per local day under `<resources>/data/logs/` — a sibling of
//! `execution_history.db`. Append-only writes; retention prunes whole expired
//! files, so a corrupt day never costs the others. Every function reports
//! failures as `Err` for the frontend to swallow: the log system must never
//! interrupt the business flow it is describing.

use chrono::{DateTime, Days, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::config::get_resources_dir;
use crate::storage::reveal_paths;

/// Single-line cap. Longer messages are truncated with a marker so one huge
/// payload can neither bloat the file nor the panel.
const LOG_LINE_MAX_BYTES: usize = 8 * 1024;
const TRUNCATION_MARK: &str = " …[truncated]";
/// When today's file grows past this it is rolled to `<name>.old` (at most one
/// `.old` per day; the next roll replaces it).
const LOG_FILE_MAX_BYTES: u64 = 5 * 1024 * 1024;

/// One log line as sent by the frontend. `ts` is stamped by the backend so the
/// on-disk timeline stays authoritative even if the UI clock drifts.
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LogAppendEntry {
  pub level: String,
  #[serde(default)]
  pub tab_id: Option<String>,
  #[serde(default)]
  pub tab_name: Option<String>,
  #[serde(default)]
  pub run_id: Option<String>,
  pub message: String,
}

/// One stored log line. Optional fields are omitted so a 20-line run stays a
/// few hundred bytes per line in the worst case.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredLogEntry {
  pub ts: String,
  pub level: String,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub tab_id: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub tab_name: Option<String>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub run_id: Option<String>,
  pub message: String,
}

/// `<resources>/data/logs`.
pub fn logs_dir() -> PathBuf {
  get_resources_dir().join("data").join("logs")
}

/// `easy-csv-2026-11-22.log` / `.log.old` → the day it belongs to.
/// Foreign names (user dropped a file in) are ignored everywhere.
fn file_stem_date(file_name: &str) -> Option<NaiveDate> {
  let name = file_name.strip_suffix(".old").unwrap_or(file_name);
  let stem = name.strip_prefix("easy-csv-")?.strip_suffix(".log")?;
  NaiveDate::parse_from_str(stem, "%Y-%m-%d").ok()
}

/// Truncate to at most `cap` bytes on a char boundary, ending with the mark.
/// Byte-oriented because the cap is about file/panel weight, not glyph count.
fn truncate_message(message: &str, cap: usize, mark: &str) -> String {
  if message.len() <= cap {
    return message.to_string();
  }
  let budget = cap.saturating_sub(mark.len()).max(0);
  let mut end = budget;
  while end > 0 && !message.is_char_boundary(end) {
    end -= 1;
  }
  format!("{}{}", &message[..end], mark)
}

/// Move an oversized today-file aside before appending. The `.old` copy is
/// replaced on the next roll, so the disk footprint is bounded by ~2× the cap.
fn roll_if_oversized(path: &Path, max_file_bytes: u64) -> Result<(), String> {
  let oversized = path
    .metadata()
    .map(|m| m.len() > max_file_bytes)
    .unwrap_or(false);
  if !oversized {
    return Ok(());
  }
  let rolled = PathBuf::from(format!("{}.old", path.to_string_lossy()));
  if rolled.exists() {
    fs::remove_file(&rolled).map_err(|e| format!("Failed to replace rolled log: {e}"))?;
  }
  fs::rename(path, &rolled).map_err(|e| format!("Failed to roll log file: {e}"))
}

/// Append one entry to the given day's file (internal, parameterized for
/// tests). The day comes from `now`; callers pass local time.
fn append_entry(
  dir: &Path,
  entry: &LogAppendEntry,
  now: DateTime<Local>,
  max_file_bytes: u64,
) -> Result<(), String> {
  fs::create_dir_all(dir).map_err(|e| format!("Failed to create logs directory: {e}"))?;
  let path = dir.join(format!("easy-csv-{}.log", now.format("%Y-%m-%d")));
  roll_if_oversized(&path, max_file_bytes)?;

  let stored = StoredLogEntry {
    ts: now.format("%Y-%m-%dT%H:%M:%S%.3f%:z").to_string(),
    level: entry.level.clone(),
    tab_id: entry.tab_id.clone().filter(|s| !s.is_empty()),
    tab_name: entry.tab_name.clone().filter(|s| !s.is_empty()),
    run_id: entry.run_id.clone().filter(|s| !s.is_empty()),
    message: truncate_message(&entry.message, LOG_LINE_MAX_BYTES, TRUNCATION_MARK),
  };
  let line =
    serde_json::to_string(&stored).map_err(|e| format!("Failed to serialize log entry: {e}"))?;

  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&path)
    .map_err(|e| format!("Failed to open log file: {e}"))?;
  writeln!(file, "{line}").map_err(|e| format!("Failed to write log entry: {e}"))
}

/// Read the last `days` local days (0 → empty). Malformed lines are skipped:
/// a half-written line from a crash must not cost the rest of the day.
fn read_recent(dir: &Path, days: u32, today: NaiveDate) -> Result<Vec<StoredLogEntry>, String> {
  let mut out = Vec::new();
  if days == 0 {
    return Ok(out);
  }
  for offset in (0..days).rev() {
    let date = match today.checked_sub_days(Days::new(offset as u64)) {
      Some(d) => d,
      None => continue,
    };
    let path = dir.join(format!("easy-csv-{}.log", date.format("%Y-%m-%d")));
    let Ok(content) = fs::read_to_string(&path) else {
      continue;
    };
    for line in content.lines() {
      if let Ok(entry) = serde_json::from_str::<StoredLogEntry>(line) {
        out.push(entry);
      }
    }
  }
  Ok(out)
}

/// Delete day files older than `retention_days` (0 → everything but today,
/// and with persistence disabled even that should not exist for long).
/// Returns how many files were removed; unparseable names are left alone.
fn prune_expired(dir: &Path, retention_days: u32, today: NaiveDate) -> Result<usize, String> {
  let entries = match fs::read_dir(dir) {
    Ok(entries) => entries,
    Err(_) => return Ok(0),
  };
  let cutoff = match today.checked_sub_days(Days::new(retention_days as u64)) {
    Some(d) => d,
    None => return Ok(0),
  };
  let mut removed = 0;
  for entry in entries.flatten() {
    let Some(date) = file_stem_date(&entry.file_name().to_string_lossy()) else {
      continue;
    };
    if date < cutoff {
      if fs::remove_file(entry.path()).is_ok() {
        removed += 1;
      }
    }
  }
  Ok(removed)
}

#[tauri::command]
pub async fn append_log(entry: LogAppendEntry) -> Result<(), String> {
  tokio::task::spawn_blocking(move || {
    append_entry(&logs_dir(), &entry, Local::now(), LOG_FILE_MAX_BYTES)
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

/// Backfill source for the panel: the last `days` days, oldest first.
#[tauri::command]
pub async fn read_recent_logs(days: u32) -> Result<Vec<StoredLogEntry>, String> {
  let dir = logs_dir();
  let today = Local::now().date_naive();
  tokio::task::spawn_blocking(move || read_recent(&dir, days, today))
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

/// Startup/setting-change cleanup. Frontend passes the configured retention.
#[tauri::command]
pub async fn prune_log_files(retention_days: u32) -> Result<usize, String> {
  let dir = logs_dir();
  let today = Local::now().date_naive();
  tokio::task::spawn_blocking(move || prune_expired(&dir, retention_days, today))
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

/// Open `data/logs/` in the system file manager (creates it if missing).
#[tauri::command]
pub async fn reveal_logs_dir() -> Result<(), String> {
  let dir = logs_dir();
  fs::create_dir_all(&dir).map_err(|e| format!("Failed to create logs directory: {e}"))?;
  reveal_paths(vec![dir.to_string_lossy().to_string()]).await
}

#[cfg(test)]
mod tests {
  use super::*;

  fn entry(level: &str, message: &str) -> LogAppendEntry {
    LogAppendEntry {
      level: level.to_string(),
      tab_id: Some("t1".to_string()),
      tab_name: Some("销售数据-2024".to_string()),
      run_id: Some("r_9c2e".to_string()),
      message: message.to_string(),
    }
  }

  fn now_on(year: i32, month: u32, day: u32, hour: u32) -> DateTime<Local> {
    use chrono::TimeZone;
    Local
      .with_ymd_and_hms(year, month, day, hour, 0, 0)
      .single()
      .unwrap()
  }

  #[test]
  fn append_and_read_back_preserves_fields_and_order() {
    let dir = std::env::temp_dir().join("easycsv-logs-append-read");
    let _ = fs::remove_dir_all(&dir);
    let now = now_on(2026, 11, 22, 14);

    append_entry(&dir, &entry("info", "开始执行"), now, LOG_FILE_MAX_BYTES).unwrap();
    append_entry(
      &dir,
      &entry("error", "cannot safely cast"),
      now,
      LOG_FILE_MAX_BYTES,
    )
    .unwrap();

    let today = NaiveDate::from_ymd_opt(2026, 11, 22).unwrap();
    let back = read_recent(&dir, 2, today).unwrap();
    assert_eq!(back.len(), 2, "both lines of today are returned: {back:?}");
    assert_eq!(back[0].level, "info");
    assert_eq!(back[1].level, "error");
    assert_eq!(back[0].tab_name.as_deref(), Some("销售数据-2024"));
    assert_eq!(back[0].run_id.as_deref(), Some("r_9c2e"));
    assert!(
      back[0].ts.starts_with("2026-11-22T14:"),
      "backend stamps ts: {}",
      back[0].ts
    );
    assert!(back[0].ts.contains('+'), "ts carries the local offset");
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn truncates_long_messages_on_char_boundaries() {
    let dir = std::env::temp_dir().join("easycsv-logs-truncate");
    let _ = fs::remove_dir_all(&dir);
    let now = now_on(2026, 11, 22, 9);

    let ascii = "x".repeat(LOG_LINE_MAX_BYTES + 100);
    let multibyte = "日".repeat(6000); // ~18 KB of 3-byte chars
    append_entry(&dir, &entry("info", &ascii), now, LOG_FILE_MAX_BYTES).unwrap();
    append_entry(&dir, &entry("info", &multibyte), now, LOG_FILE_MAX_BYTES).unwrap();

    let back = read_recent(&dir, 1, NaiveDate::from_ymd_opt(2026, 11, 22).unwrap()).unwrap();
    assert_eq!(back.len(), 2, "every line must stay parseable JSON");
    for stored in &back {
      assert!(
        stored.message.len() <= LOG_LINE_MAX_BYTES,
        "stored message exceeds the cap: {} bytes",
        stored.message.len()
      );
      assert!(stored.message.ends_with(TRUNCATION_MARK));
      assert!(stored.message.chars().all(|c| c != '\u{FFFD}'));
    }
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn rolls_oversized_file_aside_before_appending() {
    let dir = std::env::temp_dir().join("easycsv-logs-roll");
    let _ = fs::remove_dir_all(&dir);
    let now = now_on(2026, 11, 22, 8);
    let today = NaiveDate::from_ymd_opt(2026, 11, 22).unwrap();

    append_entry(&dir, &entry("info", "first"), now, 64).unwrap();
    // Second append must roll the (now oversized) file before writing.
    append_entry(&dir, &entry("info", "second"), now, 64).unwrap();

    let files = fs::read_dir(&dir).unwrap().flatten().count();
    assert_eq!(files, 2, "current file + one .old roll: {files}");
    assert!(dir.join("easy-csv-2026-11-22.log.old").exists());
    // A third roll replaces the previous .old instead of piling up.
    append_entry(&dir, &entry("info", "third"), now, 64).unwrap();
    let files = fs::read_dir(&dir).unwrap().flatten().count();
    assert_eq!(files, 2, "at most one .old per day: {files}");

    let back = read_recent(&dir, 1, today).unwrap();
    assert_eq!(back.len(), 1, "read_recent reads the live file only");
    assert_eq!(back[0].message, "third");
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn prunes_expired_files_and_ignores_foreign_names() {
    let dir = std::env::temp_dir().join("easycsv-logs-prune");
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let today = NaiveDate::from_ymd_opt(2026, 11, 22).unwrap();

    // Retention 7 → cutoff = 11-15; a file dated exactly the cutoff survives.
    for name in [
      "easy-csv-2026-11-10.log",
      "easy-csv-2026-11-15.log",
      "easy-csv-2026-11-22.log",
      "notes.txt",
    ] {
      fs::write(dir.join(name), "x").unwrap();
    }

    let removed = prune_expired(&dir, 7, today).unwrap();
    assert_eq!(removed, 1, "only the 12-day-old file is expired: {removed}");
    assert!(
      dir.join("easy-csv-2026-11-15.log").exists(),
      "cutoff day kept"
    );
    assert!(dir.join("easy-csv-2026-11-22.log").exists());
    assert!(
      dir.join("notes.txt").exists(),
      "foreign files stay untouched"
    );

    let removed = prune_expired(&dir, 0, today).unwrap();
    assert_eq!(removed, 1, "retention 0 keeps nothing but today");
    assert!(dir.join("easy-csv-2026-11-22.log").exists());
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn file_stem_date_parses_only_log_names() {
    let today = NaiveDate::from_ymd_opt(2026, 11, 22).unwrap();
    assert_eq!(file_stem_date("easy-csv-2026-11-22.log"), Some(today));
    assert_eq!(
      file_stem_date("easy-csv-2026-11-15.log.old"),
      Some(NaiveDate::from_ymd_opt(2026, 11, 15).unwrap())
    );
    assert_eq!(file_stem_date("notes.txt"), None);
    assert_eq!(file_stem_date("easy-csv-not-a-date.log"), None);
  }
}
