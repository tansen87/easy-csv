#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::config::get_resources_dir;

/// Sub-directory under `<resources>/plugins/` where users drop their binaries,
/// named after the compile target so a single data dir can host several
/// platforms side by side.
#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const PLATFORM_DIR: &str = "windows-x86_64";
#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const PLATFORM_DIR: &str = "macos-aarch64";
#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const PLATFORM_DIR: &str = "macos-x86_64";
#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const PLATFORM_DIR: &str = "linux-x86_64-gnu";
#[cfg(all(target_os = "linux", target_arch = "aarch64"))]
const PLATFORM_DIR: &str = "linux-aarch64-gnu";
#[cfg(not(any(
  all(target_os = "windows", target_arch = "x86_64"),
  all(target_os = "macos", target_arch = "aarch64"),
  all(target_os = "macos", target_arch = "x86_64"),
  all(target_os = "linux", target_arch = "x86_64"),
  all(target_os = "linux", target_arch = "aarch64"),
)))]
const PLATFORM_DIR: &str = "unsupported";

/// Directory where users place plugin binaries: `<resources>/plugins/<target>/`.
///
/// `xan`/`pinyin` are NOT shipped with the application. The user drops
/// `xan(.exe)` / `pinyin(.exe)` into this directory (or installs them on
/// `PATH`); the app locates them at runtime.
pub fn get_plugin_dir() -> std::path::PathBuf {
  get_resources_dir().join("plugins").join(PLATFORM_DIR)
}

/// Ensure the plugin directory exists so users have a place to drop binaries.
/// Best-effort: callers do not require it, but a missing folder later shows a
/// clearer "not found" error than a confusing permission issue.
pub fn ensure_plugin_dir_exists() {
  let _ = std::fs::create_dir_all(get_plugin_dir());
}

/// A registered CLI plugin. `name` is the command name used inside pipelines
/// (e.g. `pinyin`), `executable` is either an absolute path or a binary name
/// that is resolved through `PATH`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
  pub name: String,
  pub executable: String,
}

/// Result of a plugin availability check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginStatus {
  pub name: String,
  pub executable: String,
  pub found: bool,
  pub version: String,
}

struct DbState {
  conn: Mutex<Connection>,
}

static DB_STATE: std::sync::OnceLock<DbState> = std::sync::OnceLock::new();

fn get_db() -> Option<&'static DbState> {
  DB_STATE.get().or_else(|| {
    let resources_dir = get_resources_dir();
    let db_dir = resources_dir.join("data");
    std::fs::create_dir_all(&db_dir).ok()?;
    let db_path = db_dir.join("plugins.db");
    let conn = Connection::open(db_path).ok()?;

    conn
      .execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS plugins (
          name TEXT PRIMARY KEY,
          executable TEXT NOT NULL
        );
        "#,
      )
      .ok()?;

    let seeded: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM plugins WHERE name = 'pinyin'",
        [],
        |row| row.get(0),
      )
      .unwrap_or(0);
    if seeded == 0 {
      let _ = conn.execute(
        "INSERT INTO plugins (name, executable) VALUES ('pinyin', 'pinyin')",
        [],
      );
    }

    let seeded_xan: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM plugins WHERE name = 'xan'",
        [],
        |row| row.get(0),
      )
      .unwrap_or(0);
    if seeded_xan == 0 {
      let _ = conn.execute(
        "INSERT INTO plugins (name, executable) VALUES ('xan', 'xan')",
        [],
      );
    }

    // DuckDB CLI (optional plugin, NOT bundled). Registering the mapping here
    // lets `command_executable("duckdb")` route to the user-dropped binary; the
    // binary itself must be placed in the platform plugin dir by the user.
    let seeded_duckdb: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM plugins WHERE name = 'duckdb'",
        [],
        |row| row.get(0),
      )
      .unwrap_or(0);
    if seeded_duckdb == 0 {
      let _ = conn.execute(
        "INSERT INTO plugins (name, executable) VALUES ('duckdb', 'duckdb')",
        [],
      );
    }

    // Make sure the plugin folder exists so users have a documented place to
    // drop xan/pinyin binaries.
    ensure_plugin_dir_exists();

    let state = DbState {
      conn: Mutex::new(conn),
    };
    DB_STATE.set(state).ok()?;
    DB_STATE.get()
  })
}

/// Resolve an executable name/path. Checks in order:
/// 1. the path as given (relative to cwd or absolute),
/// 2. the extra directories (before `PATH`),
/// 3. `PATH` entries.
fn resolve_executable_with_dirs(name: &str, extra_dirs: &[std::path::PathBuf]) -> Option<PathBuf> {
  let path = PathBuf::from(name);

  if path.is_file() {
    return Some(path);
  }
  if path.is_absolute() {
    return None;
  }
  if name.contains('/') || name.contains('\\') {
    return path.is_file().then_some(path);
  }

  for dir in extra_dirs {
    let candidate = dir.join(name);
    if candidate.is_file() {
      return Some(candidate);
    }
    #[cfg(target_os = "windows")]
    {
      let candidate_exe = dir.join(format!("{}.exe", name));
      if candidate_exe.is_file() {
        return Some(candidate_exe);
      }
    }
  }

  let path_var = std::env::var_os("PATH")?;
  for dir in std::env::split_paths(&path_var) {
    let candidate = dir.join(name);
    if candidate.is_file() {
      return Some(candidate);
    }
    #[cfg(target_os = "windows")]
    {
      let candidate_exe = dir.join(format!("{}.exe", name));
      if candidate_exe.is_file() {
        return Some(candidate_exe);
      }
    }
  }
  None
}

/// Resolve an executable name/path, searching `PATH` when needed.
pub fn resolve_executable(name: &str) -> Option<PathBuf> {
  resolve_executable_with_dirs(name, &[])
}

/// Resolve a plugin's executable. The `<resources>/plugins/` directory is
/// preferred over `PATH`, so a binary dropped there is used by default.
pub fn resolve_plugin_executable(name: &str) -> Option<PathBuf> {
  let plugin_dir = get_plugin_dir();
  resolve_executable_with_dirs(name, std::slice::from_ref(&plugin_dir))
}

/// Return the resolved executable for a pipeline command.
/// Plugin commands are resolved to the registered plugin binary,
/// everything else falls back to the xan binary.
pub fn command_executable(name: &str, xan_path: &Path) -> Result<PathBuf, String> {
  if let Some(plugins) = get_plugin(name) {
    resolve_plugin_executable(&plugins.executable).ok_or_else(|| {
      format!(
        "plugins executable '{}' for command '{}' not found",
        plugins.executable, name
      )
    })
  } else {
    Ok(xan_path.to_path_buf())
  }
}

fn get_plugin(name: &str) -> Option<Plugin> {
  let db = get_db()?;
  let conn = db.conn.lock().ok()?;
  conn
    .query_row(
      "SELECT name, executable FROM plugins WHERE name = ?1",
      params![name],
      |row| {
        Ok(Plugin {
          name: row.get(0)?,
          executable: row.get(1)?,
        })
      },
    )
    .ok()
}

/// Whether a pipeline command name refers to a registered plugin.
pub fn is_plugin_command(name: &str) -> bool {
  get_plugin(name).is_some()
}

#[tauri::command]
pub async fn list_plugins() -> Result<Vec<Plugin>, String> {
  let db = get_db().ok_or("Database not initialized")?;
  let conn = db.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

  let mut stmt = conn
    .prepare(
      "SELECT name, executable FROM plugins \
       ORDER BY CASE WHEN name = 'xan' THEN 0 ELSE 1 END, name",
    )
    .map_err(|e| format!("Failed to prepare statement: {}", e))?;

  let rows = stmt
    .query_map([], |row| {
      Ok(Plugin {
        name: row.get(0)?,
        executable: row.get(1)?,
      })
    })
    .map_err(|e| format!("Failed to query plugins: {}", e))?;

  let mut plugins = Vec::new();
  for row in rows {
    plugins.push(row.map_err(|e| format!("Failed to read plugin: {}", e))?);
  }
  Ok(plugins)
}

#[tauri::command]
pub async fn check_plugins() -> Result<Vec<PluginStatus>, String> {
  let plugins = list_plugins().await?;

  let mut statuses = Vec::new();
  for plugin in plugins {
    let found = resolve_plugin_executable(&plugin.executable);
    let version = match &found {
      Some(path) => {
        let mut cmd = Command::new(path);
        // DuckDB's CLI reports its version with `-version` (SQLite shell style);
        // xan/pinyin use the conventional `--version`.
        let version_arg = if plugin.name == "duckdb" {
          "-version"
        } else {
          "--version"
        };
        cmd.arg(version_arg);
        #[cfg(target_os = "windows")]
        {
          cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        cmd
          .output()
          .map(|out| String::from_utf8_lossy(&out.stdout).trim().to_string())
          .unwrap_or_default()
      }
      None => String::new(),
    };
    statuses.push(PluginStatus {
      name: plugin.name,
      executable: plugin.executable,
      found: found.is_some(),
      version,
    });
  }

  Ok(statuses)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn resolves_command_found_on_path() {
    #[cfg(target_os = "windows")]
    let name = "cmd";
    #[cfg(not(target_os = "windows"))]
    let name = "sh";
    assert!(resolve_executable(name).is_some());
  }

  #[test]
  fn missing_command_returns_none() {
    assert!(resolve_executable("definitely-not-a-real-binary-xyz-12345").is_none());
  }

  #[test]
  fn absolute_missing_path_returns_none() {
    let bogus = std::env::temp_dir().join("no-such-file-xyz-12345.exe");
    assert!(resolve_executable(&bogus.to_string_lossy()).is_none());
  }

  #[test]
  fn extra_dirs_are_searched_before_path() {
    let dir = std::env::temp_dir().join("EasyCsv-plugin-test-dir");
    std::fs::create_dir_all(&dir).unwrap();
    #[cfg(target_os = "windows")]
    let file = dir.join("plugin-probe-xyz.exe");
    #[cfg(not(target_os = "windows"))]
    let file = dir.join("plugin-probe-xyz");
    std::fs::write(&file, b"probe").unwrap();

    let resolved = resolve_executable_with_dirs("plugin-probe-xyz", &[dir.clone()]);
    assert!(resolved.is_some());
    assert_eq!(resolved.unwrap(), file);

    // Without the extra dirs the name must not resolve.
    assert!(resolve_executable("plugin-probe-xyz").is_none());
    let _ = std::fs::remove_dir_all(&dir);
  }

  #[test]
  fn unknown_commands_fall_back_to_xan() {
    let xan = Path::new("C:/fake/xan.exe");
    let exe = command_executable("select", xan).unwrap();
    assert_eq!(exe, xan);
  }

  #[test]
  fn user_placed_binary_in_plugin_dir_resolves() {
    // With embedded extraction removed, a binary the user drops into the
    // platform plugin sub-dir must still resolve by name.
    let dir = get_plugin_dir();
    std::fs::create_dir_all(&dir).unwrap();
    #[cfg(target_os = "windows")]
    let file = dir.join("pinyin.exe");
    #[cfg(not(target_os = "windows"))]
    let file = dir.join("pinyin");
    std::fs::write(&file, b"probe").unwrap();

    let resolved = resolve_plugin_executable("pinyin");
    assert!(resolved.is_some());

    let _ = std::fs::remove_file(&file);
  }
}
