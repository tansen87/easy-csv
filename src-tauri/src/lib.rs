use std::fs::File;
use std::io::{BufReader, ErrorKind, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::{Deserialize, Serialize};
use serde_json::Map;
use tauri::{
  Manager, WindowEvent,
  menu::{Menu, MenuItem},
  tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
};

// Embed xan.exe binary at compile time
const XAN_EXE_BYTES: &[u8] = include_bytes!("../resources/xan.exe");

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
  pub default_delimiter: Option<String>,
  pub no_headers: Option<bool>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      default_delimiter: None,
      no_headers: None,
    }
  }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PipelineCommand {
  pub name: String,
  pub parameters: Vec<CommandParameter>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandParameter {
  pub name: String,
  pub value: String,
  #[serde(rename = "isPositional")]
  pub is_positional: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExecutionResult {
  pub success: bool,
  pub output: String,
  pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CsvData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
}

#[tauri::command]
async fn read_csv_file(
  file_path: String,
  delimiter: String,
  limit: Option<usize>,
) -> Result<CsvData, String> {
  let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;

  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(delimiter.as_bytes()[0])
    .from_reader(BufReader::new(file));

  let headers = rdr
    .headers()
    .map_err(|e| format!("Failed to read headers: {}", e))?
    .iter()
    .map(|s| s.to_string())
    .collect();

  let row_limit = limit.unwrap_or(51);
  let mut rows = Vec::new();
  for result in rdr.records() {
    if rows.len() >= row_limit {
      break;
    }
    let record = result.map_err(|e| format!("Failed to read row: {}", e))?;
    rows.push(record.iter().map(|s| s.to_string()).collect());
  }

  Ok(CsvData { headers, rows })
}

#[tauri::command]
async fn profile_csv(file_path: String, delimiter: String) -> Result<String, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let output = tokio::task::spawn_blocking(move || -> Result<std::process::Output, String> {
    let mut command = Command::new(&xan_path);
    command
      .arg("stats")
      .arg("-t")
      .arg("4")
      .arg("--delimiter")
      .arg(&delimiter)
      .arg(&file_path);

    #[cfg(target_os = "windows")]
    {
      command.creation_flags(0x08000000);
    }

    command
      .output()
      .map_err(|e| format!("Failed to execute xan stats: {}", e))
  })
  .await
  .map_err(|e| format!("Task join error: {}", e))?
  .map_err(|e| e)?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(format!("xan stats failed: {}", stderr));
  }

  Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
async fn execute_xan_pipeline(
  commands: Vec<PipelineCommand>,
  input_file: String,
  default_delimiter: String,
) -> Result<ExecutionResult, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let config = load_config()?;
  let no_headers_enabled = config.no_headers.unwrap_or(false);

  let first_cmd = commands.first().ok_or("No commands provided")?;
  let first_is_cat = matches!(first_cmd.name.as_str(), "cat");
  if !first_is_cat && !Path::new(&input_file).exists() {
    return Err(format!("Input file does not exist"));
  }

  let mut cmd_args_list = Vec::new();
  for (i, cmd) in commands.iter().enumerate() {
    let mut args = vec![cmd.name.clone()];

    if i == 0 {
      if no_headers_enabled {
        args.push("--no-headers".to_string());
      }
    }

    let mut positional_args = Vec::new();
    let mut optional_args = Vec::new();

    for param in &cmd.parameters {
      if param.value == "true" {
        optional_args.push(format!("--{}", param.name));
      } else if !param.value.is_empty() {
        if param.is_positional.unwrap_or(false) {
          positional_args.push(param.value.clone());
        } else {
          optional_args.push(format!("--{}", param.name));
          optional_args.push(param.value.clone());
        }
      }
    }

    let supports_delimiter = !matches!(cmd.name.as_str(), "from" | "range" | "eval" | "run");

    if supports_delimiter && i == 0 {
      optional_args.push("-d".to_string());
      optional_args.push(default_delimiter.clone());
    }

    args.extend(positional_args);
    args.extend(optional_args);

    cmd_args_list.push(args);
  }

  let output = tokio::task::spawn_blocking(move || -> Result<std::process::Output, String> {
    let first_cmd_name = &cmd_args_list[0][0].clone();
    let is_cat_command = first_cmd_name.as_str() == "cat";
    let num_commands = cmd_args_list.len();

    let mut input_file_handle: Option<File> = if is_cat_command {
      None
    } else {
      Some(File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?)
    };

    // Always use piped I/O so we can capture output
    let mut command = Command::new(&xan_path);
    command.args(&cmd_args_list[0]);
    if is_cat_command {
      command.stdin(Stdio::null());
    } else {
      command.stdin(Stdio::piped());
    }
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
      command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut first_child = command
      .spawn()
      .map_err(|e| format!("Failed to start first xan command: {}", e))?;

    if num_commands == 1 {
      // Single command pipeline
      let first_cmd_name = &cmd_args_list[0][0];
      let needs_file_path = matches!(first_cmd_name.as_str(), "sort" | "dedup" | "shuffle");

      if needs_file_path {
        // For commands that need file paths, ensure input file is the last argument
        let mut args = vec![cmd_args_list[0][0].clone()];

        // Add all parameters except the command name
        // This already includes delimiter and other options
        for arg in &cmd_args_list[0][1..] {
          args.push(arg.clone());
        }

        // Add input file as the last argument
        args.push(input_file.clone());

        let mut command = Command::new(&xan_path);
        command.args(args);
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
          command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = command
          .spawn()
          .map_err(|e| format!("Failed to start command: {}", e))?;

        child
          .wait_with_output()
          .map_err(|e| format!("Wait for command failed: {}", e))
      } else if is_cat_command {
        first_child
          .wait_with_output()
          .map_err(|e| format!("Wait for command failed: {}", e))
      } else {
        {
          let mut stdin = first_child
            .stdin
            .take()
            .ok_or("Failed to get stdin handle")?;
          let mut buffer = vec![0; 256 * 1024];
          let mut file = input_file_handle.take().unwrap();
          loop {
            match file.read(&mut buffer) {
              Ok(0) => break,
              Ok(n) => {
                if let Err(e) = stdin.write_all(&buffer[..n]) {
                  if e.kind() != ErrorKind::BrokenPipe {
                    return Err(format!("Write to stdin failed: {}", e));
                  }
                  break;
                }
              }
              Err(e) => return Err(format!("Read input file failed: {}", e)),
            }
          }
        }

        first_child
          .wait_with_output()
          .map_err(|e| format!("Wait for command failed: {}", e))
      }
    } else {
      // Multi-command pipeline
      let all_stderr = Arc::new(Mutex::new(Vec::new()));
      let all_errors = Arc::new(Mutex::new(Vec::new()));
      let mut children = Vec::new();
      let mut stderr_threads = Vec::new();
      let mut pipe_threads = Vec::new();
      let mut output_handles = Vec::new();

      // Read first child's stderr in background thread
      let first_stderr = first_child
        .stderr
        .take()
        .ok_or("Failed to get stderr handle")?;
      let stderr_clone = Arc::clone(&all_stderr);
      stderr_threads.push(thread::spawn(move || {
        let mut reader = BufReader::new(first_stderr);
        let mut buf = Vec::new();
        if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
          if let Ok(mut guard) = stderr_clone.lock() {
            guard.push(buf);
          }
        }
      }));

      // Store stdout handle for piping
      let first_stdout = first_child
        .stdout
        .take()
        .ok_or("Failed to get stdout handle")?;
      children.push(first_child);
      output_handles.push(first_stdout);

      // Start all remaining commands and connect pipes BEFORE feeding input
      for (_idx, args) in cmd_args_list.into_iter().skip(1).enumerate() {
        let mut command = Command::new(&xan_path);
        command.args(args);
        command.stdin(Stdio::piped());
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
          command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let mut child = command
          .spawn()
          .map_err(|e| format!("Start pipeline command failed: {}", e))?;

        // Get stdin handle for next pipe connection
        let child_stdin = child.stdin.take().ok_or("Failed to get stdin handle")?;

        // Get stdout handle for storing
        let child_stdout = child.stdout.take().ok_or("Failed to get stdout handle")?;

        // Connect previous stdout to this child's stdin using thread
        let prev_stdout = output_handles
          .pop()
          .ok_or("Failed to get previous stdout handle")?;
        let errors_clone = Arc::clone(&all_errors);
        let pipe_thread = thread::spawn(move || {
          let mut reader = BufReader::new(prev_stdout);
          let mut writer = child_stdin;
          let mut buffer = vec![0; 64 * 1024]; // Use smaller buffer for better responsiveness

          loop {
            match reader.read(&mut buffer) {
              Ok(0) => break, // EOF
              Ok(n) => {
                if let Err(e) = writer.write_all(&buffer[..n]) {
                  if e.kind() != ErrorKind::BrokenPipe {
                    if let Ok(mut guard) = errors_clone.lock() {
                      guard.push(format!("Pipe write failed: {}", e));
                    }
                  }
                  break;
                }
              }
              Err(e) => {
                if let Ok(mut guard) = errors_clone.lock() {
                  guard.push(format!("Pipe read failed: {}", e));
                }
                break;
              }
            }
          }
        });
        pipe_threads.push(pipe_thread);

        // Read this child's stderr in background thread
        let child_stderr = child.stderr.take().ok_or("Failed to get stderr handle")?;
        let stderr_clone = Arc::clone(&all_stderr);
        stderr_threads.push(thread::spawn(move || {
          let mut reader = BufReader::new(child_stderr);
          let mut buf = Vec::new();
          if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
            if let Ok(mut guard) = stderr_clone.lock() {
              guard.push(buf);
            }
          }
        }));

        children.push(child);
        output_handles.push(child_stdout);
      }

      if !is_cat_command {
        let first_child = children.first_mut().ok_or("Failed to get first child")?;
        let mut stdin = first_child
          .stdin
          .take()
          .ok_or("Failed to get stdin handle")?;

        let mut input_file_clone =
          File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?;

        let errors_clone = Arc::clone(&all_errors);
        thread::spawn(move || {
          let mut buffer = vec![0; 64 * 1024];
          loop {
            match input_file_clone.read(&mut buffer) {
              Ok(0) => break,
              Ok(n) => {
                if let Err(e) = stdin.write_all(&buffer[..n]) {
                  if e.kind() != ErrorKind::BrokenPipe {
                    if let Ok(mut guard) = errors_clone.lock() {
                      guard.push(format!("Write to stdin failed: {}", e));
                    }
                  }
                  break;
                }
              }
              Err(e) => {
                if let Ok(mut guard) = errors_clone.lock() {
                  guard.push(format!("Read input file failed: {}", e));
                }
                break;
              }
            }
          }
        });
      }

      // Get output from last child using non-blocking approach
      let mut last_child = children.pop().ok_or("Failed to get last child")?;
      let last_stdout = output_handles
        .pop()
        .ok_or("Failed to get last stdout handle")?;

      // Read stdout in a thread to prevent deadlock
      let stdout_thread = thread::spawn(move || {
        let mut reader = BufReader::new(last_stdout);
        let mut buf = Vec::new();
        match reader.read_to_end(&mut buf) {
          Ok(_) => buf,
          Err(e) => {
            let mut error_buf = Vec::new();
            error_buf.extend_from_slice(format!("Stdout read failed: {}", e).as_bytes());
            error_buf
          }
        }
      });

      // Monitor middle commands while waiting for last child
      // If any middle command fails, kill the last child to break deadlock
      let mut final_status = None;
      let mut try_wait_error = None;

      while final_status.is_none() && try_wait_error.is_none() {
        match last_child.try_wait() {
          Ok(Some(status)) => {
            final_status = Some(status);
            break;
          }
          Ok(None) => {
            let mut any_failed = false;
            for child in &mut children {
              match child.try_wait() {
                Ok(Some(child_status)) => {
                  if !child_status.success() {
                    any_failed = true;
                    if final_status.is_none() {
                      final_status = Some(child_status);
                    }
                  }
                }
                Ok(None) => {}
                Err(_) => {}
              }
            }

            if any_failed {
              for child in &mut children {
                let _ = child.kill();
              }
              for child in &mut children {
                let _ = child.wait();
              }
              let _ = last_child.kill();
              if let Ok(status) = last_child.wait() {
                if final_status.is_none() {
                  final_status = Some(status);
                }
              }
              break;
            }

            thread::sleep(std::time::Duration::from_millis(50));
          }
          Err(e) => {
            try_wait_error = Some(format!("Error checking last child status: {}", e));
          }
        }
      }

      if let Some(err) = try_wait_error {
        return Err(err);
      }

      let final_status = if let Some(status) = final_status {
        status
      } else {
        last_child
          .wait()
          .unwrap_or_else(|_| std::process::Command::new("").status().unwrap())
      };

      // Get stdout from thread
      let stdout = stdout_thread.join().unwrap_or_default();

      // Clean up remaining children
      for mut child in children {
        let _ = child.kill();
        let _ = child.wait();
      }

      // Wait for all pipe threads to finish
      // They should exit after children are killed (BrokenPipe)
      for t in pipe_threads {
        let _ = t.join();
      }

      // Wait for all stderr threads and combine stderr
      for t in stderr_threads {
        let _ = t.join();
      }
      let mut combined_stderr = all_stderr.lock().unwrap().join(&b"\n"[..]);

      // Add any pipe/input errors to stderr
      let errors = all_errors.lock().unwrap();
      if !errors.is_empty() {
        if !combined_stderr.is_empty() {
          combined_stderr.extend_from_slice(&b"\n"[..]);
        }
        combined_stderr.extend_from_slice(errors.join("\n").as_bytes());
      }

      Ok(std::process::Output {
        status: final_status,
        stdout,
        stderr: combined_stderr,
      })
    }
  })
  .await
  .map_err(|e| format!("Task execution failed: {}", e))??;

  Ok(ExecutionResult {
    success: output.status.success(),
    output: String::from_utf8_lossy(&output.stdout).to_string(),
    error: String::from_utf8_lossy(&output.stderr).to_string(),
  })
}

fn get_config_file_path() -> std::path::PathBuf {
  get_resources_dir().join("config.json")
}

fn load_config() -> Result<AppConfig, String> {
  let config_path = get_config_file_path();

  if config_path.exists() {
    let mut file =
      File::open(&config_path).map_err(|e| format!("Failed to open config file: {}", e))?;

    let mut contents = String::new();
    file
      .read_to_string(&mut contents)
      .map_err(|e| format!("Failed to read config file: {}", e))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse config file: {}", e))
  } else {
    Ok(AppConfig::default())
  }
}

fn save_config(config: &AppConfig) -> Result<(), String> {
  let config_path = get_config_file_path();

  if let Some(parent) = config_path.parent() {
    if !parent.exists() {
      std::fs::create_dir_all(parent)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
  }

  let contents = serde_json::to_string_pretty(config)
    .map_err(|e| format!("Failed to serialize config: {}", e))?;

  let mut file =
    File::create(&config_path).map_err(|e| format!("Failed to create config file: {}", e))?;

  file
    .write_all(contents.as_bytes())
    .map_err(|e| format!("Failed to write config file: {}", e))?;

  Ok(())
}

/// Get the resources directory path (next to the executable)
fn get_resources_dir() -> std::path::PathBuf {
  let exe_path = std::env::current_exe().unwrap_or_else(|_| std::path::PathBuf::from("."));
  let exe_dir = exe_path.parent().unwrap_or(Path::new("."));
  exe_dir.join("easy-csv_resources")
}

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

fn find_xan_executable() -> Option<String> {
  // Extract or get the embedded xan.exe path
  extract_xan_executable().ok()
}

#[tauri::command]
async fn check_xan_installed() -> bool {
  find_xan_executable().is_some()
}

#[tauri::command]
async fn get_default_delimiter() -> Option<String> {
  let config = load_config().unwrap_or_default();
  config.default_delimiter
}

#[tauri::command]
async fn set_default_delimiter(delimiter: String) -> Result<(), String> {
  let mut config = load_config()?;
  config.default_delimiter = Some(delimiter);
  save_config(&config)
}

#[tauri::command]
async fn get_no_headers() -> Option<bool> {
  let config = load_config().unwrap_or_default();
  config.no_headers
}

#[tauri::command]
async fn set_no_headers(no_headers: bool) -> Result<(), String> {
  let mut config = load_config()?;
  config.no_headers = Some(no_headers);
  save_config(&config)
}

#[tauri::command]
async fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
  window
    .set_title(&title)
    .map_err(|e| format!("Failed to set window title: {}", e))
}

#[tauri::command]
async fn save_history(history: String) -> Result<(), String> {
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
async fn load_history() -> Result<String, String> {
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
async fn save_recent_files(recent_files: String) -> Result<(), String> {
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
async fn load_recent_files() -> Result<String, String> {
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
async fn load_profile_cache(
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
async fn save_profile_cache(
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
async fn toggle_devtools(window: tauri::Window) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![
      execute_xan_pipeline,
      check_xan_installed,
      get_default_delimiter,
      set_default_delimiter,
      get_no_headers,
      set_no_headers,
      save_history,
      load_history,
      save_recent_files,
      load_recent_files,
      read_csv_file,
      profile_csv,
      load_profile_cache,
      save_profile_cache,
      set_window_title,
      toggle_devtools
    ])
    .setup(|app| {
      // 创建菜单项
      let show_item = MenuItem::with_id(app, "show", "show", true, None::<&str>)?;
      let quit_item = MenuItem::with_id(app, "quit", "quit", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&show_item, &quit_item])?;
      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&tray_menu)
        .show_menu_on_left_click(false)
        .tooltip("Easy Csv")
        .on_tray_icon_event(|tray, event| match event {
          TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
          } => {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              window.show().unwrap();
              window.set_focus().unwrap();
              window.set_always_on_top(true).unwrap();
              window.set_always_on_top(false).unwrap();
            }
          }
          TrayIconEvent::Click {
            button: MouseButton::Right,
            ..
          } => {}
          _ => {}
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              window.show().unwrap();
              window.set_focus().unwrap();
              window.set_always_on_top(true).unwrap();
              window.set_always_on_top(false).unwrap();
            }
          }
          "quit" => {
            app.exit(0);
          }
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        window.hide().unwrap();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
