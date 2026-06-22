use std::fs::File;
use std::io::{BufReader, ErrorKind, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::Manager;

// Global cache for xan path
static XAN_PATH_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn get_xan_path_cache() -> &'static Mutex<Option<String>> {
  XAN_PATH_CACHE.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
  pub xan_path: Option<String>,
  pub default_delimiter: Option<String>,
  pub no_quoting: Option<bool>,
  pub no_headers: Option<bool>,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      xan_path: None,
      default_delimiter: None,
      no_quoting: None,
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

  let row_limit = limit.unwrap_or(100);
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
async fn execute_xan_pipeline(
  commands: Vec<PipelineCommand>,
  input_file: String,
  default_delimiter: String,
) -> Result<ExecutionResult, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  if !Path::new(&input_file).exists() {
    return Err(format!("Input file does not exist: {}", input_file));
  }

  let config = load_config();
  let no_quoting_enabled = config.no_quoting.unwrap_or(false);
  let no_headers_enabled = config.no_headers.unwrap_or(false);

  let mut cmd_args_list = Vec::new();
  for (i, cmd) in commands.iter().enumerate() {
    let mut args = vec![cmd.name.clone()];

    if i == 0 {
      if no_quoting_enabled {
        args.push("--no-quoting".to_string());
      }
      if no_headers_enabled {
        args.push("--no-headers".to_string());
      }
    }

    let supports_delimiter = !matches!(cmd.name.as_str(), "from" | "range" | "eval" | "run");

    if supports_delimiter {
      args.push("-d".to_string());
      if i == 0 {
        args.push(default_delimiter.clone());
      } else {
        args.push(",".to_string());
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

    args.extend(optional_args);
    args.extend(positional_args);

    cmd_args_list.push(args);
  }

  let output = tokio::task::spawn_blocking(move || -> Result<std::process::Output, String> {
    let mut input_file_handle =
      File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?;

    let num_commands = cmd_args_list.len();

    // Always use piped I/O so we can capture output
    let mut command = Command::new(&xan_path);
    command.args(&cmd_args_list[0]);
    command.stdin(Stdio::piped());
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
      // Single command: feed input file and wait for it
      eprintln!("Single command execution");

      // For commands that require actual file paths (like sort), pass the file path as an argument
      // instead of feeding through stdin
      let first_cmd_name = &cmd_args_list[0][0];
      let needs_file_path = matches!(first_cmd_name.as_str(), "sort" | "dedup" | "shuffle");

      if needs_file_path {
        // For commands that need file paths, ensure input file is the last argument
        let mut args = vec![cmd_args_list[0][0].clone()]; // Command name

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
      } else {
        // Feed input file content into first command's stdin
        {
          let mut stdin = first_child.stdin.take().unwrap();
          let mut buffer = vec![0; 256 * 1024]; // 256KB buffer for better performance
          loop {
            match input_file_handle.read(&mut buffer) {
              Ok(0) => break, // EOF
              Ok(n) => {
                if let Err(e) = stdin.write_all(&buffer[..n]) {
                  // Broken pipe is acceptable if child exits early
                  if e.kind() != ErrorKind::BrokenPipe {
                    return Err(format!("Write to stdin failed: {}", e));
                  }
                  break;
                }
              }
              Err(e) => return Err(format!("Read input file failed: {}", e)),
            }
          }
          // stdin closed automatically here
        }

        first_child
          .wait_with_output()
          .map_err(|e| format!("Wait for command failed: {}", e))
      }
    } else {
      // Multi-command pipeline with concurrent stderr reading
      eprintln!(
        "Multi-command pipeline execution with {} commands",
        num_commands
      );
      let all_stderr = Arc::new(Mutex::new(Vec::new()));
      let mut children = Vec::new();
      let mut stderr_threads = Vec::new();
      let mut pipe_threads = Vec::new();
      let mut output_handles = Vec::new();

      // Read first child's stderr in background thread
      let first_stderr = first_child.stderr.take().unwrap();
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
      let first_stdout = first_child.stdout.take().unwrap();
      children.push(first_child);
      output_handles.push(first_stdout);

      // Start all remaining commands and connect pipes BEFORE feeding input
      for (idx, args) in cmd_args_list.into_iter().skip(1).enumerate() {
        eprintln!(
          "Spawning command {} (index {}): {}",
          idx + 2,
          idx,
          args.join(" ")
        );
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
        let child_stdin = child.stdin.take().unwrap();

        // Get stdout handle for storing
        let child_stdout = child.stdout.take().unwrap();

        // Connect previous stdout to this child's stdin using thread
        let prev_stdout = output_handles.pop().unwrap();
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
                    return Err(format!("Pipe write failed: {}", e));
                  }
                  break;
                }
              }
              Err(e) => return Err(format!("Pipe read failed: {}", e)),
            }
          }
          Ok(())
        });
        pipe_threads.push(pipe_thread);

        // Read this child's stderr in background thread
        let child_stderr = child.stderr.take().unwrap();
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

      // Now feed input file to the first command
      // All pipes are connected, so no deadlock will occur
      eprintln!("Feeding input file to first command...");
      {
        let first_child = children.first_mut().unwrap();
        let mut stdin = first_child.stdin.take().unwrap();

        // Use a thread to feed input to avoid blocking main thread
        let mut input_file_clone =
          File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?;

        thread::spawn(move || {
          let mut buffer = vec![0; 64 * 1024];
          loop {
            match input_file_clone.read(&mut buffer) {
              Ok(0) => break,
              Ok(n) => {
                let _ = stdin.write_all(&buffer[..n]);
              }
              Err(_) => break,
            }
          }
        });
      }

      // Get output from last child using non-blocking approach
      let mut last_child = children.pop().unwrap();
      let last_stdout = output_handles.pop().unwrap();

      // Read stdout in a thread to prevent deadlock
      let stdout_thread = thread::spawn(move || {
        let mut reader = BufReader::new(last_stdout);
        let mut buf = Vec::new();
        let _ = reader.read_to_end(&mut buf);
        buf
      });

      // Monitor middle commands while waiting for last child
      // If any middle command fails, kill the last child to break deadlock
      let mut final_status = None;
      let mut elapsed = std::time::Duration::from_secs(0);
      let timeout = std::time::Duration::from_secs(120); // 2 minutes max

      while final_status.is_none() && elapsed < timeout {
        // Check if last child has exited
        match last_child.try_wait() {
          Ok(Some(status)) => {
            final_status = Some(status);
            break;
          }
          Ok(None) => {
            // Last child still running, check middle commands
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
                Ok(None) => {} // Still running
                Err(_) => {}
              }
            }

            // If any middle command failed
            if any_failed {
              // Kill all middle commands to unblock the pipeline
              // This will cause pipe threads to exit (BrokenPipe)
              // and eventually close last_child's stdin
              for child in &mut children {
                let _ = child.kill();
              }

              // Wait for all middle commands to exit
              for child in &mut children {
                let _ = child.wait();
              }

              // Now wait for last child to exit naturally
              // Give it enough time to finish writing (especially for output command)
              let mut wait_elapsed = std::time::Duration::from_secs(0);
              let wait_timeout = std::time::Duration::from_secs(10);
              while wait_elapsed < wait_timeout {
                match last_child.try_wait() {
                  Ok(Some(status)) => {
                    if final_status.is_none() {
                      final_status = Some(status);
                    }
                    break;
                  }
                  Ok(None) => {
                    thread::sleep(std::time::Duration::from_millis(100));
                    wait_elapsed += std::time::Duration::from_millis(100);
                  }
                  Err(_) => break,
                }
              }

              // If last child still hasn't exited, kill it
              if final_status.is_none() {
                let _ = last_child.kill();
                if let Ok(status) = last_child.wait() {
                  final_status = Some(status);
                }
              }
              break;
            }

            thread::sleep(std::time::Duration::from_millis(50));
            elapsed += std::time::Duration::from_millis(50);
          }
          Err(e) => {
            eprintln!("Error checking last child status: {}", e);
            break;
          }
        }
      }

      // If timeout, kill the last child
      let final_status = if let Some(status) = final_status {
        status
      } else {
        let _ = last_child.kill();
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
      let combined_stderr = all_stderr.lock().unwrap().join(&b"\n"[..]);

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
  let config_dir =
    dirs::config_dir().unwrap_or_else(|| std::env::current_dir().unwrap_or_default());
  config_dir.join("xan-gui").join("config.json")
}

fn load_config() -> AppConfig {
  let config_path = get_config_file_path();

  if config_path.exists() {
    match File::open(&config_path) {
      Ok(mut file) => {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
          match serde_json::from_str(&contents) {
            Ok(config) => return config,
            Err(e) => eprintln!("Failed to parse config file: {}", e),
          }
        }
      }
      Err(e) => eprintln!("Failed to open config file: {}", e),
    }
  }

  AppConfig::default()
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

fn find_xan_executable() -> Option<String> {
  // Check cache first
  {
    let cache = get_xan_path_cache().lock().unwrap();
    if let Some(ref cached_path) = *cache {
      return Some(cached_path.clone());
    }
  }

  // Only check user configured path, no automatic searching
  let config = load_config();
  if let Some(ref xan_path) = config.xan_path {
    if Path::new(xan_path).exists() {
      // Cache the path
      {
        let mut cache = get_xan_path_cache().lock().unwrap();
        *cache = Some(xan_path.clone());
      }
      return Some(xan_path.clone());
    } else {
      eprintln!("Configured xan path does not exist: {}", xan_path);
    }
  }

  None
}

fn invalidate_xan_path_cache() {
  let mut cache = get_xan_path_cache().lock().unwrap();
  *cache = None;
}

#[tauri::command]
async fn check_xan_installed() -> bool {
  find_xan_executable().is_some()
}

#[tauri::command]
async fn get_xan_version() -> Result<String, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let mut command = tokio::process::Command::new(&xan_path);
  command.arg("--version");
  command.kill_on_drop(true);

  #[cfg(target_os = "windows")]
  {
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }

  let output = command
    .output()
    .await
    .map_err(|e| format!("Failed to execute xan: {}", e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let code = output.status.code().unwrap_or(-1);
    Err(format!(
      "xan --version failed with exit code {}: {}",
      code, stderr
    ))
  }
}

#[tauri::command]
async fn get_xan_path() -> Option<String> {
  let config = load_config();
  config.xan_path
}

#[tauri::command]
async fn set_xan_path(path: String) -> Result<(), String> {
  if !Path::new(&path).exists() {
    return Err(format!("File does not exist: {}", path));
  }

  let mut config = load_config();
  config.xan_path = Some(path);
  invalidate_xan_path_cache();
  save_config(&config)
}

#[tauri::command]
async fn get_default_delimiter() -> Option<String> {
  let config = load_config();
  config.default_delimiter
}

#[tauri::command]
async fn set_default_delimiter(delimiter: String) -> Result<(), String> {
  let mut config = load_config();
  config.default_delimiter = Some(delimiter);
  save_config(&config)
}

#[tauri::command]
async fn get_no_quoting() -> Option<bool> {
  let config = load_config();
  config.no_quoting
}

#[tauri::command]
async fn set_no_quoting(no_quoting: bool) -> Result<(), String> {
  let mut config = load_config();
  config.no_quoting = Some(no_quoting);
  save_config(&config)
}

#[tauri::command]
async fn get_no_headers() -> Option<bool> {
  let config = load_config();
  config.no_headers
}

#[tauri::command]
async fn set_no_headers(no_headers: bool) -> Result<(), String> {
  let mut config = load_config();
  config.no_headers = Some(no_headers);
  save_config(&config)
}

#[tauri::command]
async fn get_xan_help(command_name: String) -> Result<String, String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let mut command = tokio::process::Command::new(&xan_path);
  command.arg(&command_name);
  command.arg("--help");
  command.kill_on_drop(true);

  #[cfg(target_os = "windows")]
  {
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }

  let output = command
    .output()
    .await
    .map_err(|e| format!("Failed to execute xan {} --help: {}", command_name, e))?;

  if output.status.success() {
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
  } else {
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !stderr.is_empty() {
      Ok(stderr)
    } else {
      Err(format!("Failed to get help for command: {}", command_name))
    }
  }
}

#[tauri::command]
async fn set_window_title(window: tauri::Window, title: String) -> Result<(), String> {
  match window.set_title(&title) {
    Ok(_) => Ok(()),
    Err(e) => {
      eprintln!(
        "Warning: Failed to set window title (window may not be ready yet): {}",
        e
      );
      Ok(())
    }
  }
}

#[tauri::command]
async fn save_history(app: tauri::AppHandle, history: String) -> Result<(), String> {
  let app_data_dir = app.path().app_data_dir().map_err(|e| format!("{e}"))?;
  let history_path = app_data_dir.join("history.json");
  eprintln!("{:?}", history_path);

  // Create directory if it doesn't exist
  if let Some(parent) = history_path.parent() {
    std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
  }

  // Save history to file
  std::fs::write(&history_path, history).map_err(|e| format!("Failed to save history: {}", e))?;

  Ok(())
}

#[tauri::command]
async fn load_history(app: tauri::AppHandle) -> Result<String, String> {
  let app_data_dir = app.path().app_data_dir().map_err(|e| format!("{e}"))?;
  let history_path = app_data_dir.join("history.json");

  // Load history from file
  if history_path.exists() {
    let content = std::fs::read_to_string(&history_path)
      .map_err(|e| format!("Failed to read history: {}", e))?;
    Ok(content)
  } else {
    Ok("[]".to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![
      execute_xan_pipeline,
      check_xan_installed,
      get_xan_version,
      get_xan_path,
      set_xan_path,
      get_default_delimiter,
      set_default_delimiter,
      get_no_quoting,
      set_no_quoting,
      get_no_headers,
      set_no_headers,
      get_xan_help,
      save_history,
      load_history,
      read_csv_file,
      set_window_title
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
