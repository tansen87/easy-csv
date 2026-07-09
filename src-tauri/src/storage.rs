use serde_json::Map;

use crate::config::get_resources_dir;

#[tauri::command]
pub async fn save_history(history: String) -> Result<(), String> {
  let resources_dir = get_resources_dir();
  let history_path = resources_dir.join("history.json");

  // Create directory if it doesn't exist
  if !resources_dir.exists() {
    std::fs::create_dir_all(&resources_dir)
      .map_err(|e| format!("Failed to create directory: {}", e))?;
  }

  // Save history to file
  std::fs::write(&history_path, history).map_err(|e| format!("Failed to save history: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_history() -> Result<String, String> {
  let resources_dir = get_resources_dir();
  let history_path = resources_dir.join("history.json");

  // Load history from file
  if history_path.exists() {
    let content = std::fs::read_to_string(&history_path)
      .map_err(|e| format!("Failed to read history: {}", e))?;
    Ok(content)
  } else {
    Ok("[]".to_string())
  }
}

#[tauri::command]
pub async fn save_recent_files(recent_files: String) -> Result<(), String> {
  let resources_dir = get_resources_dir();
  let recent_files_path = resources_dir.join("recent-files.json");

  // Create directory if it doesn't exist
  if !resources_dir.exists() {
    std::fs::create_dir_all(&resources_dir)
      .map_err(|e| format!("Failed to create directory: {}", e))?;
  }

  // Save recent files to file
  std::fs::write(&recent_files_path, recent_files)
    .map_err(|e| format!("Failed to save recent files: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_recent_files() -> Result<String, String> {
  let resources_dir = get_resources_dir();
  let recent_files_path = resources_dir.join("recent-files.json");

  // Load recent files from file
  if recent_files_path.exists() {
    let content = std::fs::read_to_string(&recent_files_path)
      .map_err(|e| format!("Failed to read recent files: {}", e))?;
    Ok(content)
  } else {
    Ok("[]".to_string())
  }
}

#[tauri::command]
pub async fn load_profile_cache(
  file_path: String,
  delimiter: String,
) -> Result<Option<String>, String> {
  let resources_dir = get_resources_dir();
  let cache_path = resources_dir.join("profiles.json");

  if !cache_path.exists() {
    return Ok(None);
  }

  let content = std::fs::read_to_string(&cache_path)
    .map_err(|e| format!("Failed to read profiles cache: {}", e))?;
  let cache: Map<String, serde_json::Value> =
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse profiles cache: {}", e))?;

  let key = format!("{}|{}", file_path, delimiter);
  let entry = match cache.get(&key) {
    Some(e) => e,
    None => return Ok(None),
  };

  // Check if file mtime matches
  let cached_mtime = entry.get("mtime").and_then(|v| v.as_f64()).unwrap_or(0.0);
  let file_mtime = std::fs::metadata(&file_path)
    .ok()
    .and_then(|m| m.modified().ok())
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_secs_f64())
    .unwrap_or(0.0);

  if (cached_mtime - file_mtime).abs() > 1.0 {
    return Ok(None);
  }

  let stats = entry
    .get("stats")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
  Ok(stats)
}

#[tauri::command]
pub async fn save_profile_cache(
  file_path: String,
  delimiter: String,
  stats: String,
) -> Result<(), String> {
  let resources_dir = get_resources_dir();
  let cache_path = resources_dir.join("profiles.json");

  if !resources_dir.exists() {
    std::fs::create_dir_all(&resources_dir)
      .map_err(|e| format!("Failed to create directory: {}", e))?;
  }

  // Read existing cache
  let mut cache: Map<String, serde_json::Value> = if cache_path.exists() {
    let content = std::fs::read_to_string(&cache_path)
      .map_err(|e| format!("Failed to read profiles cache: {}", e))?;
    serde_json::from_str(&content).unwrap_or_default()
  } else {
    Map::new()
  };

  // Get file mtime
  let file_mtime = std::fs::metadata(&file_path)
    .ok()
    .and_then(|m| m.modified().ok())
    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
    .map(|d| d.as_secs_f64())
    .unwrap_or(0.0);

  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_secs_f64())
    .unwrap_or(0.0);

  let key = format!("{}|{}", file_path, delimiter);
  let entry = serde_json::json!({
    "stats": stats,
    "mtime": file_mtime,
    "lastAccess": now,
  });
  cache.insert(key, entry);

  // LRU eviction: if > 50 entries, remove oldest by lastAccess
  if cache.len() > 50 {
    let mut entries: Vec<(String, f64)> = cache
      .iter()
      .map(|(k, v)| {
        let la = v.get("lastAccess").and_then(|v| v.as_f64()).unwrap_or(0.0);
        (k.clone(), la)
      })
      .collect();
    entries.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));
    let to_remove = entries.len() - 50;
    for (k, _) in &entries[..to_remove] {
      cache.remove(k);
    }
  }

  let json = serde_json::to_string_pretty(&cache)
    .map_err(|e| format!("Failed to serialize profiles cache: {}", e))?;
  std::fs::write(&cache_path, json)
    .map_err(|e| format!("Failed to write profiles cache: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
  window
    .set_title(&title)
    .map_err(|e| format!("Failed to set window title: {}", e))
}

#[tauri::command]
pub async fn toggle_devtools(window: tauri::Window) -> Result<(), String> {
  let webviews = window.webviews();
  if let Some(webview) = webviews.first() {
    if webview.is_devtools_open() {
      webview.close_devtools();
    } else {
      webview.open_devtools();
    }
  }
  Ok(())
}
