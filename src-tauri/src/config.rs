use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

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
  /// Master switch for opening files: `true` (default) auto-detects the
  /// delimiter, `false` reads every file with `default_delimiter` as-is.
  pub auto_detect_delimiter: Option<bool>,
  pub show_execution_notification: Option<bool>,
  pub minimize_to_tray: Option<bool>,
  pub double_click_fit_view: Option<bool>,
  /// Master switch for the silent update check that runs shortly after launch.
  /// Checking never installs anything by itself.
  pub auto_check_update: Option<bool>,
  /// Optional URL prefix prepended to plugin download URLs, for users behind a
  /// slow or blocked route to GitHub. Purely a transport hint:
  /// every download is still checked against the size and sha256 pinned in the
  /// signed catalog, so a hostile proxy cannot change what gets installed —
  /// only make the transfer fail.
  pub plugin_download_prefix: Option<String>,
  /// Maximum number of pipelines that may execute at the same time; the extra
  /// ones wait in FIFO order. `None` → app default (4).
  pub max_concurrent_runs: Option<u32>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      default_delimiter: None,
      no_headers: None,
      auto_detect_delimiter: Some(true),
      show_execution_notification: None,
      minimize_to_tray: None,
      double_click_fit_view: Some(true),
      auto_check_update: Some(true),
      plugin_download_prefix: None,
      max_concurrent_runs: None,
    }
  }
}

/// Folder name the app owns on Linux AppImages.
///
/// On Windows the equivalent guarantee comes from the installer: `nsis/hooks.nsh`
/// (`NSIS_HOOK_PREINSTALL`) always installs into a directory with this name, so
/// an uninstall can only ever remove EasyCsv's own folder.
#[cfg(target_os = "linux")]
const INSTALL_DIR_NAME: &str = "EasyCsv";

/// Pre-022 name of the data directory when it lived next to the executable;
/// kept only as a migration source for users coming from v0.4/v0.5.
#[cfg(not(target_os = "macos"))]
const LEGACY_DIR_NAME: &str = "EasyCsv_resources";

/// Marker written into the data directory once it is the one in use, so later
/// starts neither migrate again nor resurrect data the user deliberately
/// removed.
#[cfg(not(target_os = "macos"))]
const IN_PLACE_MARKER: &str = ".in-place-layout";

/// Marker written into the old centralized directory once its data has been
/// moved next to the executable. Without it, every later install into a fresh
/// directory would seed itself with that same stale snapshot.
#[cfg(not(target_os = "macos"))]
const MOVED_AWAY_MARKER: &str = ".moved-to-exe-dir";

/// Resolved once per process: the path is stable, and resolving it may run a
/// one-time migration that must not be repeated on every call.
static RESOURCES_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Return the base directory that plugins and SQLite databases live under.
///
/// - Windows / Linux: **the directory the executable sits in**, so the app and
///   its data are a single folder. On Windows the installer guarantees that
///   directory is named `EasyCsv` (`nsis/hooks.nsh`) — that is what keeps an
///   uninstall from ever deleting a directory the user picked for other
///   reasons. An AppImage has no installer, so it uses
///   `<directory of the .AppImage>/EasyCsv`.
/// - macOS: `~/Library/Application Support/EasyCsv` — writing inside a `.app`
///   bundle invalidates its code signature, so the bundle stays read-only.
///
/// When the directory is not writable (an install under `Program Files`, an
/// enterprise per-machine push) the app falls back to the previous centralized
/// location rather than silently failing to save settings. `data_local_dir()` is
/// used instead of `data_dir()` because the only platform where they differ is
/// Windows — `%LOCALAPPDATA%` vs the roaming `%APPDATA%` — and roaming profiles
/// must not carry SQLite databases.
///
/// All data dirs derive from this single function; plugin dir is derived via
/// `plugins::get_plugin_dir()`.
pub fn get_resources_dir() -> PathBuf {
  RESOURCES_DIR.get_or_init(resolve_resources_dir).clone()
}

/// The centralized location: no longer where new data goes, but still the
/// migration source for v0.6 users and the fallback when the data directory
/// cannot be written.
fn centralized_dir() -> PathBuf {
  dirs::data_local_dir()
    .unwrap_or_else(|| std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
    .join("EasyCsv")
}

#[cfg(target_os = "macos")]
fn resolve_resources_dir() -> PathBuf {
  centralized_dir()
}

#[cfg(not(target_os = "macos"))]
fn resolve_resources_dir() -> PathBuf {
  // Under `cargo test` the executable lives in `target/debug/deps`, so resolving
  // the real path would run the one-time migration *from* the user's actual data
  // directory and leave markers that stop the app itself from migrating later.
  // Tests get a throwaway directory instead.
  if cfg!(test) {
    return std::env::temp_dir().join("easycsv-test-data");
  }

  let target = match data_dir_candidate() {
    Some(dir) => dir,
    // No executable path: the data directory cannot be determined.
    None => return centralized_dir(),
  };

  if !ensure_writable(&target) {
    let fallback = centralized_dir();
    eprintln!(
      "[EasyCsv] {} is not writable; falling back to {}",
      target.display(),
      fallback.display()
    );
    return fallback;
  }

  // Data is already where it belongs. This also covers the plain v0.6 → next
  // upgrade: v0.6 stored data in `%LOCALAPPDATA%\EasyCsv` *and* installed there
  // by default, so the target is that very directory and nothing has to move.
  if has_database(&target) || target.join(IN_PLACE_MARKER).exists() {
    return target;
  }

  let Some(source) = migration_source(&target, &centralized_dir()) else {
    // Fresh install: adopt the layout with an empty directory.
    let _ = std::fs::write(target.join(IN_PLACE_MARKER), "in-place layout\n");
    return target;
  };

  match copy_data_dirs(&source, &target) {
    Ok(copied) => {
      let _ = std::fs::write(
        target.join(IN_PLACE_MARKER),
        format!("moved from {}\n", source.display()),
      );
      // The centralized directory is shared by every install on the machine, so
      // it is seeded only once — otherwise installing into another directory
      // later would start from this same stale snapshot.
      if source == centralized_dir() {
        let _ = std::fs::write(
          source.join(MOVED_AWAY_MARKER),
          format!("moved to {}\n", target.display()),
        );
      }
      eprintln!(
        "[EasyCsv] moved {copied} file(s) from {} to {}",
        source.display(),
        target.display()
      );
      target
    }
    // Moving failed: stay on the old location rather than losing data. A partial
    // copy in `target` is harmless — the marker is what decides, and a retry
    // overwrites it from the still-intact source.
    Err(error) => {
      eprintln!(
        "[EasyCsv] could not move {} to {} ({error}); continuing to use the old location",
        source.display(),
        target.display()
      );
      source
    }
  }
}

/// The directory the data belongs in, or `None` when it cannot be determined.
///
/// Normally the executable's own directory — the app's data and the app itself
/// share one folder, which is only safe because the installer forces that folder
/// to be named `EasyCsv`.
#[cfg(not(target_os = "macos"))]
fn data_dir_candidate() -> Option<PathBuf> {
  #[cfg(target_os = "linux")]
  {
    // An AppImage has no installer and `current_exe()` points into a read-only
    // mount that is gone on exit; the data goes into an `EasyCsv` folder next to
    // the `.AppImage` file the user keeps.
    if let Some(appimage) = std::env::var_os("APPIMAGE") {
      if let Some(parent) = Path::new(&appimage).parent() {
        return Some(parent.join(INSTALL_DIR_NAME));
      }
    }
  }

  Some(std::env::current_exe().ok()?.parent()?.to_path_buf())
}

/// The directory to seed the data directory from, if there is one.
///
/// The centralized directory wins over the old in-place name: it is one
/// generation newer, and a stale `<dir>\EasyCsv_resources` must not overwrite
/// the data a v0.6 user has been using since.
#[cfg(not(target_os = "macos"))]
fn migration_source(target: &Path, centralized: &Path) -> Option<PathBuf> {
  if centralized != target
    && has_database(centralized)
    && !centralized.join(MOVED_AWAY_MARKER).exists()
  {
    return Some(centralized.to_path_buf());
  }

  // The pre-022 directory is only a source on machines that never ran the v0.6
  // centralized layout; where one exists it is always the older generation
  // (e.g. leftovers in `target/<profile>/EasyCsv_resources` on a dev box).
  if centralized.is_dir() {
    return None;
  }

  // v0.4/v0.5 kept its data in `<install dir>\EasyCsv_resources`. Back then the
  // default install directory already ended with `EasyCsv`, but a custom path
  // was used as-is — so the old directory can be the target itself *or* one
  // level up.
  let mut candidates = vec![target.join(LEGACY_DIR_NAME)];
  if let Some(parent) = target.parent() {
    candidates.push(parent.join(LEGACY_DIR_NAME));
  }

  candidates.into_iter().find(|candidate| {
    candidate.as_path() != target && candidate.as_path() != centralized && has_database(candidate)
  })
}

/// Only a directory holding a real database counts as "has data", so an empty
/// directory left behind by an earlier attempt cannot shadow a full one.
#[cfg(not(target_os = "macos"))]
fn has_database(dir: &Path) -> bool {
  dir.join("data").join("config.db").is_file()
}

/// Create `dir` if needed and check that it accepts a new file, so read-only
/// cases (an install under `Program Files`, an AppImage mount) are caught before
/// the app starts writing settings into a directory that cannot take them.
#[cfg(not(target_os = "macos"))]
fn ensure_writable(dir: &Path) -> bool {
  if std::fs::create_dir_all(dir).is_err() {
    return false;
  }
  let probe = dir.join(".write-probe");
  match std::fs::write(&probe, b"") {
    Ok(()) => {
      let _ = std::fs::remove_file(&probe);
      true
    }
    Err(_) => false,
  }
}

/// True when copying `candidate` would descend into the directory being written.
///
/// Both are the same directory in the v0.6 → next upgrade path (data sits in the
/// install directory, so source and target coincide), and the source can contain
/// the target when the app is installed *inside* the old centralized directory.
/// Without this guard such a copy would read its own output and never terminate.
#[cfg(not(target_os = "macos"))]
fn would_nest_into_itself(candidate: &Path, target: &Path) -> bool {
  candidate == target || target.starts_with(candidate)
}

/// Copy the data subdirectories of `from` into `to`, returning the number of
/// files copied.
///
/// Only directories are taken from this level: every location the app writes is
/// a subdirectory (`data/`, `plugins/`, `templates/`, `versions/`), while a file
/// sitting at the source root is the program itself (`EasyCsv.exe`,
/// `uninstall.exe`) or a marker that must not be duplicated into the data
/// folder. A fifth data subdirectory would have to be handled here.
#[cfg(not(target_os = "macos"))]
fn copy_data_dirs(from: &Path, to: &Path) -> std::io::Result<usize> {
  std::fs::create_dir_all(to)?;
  let mut copied = 0usize;
  for entry in std::fs::read_dir(from)? {
    let entry = entry?;
    let source = entry.path();
    if would_nest_into_itself(&source, to) {
      continue;
    }
    if !entry.file_type()?.is_dir() {
      continue;
    }
    copied += copy_dir_recursive(&source, &to.join(entry.file_name()))?;
  }
  Ok(copied)
}

/// Recursively copy `from` into `to`, returning the number of files copied.
///
/// `std::fs` has no recursive copy. Existing files are overwritten, which makes
/// a retry after a partial failure self-healing.
#[cfg(not(target_os = "macos"))]
fn copy_dir_recursive(from: &Path, to: &Path) -> std::io::Result<usize> {
  std::fs::create_dir_all(to)?;
  let mut copied = 0usize;
  for entry in std::fs::read_dir(from)? {
    let entry = entry?;
    let target = to.join(entry.file_name());
    if entry.file_type()?.is_dir() {
      copied += copy_dir_recursive(&entry.path(), &target)?;
    } else {
      std::fs::copy(entry.path(), &target)?;
      copied += 1;
    }
  }
  Ok(copied)
}

struct DbState {
  conn: Mutex<Connection>,
}

static DB_STATE: std::sync::OnceLock<DbState> = std::sync::OnceLock::new();

pub(crate) fn ensure_column(conn: &Connection, table: &str, column: &str, ddl: &str) {
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

const PEPPER: &str = "EasyCsv-ai-key-2024";

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

/// Removes a setting so it falls back to its default.
///
/// Distinct from storing an empty string: an optional text setting such as the
/// download prefix must be able to go back to "unset", which reads as `None` and
/// means "use the catalog's own URLs".
fn delete_config_string(key: &str) -> Result<(), String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
  conn
    .execute("DELETE FROM app_config WHERE key = ?1", params![key])
    .map_err(|e| format!("Failed to delete config value: {}", e))?;
  Ok(())
}

pub fn load_config() -> Result<AppConfig, String> {
  let default = AppConfig::default();

  let default_delimiter = get_config_string("default_delimiter");
  let no_headers = get_config_string("no_headers").and_then(|v| v.parse().ok());
  let auto_detect_delimiter =
    get_config_string("auto_detect_delimiter").and_then(|v| v.parse().ok());
  let show_execution_notification =
    get_config_string("show_execution_notification").and_then(|v| v.parse().ok());
  let minimize_to_tray = get_config_string("minimize_to_tray").and_then(|v| v.parse().ok());
  let double_click_fit_view =
    get_config_string("double_click_fit_view").and_then(|v| v.parse().ok());
  let auto_check_update = get_config_string("auto_check_update").and_then(|v| v.parse().ok());
  let plugin_download_prefix = get_config_string("plugin_download_prefix");
  let max_concurrent_runs = get_config_string("max_concurrent_runs").and_then(|v| v.parse().ok());

  Ok(AppConfig {
    default_delimiter: default_delimiter.or(default.default_delimiter),
    no_headers: no_headers.or(default.no_headers),
    auto_detect_delimiter: auto_detect_delimiter.or(default.auto_detect_delimiter),
    show_execution_notification: show_execution_notification
      .or(default.show_execution_notification),
    minimize_to_tray: minimize_to_tray.or(default.minimize_to_tray),
    double_click_fit_view: double_click_fit_view.or(default.double_click_fit_view),
    auto_check_update: auto_check_update.or(default.auto_check_update),
    plugin_download_prefix: plugin_download_prefix.or(default.plugin_download_prefix),
    max_concurrent_runs: max_concurrent_runs.or(default.max_concurrent_runs),
  })
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
  if let Some(ref v) = config.default_delimiter {
    set_config_string("default_delimiter", v)?;
  }
  if let Some(v) = config.no_headers {
    set_config_string("no_headers", &v.to_string())?;
  }
  if let Some(v) = config.auto_detect_delimiter {
    set_config_string("auto_detect_delimiter", &v.to_string())?;
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
  if let Some(v) = config.auto_check_update {
    set_config_string("auto_check_update", &v.to_string())?;
  }
  if let Some(ref v) = config.plugin_download_prefix {
    // An empty value clears the setting rather than storing an empty prefix.
    if v.trim().is_empty() {
      delete_config_string("plugin_download_prefix")?;
    } else {
      set_config_string("plugin_download_prefix", v)?;
    }
  }
  if let Some(v) = config.max_concurrent_runs {
    set_config_string("max_concurrent_runs", &v.to_string())?;
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
pub async fn get_auto_detect_delimiter() -> Option<bool> {
  load_config().unwrap_or_default().auto_detect_delimiter
}

#[tauri::command]
pub async fn set_auto_detect_delimiter(enabled: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.auto_detect_delimiter = Some(enabled);
  save_config(&config)
}

#[tauri::command]
pub async fn get_max_concurrent_runs() -> Option<u32> {
  load_config().unwrap_or_default().max_concurrent_runs
}

/// Persist the parallelism limit (design 028 §7.1).
///
/// Clamped to 1..=16: `0` would dead-lock the queue, and a large value would
/// let the user spawn an unbounded number of xan process chains.
#[tauri::command]
pub async fn set_max_concurrent_runs(value: u32) -> Result<(), String> {
  let mut config = load_config()?;
  config.max_concurrent_runs = Some(value.clamp(1, 16));
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
pub async fn get_auto_check_update() -> Option<bool> {
  load_config().unwrap_or_default().auto_check_update
}

#[tauri::command]
pub async fn set_auto_check_update(enabled: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.auto_check_update = Some(enabled);
  save_config(&config)
}

/// The proxy prefix applied to plugin downloads, or `None` when unset.
#[tauri::command]
pub async fn get_plugin_download_prefix() -> Option<String> {
  load_config().unwrap_or_default().plugin_download_prefix
}

/// The stored prefix, for the download path — which runs outside a command
/// context and so cannot use the `#[tauri::command]` wrapper.
pub fn plugin_download_prefix() -> Option<String> {
  load_config().unwrap_or_default().plugin_download_prefix
}

/// Stores the download prefix after checking it is a usable https prefix.
///
/// Validated here rather than at download time so the settings page can reject a
/// typo immediately. An https-only rule is deliberate: the prefix is prepended to
/// URLs the catalog pins, and allowing `http://` or a loopback host would let a
/// local misconfiguration turn every plugin download into plain text — the
/// sha256 check would still catch tampering, but there is no reason to ship a
/// transport that invites it.
#[tauri::command]
pub async fn set_plugin_download_prefix(prefix: Option<String>) -> Result<(), String> {
  let normalized = match prefix {
    Some(value) if !value.trim().is_empty() => Some(normalize_download_prefix(&value)?),
    // `None` and the empty string both mean "stop using a prefix".
    _ => None,
  };
  let mut config = load_config()?;
  config.plugin_download_prefix = normalized;
  save_config(&config)
}

/// Turns user input into a canonical `https://host/path/` prefix, or explains why
/// it cannot be used.
///
/// Accepts what people actually paste — a bare host, a `http://` prefix from a
/// tutorial, a missing trailing slash — and only rejects what cannot work.
pub fn normalize_download_prefix(raw: &str) -> Result<String, String> {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return Err("the prefix is empty".to_string());
  }

  // Tolerate a schemeless paste ("ghproxy.example/") by assuming https; reject
  // an explicit http:// instead of silently upgrading it, because the user may
  // be pasting a proxy that only speaks http and should be told so.
  let with_scheme = if let Some(rest) = trimmed.strip_prefix("https://") {
    rest
  } else if trimmed.starts_with("http://") {
    return Err(
      "only https:// prefixes are allowed — a plain http:// proxy would not be encrypted"
        .to_string(),
    );
  } else if trimmed.contains("://") {
    return Err("the prefix must be an https:// URL".to_string());
  } else {
    trimmed
  };

  let host = crate::plugin_catalog::host_of(with_scheme);
  if host.is_empty() {
    return Err("the prefix has no host".to_string());
  }
  if !host.contains('.') {
    // Catches "localhost" and typos alike; a real proxy is a domain or an IP.
    return Err(format!("{host} is not a valid proxy host"));
  }

  let mut normalized = format!("https://{with_scheme}");
  if !normalized.ends_with('/') {
    normalized.push('/');
  }
  Ok(normalized)
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

#[cfg(all(test, not(target_os = "macos")))]
mod tests {
  use super::*;

  /// A unique scratch directory, built by hand to keep this crate on its
  /// zero-dev-dependency test setup (see the tests in `plugins.rs`).
  fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("EasyCsv-config-test-{name}"));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  fn seed_database(dir: &Path) {
    std::fs::create_dir_all(dir.join("data")).unwrap();
    std::fs::write(dir.join("data").join("config.db"), b"db").unwrap();
  }

  /// A stand-in for the data directory of an install (`<dir>/EasyCsv`).
  fn target(root: &Path) -> PathBuf {
    let dir = root.join("EasyCsv");
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn only_a_real_database_counts_as_data() {
    let root = scratch("has-db");
    assert!(!has_database(&root));

    // A marker on its own must never shadow a directory that holds real data.
    std::fs::write(root.join(IN_PLACE_MARKER), b"").unwrap();
    assert!(!has_database(&root));

    seed_database(&root);
    assert!(has_database(&root));
    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn writability_probe_creates_the_directory_and_leaves_no_trace() {
    let root = scratch("writable");
    let target = root.join("EasyCsv");

    assert!(ensure_writable(&target));
    assert!(target.is_dir());
    assert!(!target.join(".write-probe").exists());

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn copy_is_recursive_and_overwrites_partial_leftovers() {
    let root = scratch("copy");
    let from = root.join("from");
    let to = root.join("to");
    std::fs::create_dir_all(from.join("data")).unwrap();
    std::fs::create_dir_all(from.join("plugins").join("windows-x86_64")).unwrap();
    std::fs::write(from.join("data").join("config.db"), b"new").unwrap();
    std::fs::write(
      from.join("plugins").join("windows-x86_64").join("xan.exe"),
      b"x",
    )
    .unwrap();
    // Leftovers from an interrupted earlier attempt must be overwritten.
    std::fs::create_dir_all(to.join("data")).unwrap();
    std::fs::write(to.join("data").join("config.db"), b"old").unwrap();

    assert_eq!(copy_data_dirs(&from, &to).unwrap(), 2);
    assert_eq!(
      std::fs::read(to.join("data").join("config.db")).unwrap(),
      b"new"
    );
    assert!(
      to.join("plugins")
        .join("windows-x86_64")
        .join("xan.exe")
        .is_file()
    );

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn only_entries_that_do_not_contain_the_target_are_copied() {
    let target = Path::new("app").join("EasyCsv");

    // The target itself, and any directory that contains it.
    assert!(would_nest_into_itself(&target, &target));
    assert!(would_nest_into_itself(Path::new("app"), &target));

    // Siblings and their contents.
    assert!(!would_nest_into_itself(Path::new("app/data"), &target));
    assert!(!would_nest_into_itself(Path::new("app/plugins"), &target));
    assert!(!would_nest_into_itself(
      &Path::new("app").join(LEGACY_DIR_NAME),
      &target
    ));
  }

  /// The install directory holds both the program and the data, so copying the
  /// program files into the data folder would be wrong — and a source that
  /// contains the target must be skipped instead of recursed into.
  #[test]
  fn a_target_inside_the_source_is_skipped() {
    let root = scratch("self-nesting");
    let source = root.join("install");
    let nested_target = source.join("EasyCsv");
    seed_database(&source);
    std::fs::create_dir_all(source.join("plugins")).unwrap();
    std::fs::write(source.join("plugins").join("xan.exe"), b"x").unwrap();
    // Program files at the source root must not be duplicated into the data dir.
    std::fs::write(source.join("EasyCsv.exe"), b"binary").unwrap();

    assert_eq!(copy_data_dirs(&source, &nested_target).unwrap(), 2);
    assert!(nested_target.join("data").join("config.db").is_file());
    assert!(nested_target.join("plugins").join("xan.exe").is_file());
    assert!(!nested_target.join("EasyCsv.exe").exists());
    assert!(!nested_target.join("EasyCsv").exists());

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn the_v06_snapshot_wins_over_the_legacy_in_place_directory() {
    let root = scratch("source-priority");
    let target = target(&root);
    let centralized = root.join("centralized");
    seed_database(&centralized);
    // Both pre-022 locations at once.
    seed_database(&target.join(LEGACY_DIR_NAME));
    seed_database(&root.join(LEGACY_DIR_NAME));

    assert_eq!(
      migration_source(&target, &centralized),
      Some(centralized.clone())
    );

    // Once its data has moved out, the shared snapshot must not seed a second
    // install directory with the same stale copy — and neither may the legacy
    // directories, because a centralized directory proves this machine ran v0.6.
    std::fs::write(centralized.join(MOVED_AWAY_MARKER), b"").unwrap();
    assert_eq!(migration_source(&target, &centralized), None);

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn the_legacy_directory_is_a_source_only_without_a_centralized_one() {
    let root = scratch("legacy");
    let target = target(&root);
    let centralized = root.join("centralized");

    // Default install path in v0.4/v0.5: the data was a subdirectory of what is
    // the data directory now.
    let next_to_the_target = target.join(LEGACY_DIR_NAME);
    seed_database(&next_to_the_target);
    assert_eq!(
      migration_source(&target, &centralized),
      Some(next_to_the_target.clone())
    );
    let _ = std::fs::remove_dir_all(&next_to_the_target);

    // Custom install path in v0.4/v0.5: the data was a sibling (the install
    // directory then was what is the parent now).
    let one_level_up = root.join(LEGACY_DIR_NAME);
    seed_database(&one_level_up);
    assert_eq!(migration_source(&target, &centralized), Some(one_level_up));

    // An empty centralized directory is enough to prove this machine ran v0.6,
    // which makes the legacy directory the older generation (`target/<profile>`
    // leftovers on a dev box).
    std::fs::create_dir_all(&centralized).unwrap();
    assert_eq!(migration_source(&target, &centralized), None);

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn the_data_directory_is_never_its_own_migration_source() {
    let root = scratch("self-source");
    let target = target(&root);
    seed_database(&target);

    assert_eq!(migration_source(&target, &target), None);

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn a_fresh_install_has_nothing_to_migrate() {
    let root = scratch("fresh");
    assert_eq!(
      migration_source(&target(&root), &root.join("centralized")),
      None
    );
    let _ = std::fs::remove_dir_all(&root);
  }
}

/// Separate from the module above: that one is skipped on macOS because it is
/// about the Windows/Linux data directory, while this is platform-independent.
#[cfg(test)]
mod download_prefix_tests {
  use super::*;

  #[test]
  fn accepts_the_forms_people_actually_paste() {
    // Trailing slash optional, and a schemeless paste is assumed to be https.
    for input in [
      "https://ghproxy.example/",
      "https://ghproxy.example",
      "https://ghproxy.example/  ",
      "ghproxy.example",
    ] {
      assert_eq!(
        normalize_download_prefix(input).unwrap(),
        "https://ghproxy.example/",
        "{input:?} should normalize to a canonical prefix"
      );
    }
    // A path is preserved: some proxies are namespaced.
    assert_eq!(
      normalize_download_prefix("https://proxy.example/gh/").unwrap(),
      "https://proxy.example/gh/"
    );
  }

  #[test]
  fn refuses_plain_http_rather_than_silently_upgrading_it() {
    // Silently adding an `s` would leave the user believing an http-only proxy
    // works; telling them is the point.
    let error = normalize_download_prefix("http://ghproxy.example/").unwrap_err();
    assert!(error.contains("https"), "unexpected message: {error}");
  }

  #[test]
  fn refuses_what_cannot_be_a_proxy() {
    for bad in [
      "",
      "   ",
      "https://",
      "https:///path",
      "file:///tmp/",
      "localhost",
    ] {
      assert!(
        normalize_download_prefix(bad).is_err(),
        "{bad:?} must be rejected"
      );
    }
  }
}
