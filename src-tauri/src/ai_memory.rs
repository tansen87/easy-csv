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
    let db_dir = resources_dir.join("data");
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

        CREATE TABLE IF NOT EXISTS ai_sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          messages TEXT NOT NULL,
          message_count INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now', 'localtime')),
          updated_at DATETIME DEFAULT (datetime('now', 'localtime'))
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

    // Migrate the old single-session history (design 066): one row per
    // distinct `session_id`, with the messages rebuilt as JSON so the new
    // session list is not empty after an upgrade.
    let existing: i64 = conn
      .query_row("SELECT COUNT(*) FROM ai_sessions", [], |row| row.get(0))
      .unwrap_or(0);
    if existing == 0 {
      migrate_legacy_sessions(&conn);
    }

    let state = DbState {
      conn: Mutex::new(conn),
    };
    DB_STATE.set(state).ok()?;
    DB_STATE.get()
  })
}

/// Rebuild `ai_sessions` rows from the legacy per-message table.
fn migrate_legacy_sessions(conn: &Connection) {
  let mut stmt = match conn.prepare(
    "SELECT session_id, role, content FROM ai_conversations ORDER BY id",
  ) {
    Ok(stmt) => stmt,
    Err(_) => return,
  };
  let rows = match stmt.query_map([], |row| {
    Ok((
      row.get::<_, String>(0)?,
      row.get::<_, String>(1)?,
      row.get::<_, String>(2)?,
    ))
  }) {
    Ok(rows) => rows,
    Err(_) => return,
  };

  let mut by_session: Vec<(String, Vec<(String, String)>)> = Vec::new();
  for row in rows.flatten() {
    let (sid, role, content) = row;
    match by_session.iter_mut().find(|(id, _)| *id == sid) {
      Some((_, list)) => list.push((role, content)),
      None => by_session.push((sid, vec![(role, content)])),
    }
  }

  for (sid, messages) in by_session {
    if messages.is_empty() {
      continue;
    }
    let title = session_title(&messages);
    let now = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap_or_default()
      .as_millis() as u64;
    let payload: Vec<serde_json::Value> = messages
      .iter()
      .enumerate()
      .map(|(index, (role, content))| {
        serde_json::json!({
          "role": role,
          "content": content,
          "timestamp": now.saturating_sub((messages.len() - index) as u64 * 1000),
        })
      })
      .collect();
    let Ok(json) = serde_json::to_string(&payload) else {
      continue;
    };
    let _ = conn.execute(
      "INSERT OR IGNORE INTO ai_sessions (id, title, messages, message_count) VALUES (?1, ?2, ?3, ?4)",
      params![sid, title, json, messages.len() as i64],
    );
  }
}

/// First user message, one line, 24 characters.
fn session_title(messages: &[(String, String)]) -> String {
  let text = messages
    .iter()
    .find(|(role, _)| role == "user")
    .map(|(_, content)| content.as_str())
    .unwrap_or("新的对话");
  let one_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
  let title: String = one_line.chars().take(24).collect();
  if title.is_empty() {
    "新的对话".to_string()
  } else {
    title
  }
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

#[derive(Debug, Serialize, Deserialize)]
pub struct AISessionSummary {
  pub id: String,
  pub title: String,
  pub updated_at: String,
  pub message_count: i64,
}

/// Conversation list for the AI panel (design 066), newest first.
#[tauri::command]
pub async fn list_ai_sessions(limit: Option<u32>) -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
  let max_limit = limit.unwrap_or(50).clamp(1, 200) as i64;

  let mut stmt = conn
    .prepare(
      "SELECT id, title, updated_at, message_count FROM ai_sessions ORDER BY updated_at DESC, rowid DESC LIMIT ?1",
    )
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;
  let rows = stmt
    .query_map(params![max_limit], |row| {
      Ok(AISessionSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        updated_at: row.get(2)?,
        message_count: row.get(3)?,
      })
    })
    .map_err(|e| format!("Failed to query sessions: {}", e))?;

  let sessions: Vec<AISessionSummary> = rows.flatten().collect();
  serde_json::to_string(&sessions).map_err(|e| format!("Failed to serialize: {}", e))
}

/// Message payload for one session, or `[]` when it no longer exists.
#[tauri::command]
pub async fn load_ai_session(session_id: String) -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let payload: Option<String> = conn
    .query_row(
      "SELECT messages FROM ai_sessions WHERE id = ?1",
      params![session_id],
      |row| row.get(0),
    )
    .ok();
  Ok(payload.unwrap_or_else(|| "[]".to_string()))
}

#[tauri::command]
pub async fn save_ai_session(
  session_id: String,
  title: String,
  messages: String,
) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let parsed: Vec<serde_json::Value> =
    serde_json::from_str(&messages).map_err(|e| format!("Failed to parse messages: {}", e))?;
  let count = parsed.len() as i64;
  let trimmed = title.trim();
  let title = if trimmed.is_empty() {
    session_title_from_json(&parsed)
  } else {
    trimmed.to_string()
  };

  conn
    .execute(
      "INSERT INTO ai_sessions (id, title, messages, message_count, updated_at)
       VALUES (?1, ?2, ?3, ?4, datetime('now', 'localtime'))
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         messages = excluded.messages,
         message_count = excluded.message_count,
         updated_at = datetime('now', 'localtime')",
      params![session_id, title, messages, count],
    )
    .map_err(|e| format!("Failed to save session: {}", e))?;
  Ok(())
}

#[tauri::command]
pub async fn rename_ai_session(session_id: String, title: String) -> Result<(), String> {
  let title = title.trim();
  if title.is_empty() {
    return Err("Title cannot be empty".to_string());
  }
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
  conn
    .execute(
      "UPDATE ai_sessions SET title = ?2, updated_at = datetime('now', 'localtime') WHERE id = ?1",
      params![session_id, title],
    )
    .map_err(|e| format!("Failed to rename session: {}", e))?;
  Ok(())
}

#[tauri::command]
pub async fn delete_ai_session(session_id: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
  conn
    .execute("DELETE FROM ai_sessions WHERE id = ?1", params![session_id])
    .map_err(|e| format!("Failed to delete session: {}", e))?;
  Ok(())
}

fn session_title_from_json(messages: &[serde_json::Value]) -> String {
  let text = messages
    .iter()
    .find(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
    .and_then(|m| m.get("content").and_then(|c| c.as_str()))
    .unwrap_or("新的对话");
  let one_line = text.split_whitespace().collect::<Vec<_>>().join(" ");
  let title: String = one_line.chars().take(24).collect();
  if title.is_empty() {
    "新的对话".to_string()
  } else {
    title
  }
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
  conn
    .execute("DELETE FROM ai_sessions", [])
    .map_err(|e| format!("Failed to clear sessions: {}", e))?;

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
