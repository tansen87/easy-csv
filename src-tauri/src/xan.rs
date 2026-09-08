use crate::plugins::{get_plugin_dir, resolve_executable};

// xan is NOT packaged with the application. The user drops the binary into
// `<resources>/plugins/<target>/xan(.exe)` (or installs `xan` on `PATH`); the
// app locates it at runtime. This keeps the macOS/Linux artifacts free of the
// multi-MB CLI binaries.

/// Locate the xan binary, preferring the platform plugin directory and
/// falling back to `PATH`. Returns the absolute path when found.
pub fn find_xan_executable() -> Option<String> {
  let plugin_dir = get_plugin_dir();
  let candidate = plugin_dir.join(if cfg!(target_os = "windows") {
    "xan.exe"
  } else {
    "xan"
  });
  if candidate.is_file() {
    return Some(candidate.to_string_lossy().to_string());
  }
  resolve_executable("xan").map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn check_xan_installed() -> bool {
  find_xan_executable().is_some()
}