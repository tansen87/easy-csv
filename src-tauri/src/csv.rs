use std::fs::File;
use std::io::BufReader;
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
