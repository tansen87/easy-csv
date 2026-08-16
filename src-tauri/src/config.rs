use std::sync::Mutex;

use aes_gcm::{
  Aes256Gcm, Nonce,
  aead::{Aead, KeyInit},
};
use rand::Rng;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
  pub default_delimiter: Option<String>,
  pub no_headers: Option<bool>,
  pub show_execution_notification: Option<bool>,
  pub minimize_to_tray: Option<bool>,
  pub double_click_fit_view: Option<bool>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      default_delimiter: None,
      no_headers: None,
      show_execution_notification: None,
      minimize_to_tray: None,
      double_click_fit_view: Some(true),
    }
  }
}

pub fn get_resources_dir() -> std::path::PathBuf {
  let exe_path = std::env::current_exe().unwrap_or_else(|_| std::path::PathBuf::from("."));
  let exe_dir = exe_path.parent().unwrap_or(std::path::Path::new("."));
  exe_dir.join("easy-csv_resources")
}

struct DbState {
  conn: Mutex<Connection>,
}

static DB_STATE: std::sync::OnceLock<DbState> = std::sync::OnceLock::new();

fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) {
  let exists = conn
    .prepare(&format!("PRAGMA table_info({})", table))
    .ok()
    .and_then(|mut stmt| {
      stmt
        .query_map([], |row| row.get::<_, String>(1))
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).any(|c| c == column))
    })
    .unwrap_or(false);

  if !exists {
    let _ = conn.execute(&format!("ALTER TABLE {} ADD COLUMN {}", table, ddl), []);
  }
}

fn get_db() -> Option<&'static DbState> {
  DB_STATE.get().or_else(|| {
    let resources_dir = get_resources_dir();
    let db_dir = resources_dir.join("data");
    std::fs::create_dir_all(&db_dir).ok()?;
    let db_path = db_dir.join("config.db");
    let conn = Connection::open(db_path).ok()?;

    conn
      .execute_batch(
        r#"
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        provider TEXT NOT NULL DEFAULT 'deepseek',
        model TEXT NOT NULL DEFAULT 'deepseek-v4-flash'
      );

      CREATE TABLE IF NOT EXISTS ai_api_keys (
        provider TEXT PRIMARY KEY,
        encrypted_key TEXT NOT NULL
      );
      "#,
      )
      .ok()?;

    ensure_column(
      &conn,
      "ai_config",
      "base_url",
      "base_url TEXT NOT NULL DEFAULT ''",
    );
    ensure_column(&conn, "ai_config", "name", "name TEXT NOT NULL DEFAULT ''");
    ensure_column(
      &conn,
      "ai_config",
      "models",
      "models TEXT NOT NULL DEFAULT '[]'",
    );

    let state = DbState {
      conn: Mutex::new(conn),
    };
    DB_STATE.set(state).ok()?;
    DB_STATE.get()
  })
}

const PEPPER: &str = "easy-csv-ai-key-2024";

fn derive_key() -> [u8; 32] {
  let hostname = hostname::get()
    .map(|h| h.to_string_lossy().to_string())
    .unwrap_or_else(|_| "unknown".to_string());

  let username = whoami::username().unwrap_or_else(|_| "<unknown>".to_string());

  let mut hasher = Sha256::new();
  hasher.update(hostname.as_bytes());
  hasher.update(username.as_bytes());
  hasher.update(PEPPER.as_bytes());
  hasher.finalize().into()
}

fn encrypt_api_key(plaintext: &str) -> Result<String, String> {
  let key_bytes = derive_key();
  let cipher =
    Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("Failed to create cipher: {}", e))?;

  let mut nonce_bytes = [0u8; 12];
  rand::thread_rng().fill(&mut nonce_bytes);
  let nonce =
    Nonce::try_from(nonce_bytes.as_slice()).map_err(|_| "Invalid nonce length".to_string())?;

  let ciphertext = cipher
    .encrypt(&nonce, plaintext.as_bytes())
    .map_err(|e| format!("Encryption failed: {}", e))?;

  // Format: hex(nonce):hex(ciphertext)
  Ok(format!(
    "{}:{}",
    hex::encode(nonce_bytes),
    hex::encode(ciphertext)
  ))
}

fn decrypt_api_key(encrypted: &str) -> Result<String, String> {
  let parts: Vec<&str> = encrypted.splitn(2, ':').collect();
  if parts.len() != 2 {
    return Err("Invalid encrypted key format".to_string());
  }

  let nonce_bytes = hex::decode(parts[0]).map_err(|e| format!("Invalid nonce hex: {}", e))?;
  let ciphertext = hex::decode(parts[1]).map_err(|e| format!("Invalid ciphertext hex: {}", e))?;

  let key_bytes = derive_key();
  let cipher =
    Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| format!("Failed to create cipher: {}", e))?;

  let nonce =
    Nonce::try_from(nonce_bytes.as_slice()).map_err(|_| "Invalid nonce length".to_string())?;

  let plaintext = cipher
    .decrypt(&nonce, ciphertext.as_ref())
    .map_err(|e| format!("Decryption failed: {}", e))?;

  String::from_utf8(plaintext).map_err(|e| format!("Invalid UTF-8: {}", e))
}

fn get_config_string(key: &str) -> Option<String> {
  let db = get_db()?;
  let conn = db.conn.lock().ok()?;
  conn
    .query_row(
      "SELECT value FROM app_config WHERE key = ?1",
      params![key],
      |row| row.get::<_, String>(0),
    )
    .ok()
}

fn set_config_string(key: &str, value: &str) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
  conn
    .execute(
      "INSERT INTO app_config (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
      params![key, value],
    )
    .map_err(|e| format!("Failed to set config value: {}", e))?;
  Ok(())
}

pub fn load_config() -> Result<AppConfig, String> {
  let default = AppConfig::default();

  let default_delimiter = get_config_string("default_delimiter");
  let no_headers = get_config_string("no_headers").and_then(|v| v.parse().ok());
  let show_execution_notification =
    get_config_string("show_execution_notification").and_then(|v| v.parse().ok());
  let minimize_to_tray = get_config_string("minimize_to_tray").and_then(|v| v.parse().ok());
  let double_click_fit_view =
    get_config_string("double_click_fit_view").and_then(|v| v.parse().ok());

  Ok(AppConfig {
    default_delimiter: default_delimiter.or(default.default_delimiter),
    no_headers: no_headers.or(default.no_headers),
    show_execution_notification: show_execution_notification
      .or(default.show_execution_notification),
    minimize_to_tray: minimize_to_tray.or(default.minimize_to_tray),
    double_click_fit_view: double_click_fit_view.or(default.double_click_fit_view),
  })
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
  if let Some(ref v) = config.default_delimiter {
    set_config_string("default_delimiter", v)?;
  }
  if let Some(v) = config.no_headers {
    set_config_string("no_headers", &v.to_string())?;
  }
  if let Some(v) = config.show_execution_notification {
    set_config_string("show_execution_notification", &v.to_string())?;
  }
  if let Some(v) = config.minimize_to_tray {
    set_config_string("minimize_to_tray", &v.to_string())?;
  }
  if let Some(v) = config.double_click_fit_view {
    set_config_string("double_click_fit_view", &v.to_string())?;
  }
  Ok(())
}

pub fn load_ai_config() -> Result<(String, String, String, String, String), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let result = conn.query_row(
    "SELECT provider, model, base_url, name, models FROM ai_config WHERE id = 1",
    [],
    |row| {
      Ok((
        row.get::<_, String>(0)?,
        row.get::<_, String>(1)?,
        row.get::<_, String>(2)?,
        row.get::<_, String>(3)?,
        row.get::<_, String>(4)?,
      ))
    },
  );

  match result {
    Ok((provider, model, base_url, name, models)) => Ok((provider, model, base_url, name, models)),
    Err(_) => Ok((
      "deepseek".to_string(),
      "deepseek-v4-flash".to_string(),
      String::new(),
      String::new(),
      "[]".to_string(),
    )),
  }
}

pub fn save_ai_config(
  provider: &str,
  model: &str,
  base_url: &str,
  name: &str,
  models: &str,
) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute(
      "INSERT INTO ai_config (id, provider, model, base_url, name, models) \
       VALUES (1, ?1, ?2, ?3, ?4, ?5) \
       ON CONFLICT(id) DO UPDATE SET provider = ?1, model = ?2, base_url = ?3, name = ?4, models = ?5",
      params![provider, model, base_url, name, models],
    )
    .map_err(|e| format!("Failed to save AI config: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn save_api_key(provider: String, api_key: String) -> Result<(), String> {
  let encrypted = encrypt_api_key(&api_key)?;

  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute(
      "INSERT INTO ai_api_keys (provider, encrypted_key) VALUES (?1, ?2) \
       ON CONFLICT(provider) DO UPDATE SET encrypted_key = ?2",
      params![provider, encrypted],
    )
    .map_err(|e| format!("Failed to save API key: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn load_api_key(provider: String) -> Result<String, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let result = conn.query_row(
    "SELECT encrypted_key FROM ai_api_keys WHERE provider = ?1",
    params![provider],
    |row| row.get::<_, String>(0),
  );

  match result {
    Ok(encrypted) => decrypt_api_key(&encrypted),
    Err(_) => Ok(String::new()),
  }
}

#[tauri::command]
pub async fn delete_api_key(provider: String) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  conn
    .execute(
      "DELETE FROM ai_api_keys WHERE provider = ?1",
      params![provider],
    )
    .map_err(|e| format!("Failed to delete API key: {}", e))?;

  Ok(())
}

#[tauri::command]
pub async fn has_api_key(provider: String) -> Result<bool, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let count: i64 = conn
    .query_row(
      "SELECT COUNT(*) FROM ai_api_keys WHERE provider = ?1",
      params![provider],
      |row| row.get(0),
    )
    .map_err(|e| format!("Failed to check API key: {}", e))?;

  Ok(count > 0)
}

#[tauri::command]
pub async fn get_default_delimiter() -> Option<String> {
  load_config().unwrap_or_default().default_delimiter
}

#[tauri::command]
pub async fn set_default_delimiter(delimiter: String) -> Result<(), String> {
  let mut config = load_config()?;
  config.default_delimiter = Some(delimiter);
  save_config(&config)
}

#[tauri::command]
pub async fn get_no_headers() -> Option<bool> {
  load_config().unwrap_or_default().no_headers
}

#[tauri::command]
pub async fn set_no_headers(no_headers: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.no_headers = Some(no_headers);
  save_config(&config)
}

#[tauri::command]
pub async fn get_system_notification() -> Option<bool> {
  load_config()
    .unwrap_or_default()
    .show_execution_notification
}

#[tauri::command]
pub async fn set_system_notification(show: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.show_execution_notification = Some(show);
  save_config(&config)
}

#[tauri::command]
pub async fn get_minimize_to_tray() -> Option<bool> {
  load_config().unwrap_or_default().minimize_to_tray
}

#[tauri::command]
pub async fn set_minimize_to_tray(minimize: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.minimize_to_tray = Some(minimize);
  save_config(&config)
}

#[tauri::command]
pub async fn get_double_click_fit_view() -> Option<bool> {
  load_config().unwrap_or_default().double_click_fit_view
}

#[tauri::command]
pub async fn set_double_click_fit_view(enabled: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.double_click_fit_view = Some(enabled);
  save_config(&config)
}

#[tauri::command]
pub async fn get_ai_config() -> Result<String, String> {
  let (provider, model, base_url, name, models) = load_ai_config()?;
  Ok(
    serde_json::json!({
      "provider": provider,
      "model": model,
      "baseUrl": base_url,
      "providerName": name,
      "models": serde_json::from_str::<Vec<String>>(&models).unwrap_or_default(),
    })
    .to_string(),
  )
}

#[tauri::command]
pub async fn set_ai_config(config: String) -> Result<(), String> {
  let parsed: serde_json::Value =
    serde_json::from_str(&config).map_err(|e| format!("Invalid JSON: {}", e))?;

  let provider = parsed
    .get("provider")
    .and_then(|v| v.as_str())
    .unwrap_or("deepseek");
  let model = parsed
    .get("model")
    .and_then(|v| v.as_str())
    .unwrap_or("deepseek-v4-flash");
  let base_url = parsed.get("baseUrl").and_then(|v| v.as_str()).unwrap_or("");
  let name = parsed
    .get("providerName")
    .and_then(|v| v.as_str())
    .unwrap_or("");
  let models = parsed
    .get("models")
    .and_then(|v| v.as_array())
    .map(|arr| {
      serde_json::to_string(
        &arr
          .iter()
          .filter_map(|m| m.as_str())
          .map(|s| s.to_string())
          .collect::<Vec<String>>(),
      )
      .unwrap_or_else(|_| "[]".to_string())
    })
    .unwrap_or_else(|| "[]".to_string());

  save_ai_config(provider, model, base_url, name, &models)
}
