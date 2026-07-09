use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
  pub default_delimiter: Option<String>,
  pub no_headers: Option<bool>,
  pub show_execution_notification: Option<bool>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      default_delimiter: None,
      no_headers: None,
      show_execution_notification: None,
    }
  }
}

/// Get the resources directory path (next to the executable)
pub fn get_resources_dir() -> std::path::PathBuf {
  let exe_path = std::env::current_exe().unwrap_or_else(|_| std::path::PathBuf::from("."));
  let exe_dir = exe_path.parent().unwrap_or(Path::new("."));
  exe_dir.join("easy-csv_resources")
}

fn get_config_file_path() -> std::path::PathBuf {
  get_resources_dir().join("config.json")
}

pub fn load_config() -> Result<AppConfig, String> {
  let config_path = get_config_file_path();

  if config_path.exists() {
    let mut file =
      File::open(&config_path).map_err(|e| format!("Failed to open config file: {}", e))?;

    let mut contents = String::new();
    file
      .read_to_string(&mut contents)
      .map_err(|e| format!("Failed to read config file: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse config file: {}", e))
  } else {
    Ok(AppConfig::default())
  }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
  let config_path = get_config_file_path();

  if let Some(parent) = config_path.parent() {
    if !parent.exists() {
      std::fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
  }

  let contents = serde_json::to_string_pretty(config)
    .map_err(|e| format!("Failed to serialize config: {}", e))?;

  let mut file =
    File::create(&config_path).map_err(|e| format!("Failed to create config file: {}", e))?;

  file
    .write_all(contents.as_bytes())
    .map_err(|e| format!("Failed to write config file: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn get_default_delimiter() -> Option<String> {
  let config = load_config().unwrap_or_default();
  config.default_delimiter
}

#[tauri::command]
pub async fn set_default_delimiter(delimiter: String) -> Result<(), String> {
  let mut config = load_config()?;
  config.default_delimiter = Some(delimiter);
  save_config(&config)
}

#[tauri::command]
pub async fn get_no_headers() -> Option<bool> {
  let config = load_config().unwrap_or_default();
  config.no_headers
}

#[tauri::command]
pub async fn set_no_headers(no_headers: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.no_headers = Some(no_headers);
  save_config(&config)
}

#[tauri::command]
pub async fn get_show_execution_notification() -> Option<bool> {
  let config = load_config().unwrap_or_default();
  config.show_execution_notification
}

#[tauri::command]
pub async fn set_show_execution_notification(show: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.show_execution_notification = Some(show);
  save_config(&config)
}
