use rusqlite::{Connection, params};
use serde_json::Map;
use std::sync::Mutex;

use crate::config::get_resources_dir;

/// Cap on how many execution history records are kept (LRU by insertion).
const EXECUTION_HISTORY_MAX: i64 = 100;

#[tauri::command]
pub async fn save_pipeline_versions(pipeline_id: String, versions: String) -> Result<(), String> {
  let resources_dir = get_resources_dir();
  let versions_dir = resources_dir.join("versions");

  if !versions_dir.exists() {
    std::fs::create_dir_all(&versions_dir)
      .map_err(|e| format!("Failed to create versions directory: {}", e))?;
  }

  let versions_path = versions_dir.join(format!("{}.json", pipeline_id));
  std::fs::write(&versions_path, versions)
    .map_err(|e| format!("Failed to save pipeline versions: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_pipeline_versions(pipeline_id: String) -> Result<String, String> {
  let resources_dir = get_resources_dir();
  let versions_dir = resources_dir.join("versions");
  let versions_path = versions_dir.join(format!("{}.json", pipeline_id));

  if versions_path.exists() {
    let content = std::fs::read_to_string(&versions_path)
      .map_err(|e| format!("Failed to read pipeline versions: {}", e))?;
    Ok(content)
  } else {
    Ok("[]".to_string())
  }
}

// ── Pipeline templates ────────────────────────────────────────────────

fn templates_path() -> std::path::PathBuf {
  get_resources_dir().join("templates").join("templates.json")
}

fn read_templates() -> Result<Vec<serde_json::Value>, String> {
  let path = templates_path();
  if !path.exists() {
    return Ok(Vec::new());
  }
  let content = std::fs::read_to_string(&path)
    .map_err(|e| format!("Failed to read pipeline templates: {}", e))?;
  Ok(serde_json::from_str(&content).unwrap_or_default())
}

fn write_templates(templates: &[serde_json::Value]) -> Result<(), String> {
  let path = templates_path();
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir)
      .map_err(|e| format!("Failed to create templates directory: {}", e))?;
  }
  let json = serde_json::to_string_pretty(templates)
    .map_err(|e| format!("Failed to serialize pipeline templates: {}", e))?;
  std::fs::write(&path, json).map_err(|e| format!("Failed to write pipeline templates: {}", e))
}

fn get_template_id(tpl: &serde_json::Value) -> String {
  tpl
    .get("id")
    .and_then(|v| v.as_str())
    .unwrap_or_default()
    .to_string()
}

/// Upsert a single template (replaces any existing template with the same id).
#[tauri::command]
pub async fn save_pipeline_template(template: String) -> Result<(), String> {
  let tpl: serde_json::Value = serde_json::from_str(&template)
    .map_err(|e| format!("Failed to parse pipeline template: {}", e))?;
  let id = get_template_id(&tpl);
  if id.is_empty() {
    return Err("Pipeline template requires an id".to_string());
  }
  let mut list = read_templates()?;
  list.retain(|t| get_template_id(t) != id);
  list.push(tpl);
  write_templates(&list)
}

/// Load the full list of saved templates as a JSON array string.
#[tauri::command]
pub async fn load_pipeline_templates() -> Result<String, String> {
  let list = read_templates()?;
  serde_json::to_string(&list).map_err(|e| format!("Failed to serialize pipeline templates: {}", e))
}

/// Delete a template by its id.
#[tauri::command]
pub async fn delete_pipeline_template(template_id: String) -> Result<(), String> {
  let mut list = read_templates()?;
  list.retain(|t| get_template_id(t) != template_id);
  write_templates(&list)
}

#[tauri::command]
pub async fn save_lineage_data(pipeline_id: String, lineage: String) -> Result<(), String> {
  let resources_dir = get_resources_dir();
  let lineage_dir = resources_dir.join("lineage");

  if !lineage_dir.exists() {
    std::fs::create_dir_all(&lineage_dir)
      .map_err(|e| format!("Failed to create lineage directory: {}", e))?;
  }

  let lineage_path = lineage_dir.join(format!("{}.json", pipeline_id));
  std::fs::write(&lineage_path, lineage)
    .map_err(|e| format!("Failed to save lineage data: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_lineage_data(pipeline_id: String) -> Result<String, String> {
  let resources_dir = get_resources_dir();
  let lineage_dir = resources_dir.join("lineage");
  let lineage_path = lineage_dir.join(format!("{}.json", pipeline_id));

  if lineage_path.exists() {
    let content = std::fs::read_to_string(&lineage_path)
      .map_err(|e| format!("Failed to read lineage data: {}", e))?;
    Ok(content)
  } else {
    Ok("[]".to_string())
  }
}

#[tauri::command]
pub async fn save_recent_files(recent_files: String) -> Result<(), String> {
  let resources_dir = get_resources_dir().join("data");
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
  let resources_dir = get_resources_dir().join("data");
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
  let resources_dir = get_resources_dir().join("data");
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
  let resources_dir = get_resources_dir().join("data");
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
pub async fn file_exists(file_path: String) -> Result<bool, String> {
  Ok(std::path::Path::new(&file_path).exists())
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

// ── Execution history (F6) ────────────────────────────────────────────────
// SQLite-backed execution records. Only summary stats are stored (no full
// stdout), keeping each row small; the newest `EXECUTION_HISTORY_MAX` rows
// are kept and older ones pruned on every save.

struct ExecutionHistoryDb {
  conn: Mutex<Connection>,
}

static EXECUTION_HISTORY_DB: std::sync::OnceLock<ExecutionHistoryDb> = std::sync::OnceLock::new();

fn get_execution_history_db() -> Option<&'static ExecutionHistoryDb> {
  EXECUTION_HISTORY_DB.get().or_else(|| {
    let resources_dir = get_resources_dir();
    let db_dir = resources_dir.join("data");
    std::fs::create_dir_all(&db_dir).ok()?;
    let db_path = db_dir.join("execution_history.db");
    let conn = Connection::open(db_path).ok()?;

    conn
      .execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS execution_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tab_id TEXT NOT NULL,
          tab_name TEXT NOT NULL DEFAULT '',
          pipeline_snapshot_hash TEXT NOT NULL DEFAULT '',
          version_id TEXT,
          status TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          rows INTEGER NOT NULL DEFAULT 0,
          output_summary TEXT NOT NULL DEFAULT '',
          started_at TEXT NOT NULL DEFAULT ''
        );
        "#,
      )
      .ok()?;

    let state = ExecutionHistoryDb {
      conn: Mutex::new(conn),
    };
    EXECUTION_HISTORY_DB.set(state).ok()?;
    EXECUTION_HISTORY_DB.get()
  })
}

/// Persist one execution record, then prune to the most recent 100 rows.
#[tauri::command]
pub async fn save_execution_history(entry: String) -> Result<(), String> {
  let db = get_execution_history_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let parsed: serde_json::Value =
    serde_json::from_str(&entry).map_err(|e| format!("Failed to parse entry: {}", e))?;

  let get_str = |key: &str| {
    parsed
      .get(key)
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .to_string()
  };
  let get_int =
    |key: &str, default: i64| parsed.get(key).and_then(|v| v.as_i64()).unwrap_or(default);

  conn
    .execute(
      "INSERT INTO execution_history \
       (tab_id, tab_name, pipeline_snapshot_hash, version_id, status, duration_ms, rows, output_summary, started_at) \
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
      params![
        get_str("tabId"),
        get_str("tabName"),
        get_str("pipelineSnapshotHash"),
        parsed
          .get("versionId")
          .and_then(|v| v.as_str())
          .map(|s| s.to_string()),
        get_str("status"),
        get_int("durationMs", 0),
        get_int("rows", 0),
        get_str("outputSummary"),
        get_str("startedAt"),
      ],
    )
    .map_err(|e| format!("Failed to save execution history: {}", e))?;

  // LRU-style prune: keep the most recent records.
  conn
    .execute(
      "DELETE FROM execution_history WHERE id NOT IN \
       (SELECT id FROM execution_history ORDER BY id DESC LIMIT ?1)",
      params![EXECUTION_HISTORY_MAX],
    )
    .map_err(|e| format!("Failed to prune execution history: {}", e))?;

  Ok(())
}

/// Load the most recent execution records (default 100, newest first).
#[tauri::command]
pub async fn load_execution_history(limit: Option<u32>) -> Result<String, String> {
  let db = get_execution_history_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let max_limit = limit.unwrap_or(100).max(1);

  let mut stmt = conn
    .prepare(
      "SELECT id, tab_id, tab_name, pipeline_snapshot_hash, version_id, status, \
              duration_ms, rows, output_summary, started_at \
       FROM execution_history ORDER BY id DESC LIMIT ?1",
    )
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;

  let rows = stmt
    .query_map(params![max_limit], |row| {
      Ok((
        row.get::<_, i64>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, Option<String>>(4)?,
        row.get::<_, String>(5)?,
        row.get::<_, i64>(6)?,
        row.get::<_, i64>(7)?,
        row.get::<_, String>(8)?,
        row.get::<_, String>(9)?,
      ))
    })
    .map_err(|e| format!("Failed to query: {}", e))?;

  let mut records: Vec<serde_json::Value> = Vec::new();
  for row in rows {
    let (id, tab_id, tab_name, hash, version_id, status, duration_ms, rows, summary, started_at) =
      row.map_err(|e| format!("Failed to read row: {}", e))?;
    records.push(serde_json::json!({
      "id": id,
      "tabId": tab_id,
      "tabName": tab_name,
      "pipelineSnapshotHash": hash,
      "versionId": version_id,
      "status": status,
      "durationMs": duration_ms,
      "rows": rows,
      "outputSummary": summary,
      "startedAt": started_at,
    }));
  }

  serde_json::to_string(&records).map_err(|e| format!("Failed to serialize: {}", e))
}

/// Delete all execution history records.
#[tauri::command]
pub async fn clear_execution_history() -> Result<(), String> {
  let db = get_execution_history_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute("DELETE FROM execution_history", [])
    .map_err(|e| format!("Failed to clear execution history: {}", e))?;

  Ok(())
}
