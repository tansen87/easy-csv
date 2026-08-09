use rusqlite::{Connection, params};
use std::sync::Mutex;

struct DbState {
  conn: Mutex<Connection>,
}

static DB_STATE: std::sync::OnceLock<DbState> = std::sync::OnceLock::new();

fn get_db() -> Option<&'static DbState> {
  DB_STATE.get().or_else(|| {
    let resources_dir = crate::config::get_resources_dir();
    let db_dir = resources_dir.join("db");
    std::fs::create_dir_all(&db_dir).ok()?;
    let db_path = db_dir.join("session.db");
    let conn = Connection::open(db_path).ok()?;

    conn
      .execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS tab_snapshots (
          tab_id TEXT PRIMARY KEY,
          snapshot TEXT NOT NULL,
          updated_time DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS session_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        "#,
      )
      .ok()?;

    let state = DbState {
      conn: Mutex::new(conn),
    };
    DB_STATE.set(state).ok()?;
    DB_STATE.get()
  })
}

#[tauri::command]
pub async fn save_session(tabs: String, selected_tab_id: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute("DELETE FROM tab_snapshots", [])
    .map_err(|e| format!("Failed to clear old snapshots: {}", e))?;

  let tabs: Vec<serde_json::Value> =
    serde_json::from_str(&tabs).map_err(|e| format!("Failed to parse tabs: {}", e))?;

  for tab in &tabs {
    let tab_id = tab.get("id").and_then(|v| v.as_str()).unwrap_or("");
    if tab_id.is_empty() {
      continue;
    }
    conn
      .execute(
        "INSERT INTO tab_snapshots (tab_id, snapshot) VALUES (?1, ?2)",
        params![tab_id, tab.to_string()],
      )
      .map_err(|e| format!("Failed to save snapshot: {}", e))?;
  }

  conn
    .execute(
      "INSERT INTO session_meta (key, value) VALUES ('selected_tab_id', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1",
      params![selected_tab_id],
    )
    .map_err(|e| format!("Failed to save selected tab: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_session() -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let mut tabs: Vec<serde_json::Value> = Vec::new();

  let mut stmt = conn
    .prepare("SELECT snapshot FROM tab_snapshots")
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;

  let rows = stmt
    .query_map([], |row| row.get::<_, String>(0))
    .map_err(|e| format!("Failed to query: {}", e))?;

  for row in rows {
    let snapshot = row.map_err(|e| format!("Failed to read row: {}", e))?;
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&snapshot) {
      tabs.push(value);
    }
  }

  let selected_tab_id: String = {
    let mut stmt = conn
      .prepare("SELECT value FROM session_meta WHERE key = 'selected_tab_id'")
      .map_err(|e| format!("Failed to prepare statement: {}", e))?;
    stmt
      .query_row([], |row| row.get::<_, String>(0))
      .unwrap_or_default()
  };

  Ok(
    serde_json::json!({
      "tabs": tabs,
      "selectedTabId": selected_tab_id,
    })
    .to_string(),
  )
}
