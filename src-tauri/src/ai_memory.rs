use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct CorrectionRule {
  pub pattern: String,
  pub wrong_command: String,
  pub correct_command: String,
}

struct DbState {
  conn: Mutex<Connection>,
}

static DB_STATE: std::sync::OnceLock<DbState> = std::sync::OnceLock::new();

fn get_db() -> Option<&'static DbState> {
  DB_STATE.get().or_else(|| {
    let resources_dir = crate::config::get_resources_dir();
    let db_dir = resources_dir.join("db");
    std::fs::create_dir_all(&db_dir).ok()?;
    let db_path = db_dir.join("ai_memory.db");
    let conn = Connection::open(db_path).ok()?;

    conn
      .execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_time DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS ai_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_query TEXT NOT NULL,
          ai_response TEXT NOT NULL,
          generated_command TEXT,
          feedback_type TEXT NOT NULL,
          correction TEXT,
          created_time DATETIME DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS ai_corrections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern TEXT NOT NULL,
          wrong_command TEXT NOT NULL,
          correct_command TEXT NOT NULL,
          times_applied INTEGER DEFAULT 0,
          created_time DATETIME DEFAULT (datetime('now', 'localtime'))
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
pub async fn save_conversation(session_id: String, messages: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute(
      "DELETE FROM ai_conversations WHERE session_id = ?1",
      params![session_id],
    )
    .map_err(|e| format!("Failed to delete old conversation: {}", e))?;

  let messages: Vec<serde_json::Value> =
    serde_json::from_str(&messages).map_err(|e| format!("Failed to parse messages: {}", e))?;

  for msg in &messages {
    let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
    let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");

    conn
      .execute(
        "INSERT INTO ai_conversations (session_id, role, content) VALUES (?1, ?2, ?3)",
        params![session_id, role, content],
      )
      .map_err(|e| format!("Failed to insert message: {}", e))?;
  }

  Ok(())
}

#[tauri::command]
pub async fn load_conversation_history(
  session_id: String,
  limit: Option<u32>,
) -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let max_limit = limit.unwrap_or(10).max(1);

  let mut stmt = conn
    .prepare(
      "SELECT role, content FROM ai_conversations WHERE session_id = ?1 ORDER BY id DESC LIMIT ?2",
    )
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;

  let rows = stmt
    .query_map(params![session_id, max_limit], |row| {
      Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })
    .map_err(|e| format!("Failed to query: {}", e))?;

  let mut messages: Vec<serde_json::Value> = Vec::new();
  for row in rows {
    let (role, content) = row.map_err(|e| format!("Failed to read row: {}", e))?;
    messages.push(serde_json::json!({
      "role": role,
      "content": content,
      "timestamp": std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis(),
    }));
  }

  messages.reverse();

  serde_json::to_string(&messages).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
pub async fn save_feedback(feedback: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let entry: serde_json::Value =
    serde_json::from_str(&feedback).map_err(|e| format!("Failed to parse feedback: {}", e))?;

  let user_query = entry
    .get("userQuery")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let ai_response = entry
    .get("aiResponse")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let generated_command = entry.get("generatedCommand").and_then(|v| v.as_str());
  let feedback_type = entry
    .get("feedbackType")
    .and_then(|v| v.as_str())
    .unwrap_or("positive");
  let correction = entry.get("correction").and_then(|v| v.as_str());

  conn
    .execute(
      "INSERT INTO ai_feedback (user_query, ai_response, generated_command, feedback_type, correction) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![user_query, ai_response, generated_command, feedback_type, correction],
    )
    .map_err(|e| format!("Failed to save feedback: {}", e))?;

  // Cleanup old entries (keep last 1000)
  conn
    .execute(
      "DELETE FROM ai_feedback WHERE id NOT IN (SELECT id FROM ai_feedback ORDER BY id DESC LIMIT 1000)",
      [],
    )
    .map_err(|e| format!("Failed to cleanup feedback: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_feedback_rules() -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let mut stmt = conn
    .prepare(
      "SELECT user_query, generated_command, correction FROM ai_feedback WHERE feedback_type = 'negative' AND correction IS NOT NULL ORDER BY id DESC LIMIT 100",
    )
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;

  let rows = stmt
    .query_map([], |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, Option<String>>(1)?,
        row.get::<_, Option<String>>(2)?,
      ))
    })
    .map_err(|e| format!("Failed to query: {}", e))?;

  let mut corrections: Vec<serde_json::Value> = Vec::new();
  for row in rows {
    let (query, command, correction) = row.map_err(|e| format!("Failed to read row: {}", e))?;
    corrections.push(serde_json::json!({
      "pattern": query,
      "wrong_command": command.unwrap_or_default(),
      "correct_command": correction.unwrap_or_default(),
    }));
  }

  serde_json::to_string(&corrections).map_err(|e| format!("Failed to serialize: {}", e))
}

#[tauri::command]
pub async fn save_correction(correction: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let entry: CorrectionRule =
    serde_json::from_str(&correction).map_err(|e| format!("Failed to parse correction: {}", e))?;

  conn
    .execute(
      "INSERT INTO ai_corrections (pattern, wrong_command, correct_command) VALUES (?1, ?2, ?3)",
      params![entry.pattern, entry.wrong_command, entry.correct_command],
    )
    .map_err(|e| format!("Failed to save correction: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn clear_conversations() -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute("DELETE FROM ai_conversations", [])
    .map_err(|e| format!("Failed to clear conversations: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn clear_feedback() -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute("DELETE FROM ai_feedback", [])
    .map_err(|e| format!("Failed to clear feedback: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn clear_corrections() -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute("DELETE FROM ai_corrections", [])
    .map_err(|e| format!("Failed to clear corrections: {}", e))?;

  Ok(())
}
