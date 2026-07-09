use crate::config::get_resources_dir;

// Embed xan.exe binary at compile time
const XAN_EXE_BYTES: &[u8] = include_bytes!("../resources/xan.exe");

/// Extract embedded xan.exe to resources directory
fn extract_xan_executable() -> Result<String, String> {
  let resources_dir = get_resources_dir();
  let xan_path = resources_dir.join("xan.exe");

  // Check if already extracted and valid
  if xan_path.exists() {
    // Verify the file size matches (simple integrity check)
    if let Ok(metadata) = std::fs::metadata(&xan_path) {
      if metadata.len() == XAN_EXE_BYTES.len() as u64 {
        return Ok(xan_path.to_string_lossy().to_string());
      }
    }
  }

  // Create resources directory if it doesn't exist
  if !resources_dir.exists() {
    std::fs::create_dir_all(&resources_dir)
      .map_err(|e| format!("Failed to create resources directory: {}", e))?;
  }

  // Extract xan.exe
  std::fs::write(&xan_path, XAN_EXE_BYTES)
    .map_err(|e| format!("Failed to extract xan.exe: {}", e))?;

  Ok(xan_path.to_string_lossy().to_string())
}

pub fn find_xan_executable() -> Option<String> {
  extract_xan_executable().ok()
}

#[tauri::command]
pub async fn check_xan_installed() -> bool {
  find_xan_executable().is_some()
}
