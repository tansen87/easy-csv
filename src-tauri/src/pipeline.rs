use std::fs::File;
use std::io::{BufReader, ErrorKind, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use serde::{Deserialize, Serialize};

use crate::config::load_config;
use crate::xan::find_xan_executable;

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
pub async fn execute_xan_pipeline(
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
      let needs_file_path = matches!(
        first_cmd_name.as_str(),
        "sort" | "dedup" | "shuffle" | "from"
      );

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
