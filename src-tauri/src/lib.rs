use std::fs::File;
use std::io::{Read, Write};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::{path::Path, process::Stdio, thread};

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub xan_path: Option<String>,
    pub default_delimiter: Option<String>,
    pub no_quoting: Option<bool>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            xan_path: None,
            default_delimiter: None,
            no_quoting: None,
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

    let mut cmd_args_list = Vec::new();
    for (i, cmd) in commands.iter().enumerate() {
        let mut args = vec![cmd.name.clone()];

        if cmd.name == "input" && no_quoting_enabled {
            args.push("--no-quoting".to_string());
        }

        let supports_delimiter = !matches!(cmd.name.as_str(), "from" | "range" | "eval");

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
        use std::io::ErrorKind;

        let mut input_file_handle =
            File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?;

        let num_commands = cmd_args_list.len();

        // Always use piped I/O so we can capture output
        let mut first_child = Command::new(&xan_path)
            .args(&cmd_args_list[0])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
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
                
                eprintln!("Executing command with file path: {:?}", args);
                
                let child = Command::new(&xan_path)
                    .args(args)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
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

            // Read first child's stderr in background thread
            let first_stderr = first_child.stderr.take().unwrap();
            let stderr_clone = Arc::clone(&all_stderr);
            stderr_threads.push(thread::spawn(move || {
                let mut reader = std::io::BufReader::new(first_stderr);
                let mut buf = Vec::new();
                if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                    if let Ok(mut guard) = stderr_clone.lock() {
                        guard.push(buf);
                    }
                }
            }));
            children.push(first_child);

            // Start all remaining commands and connect pipes BEFORE feeding input
            for (idx, args) in cmd_args_list.into_iter().skip(1).enumerate() {
                eprintln!(
                    "Spawning command {} (index {}): {}",
                    idx + 2,
                    idx,
                    args.join(" ")
                );
                let mut child = Command::new(&xan_path)
                    .args(args)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Start pipeline command failed: {}", e))?;

                // Connect previous stdout to this child's stdin
                let prev_child = children.last_mut().unwrap();
                let prev_stdout = prev_child.stdout.take().unwrap();
                let child_stdin = child.stdin.take().unwrap();

                // Spawn thread to pipe data between processes
                let pipe_thread = thread::spawn(move || {
                    let mut reader = std::io::BufReader::new(prev_stdout);
                    let mut writer = child_stdin;
                    let mut buffer = vec![0; 256 * 1024]; // 256KB buffer for better performance

                    loop {
                        match reader.read(&mut buffer) {
                            Ok(0) => break, // EOF
                            Ok(n) => {
                                if let Err(e) = writer.write_all(&buffer[..n]) {
                                    // Broken pipe is acceptable if child exits early
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

                // Read this child's stderr in background thread
                let child_stderr = child.stderr.take().unwrap();
                let stderr_clone = Arc::clone(&all_stderr);
                stderr_threads.push(thread::spawn(move || {
                    let mut reader = std::io::BufReader::new(child_stderr);
                    let mut buf = Vec::new();
                    if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                        if let Ok(mut guard) = stderr_clone.lock() {
                            guard.push(buf);
                        }
                    }
                }));

                children.push(child);
                pipe_threads.push(pipe_thread);
            }

            // Now feed input file to the first command
            // All pipes are connected, so no deadlock will occur
            eprintln!("Feeding input file to first command...");
            {
                let first_child = children.first_mut().unwrap();
                let mut stdin = first_child.stdin.take().unwrap();
                let mut buffer = vec![0; 256 * 1024]; // 256KB buffer for better performance
                loop {
                    match input_file_handle.read(&mut buffer) {
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
            eprintln!("Input file feeding completed");

            // Wait for all pipe threads to finish and check for errors
            for t in pipe_threads {
                match t.join() {
                    Ok(Ok(())) => {}
                    Ok(Err(e)) => return Err(format!("Pipe thread error: {}", e)),
                    Err(_) => return Err("Pipe thread panicked".to_string()),
                }
            }

            // Get output from last child
            let last_child = children.pop().unwrap();
            let output = last_child
                .wait_with_output()
                .map_err(|e| format!("Wait for final command failed: {}", e))?;

            // Wait for all other children
            for mut child in children.into_iter().rev() {
                let _ = child.wait();
            }

            // Wait for all stderr threads and combine stderr
            for t in stderr_threads {
                let _ = t.join();
            }
            let combined_stderr = all_stderr.lock().unwrap().join(&b"\n"[..]);

            Ok(std::process::Output {
                status: output.status,
                stdout: output.stdout,
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

    file.write_all(contents.as_bytes())
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

fn find_xan_executable() -> Option<String> {
    // First, check if user has configured a custom path
    let config = load_config();
    if let Some(ref xan_path) = config.xan_path {
        if Path::new(xan_path).exists() {
            return Some(xan_path.clone());
        } else {
            eprintln!("Configured xan path does not exist: {}", xan_path);
        }
    }

    let mut paths = vec![];

    // Add current working directory
    if let Ok(cwd) = std::env::current_dir() {
        let xan_in_cwd = cwd.join("xan.exe");
        paths.push(xan_in_cwd.to_string_lossy().to_string());
    }

    // Add relative paths
    paths.push("xan.exe".to_string());
    paths.push("xan".to_string());

    // Add user's cargo bin directory if available
    if let Some(home) = dirs::home_dir() {
        let cargo_bin = home.join(".cargo").join("bin").join("xan.exe");
        paths.push(cargo_bin.to_string_lossy().to_string());
    }

    // Add the directory where the current executable is located
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let xan_in_exe_dir = exe_dir.join("xan.exe");
            paths.push(xan_in_exe_dir.to_string_lossy().to_string());
        }
    }

    None
}

#[tauri::command]
fn check_xan_installed() -> bool {
    find_xan_executable().is_some()
}

#[tauri::command]
fn get_xan_version() -> Result<String, String> {
    let xan_path = find_xan_executable().ok_or("xan executable not found")?;

    let output = Command::new(&xan_path)
        .arg("--version")
        .output()
        .map_err(|e| format!("Failed to execute xan: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn get_xan_path() -> Option<String> {
    let config = load_config();
    config.xan_path
}

#[tauri::command]
fn set_xan_path(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let mut config = load_config();
    config.xan_path = Some(path);
    save_config(&config)
}

#[tauri::command]
fn get_default_delimiter() -> Option<String> {
    let config = load_config();
    config.default_delimiter
}

#[tauri::command]
fn set_default_delimiter(delimiter: String) -> Result<(), String> {
    let mut config = load_config();
    config.default_delimiter = Some(delimiter);
    save_config(&config)
}

#[tauri::command]
fn get_no_quoting() -> Option<bool> {
    let config = load_config();
    config.no_quoting
}

#[tauri::command]
fn set_no_quoting(no_quoting: bool) -> Result<(), String> {
    let mut config = load_config();
    config.no_quoting = Some(no_quoting);
    save_config(&config)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            execute_xan_pipeline,
            check_xan_installed,
            get_xan_version,
            get_xan_path,
            set_xan_path,
            get_default_delimiter,
            set_default_delimiter,
            get_no_quoting,
            set_no_quoting
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
