use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, ErrorKind, Read, Write};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use serde::{Deserialize, Serialize};

use crate::config::load_config;
use crate::plugins::command_executable;
use crate::plugins::is_plugin_command;
use crate::xan::find_xan_executable;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PipelineCommand {
  pub name: String,
  pub parameters: Vec<CommandParameter>,
  /// Optional step identifier used to attribute execution errors to a specific node
  #[serde(default)]
  pub id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
  pub cancelled: bool,
  /// Map of step id -> error message, used to display errors on the corresponding node
  #[serde(default)]
  pub step_errors: std::collections::HashMap<String, String>,
}

static CANCELLATION_FLAG: OnceLock<AtomicBool> = OnceLock::new();

fn cancellation_flag() -> &'static AtomicBool {
  CANCELLATION_FLAG.get_or_init(|| AtomicBool::new(false))
}

#[tauri::command]
pub fn set_pipeline_cancelled(cancel: bool) {
  cancellation_flag().store(cancel, Ordering::SeqCst);
}

fn wait_with_cancel(
  mut child: std::process::Child,
  cancel: &AtomicBool,
) -> Result<std::process::Output, String> {
  let stdout = child.stdout.take().ok_or("Failed to get stdout handle")?;
  let stderr = child.stderr.take().ok_or("Failed to get stderr handle")?;

  let stdout_thread = thread::spawn(move || {
    let mut reader = BufReader::new(stdout);
    let mut buf = Vec::new();
    let _ = reader.read_to_end(&mut buf);
    buf
  });
  let stderr_thread = thread::spawn(move || {
    let mut reader = BufReader::new(stderr);
    let mut buf = Vec::new();
    let _ = reader.read_to_end(&mut buf);
    buf
  });

  let status = loop {
    if cancel.load(Ordering::Relaxed) {
      let _ = child.kill();
    }
    match child.try_wait() {
      Ok(Some(status)) => break status,
      Ok(None) => thread::sleep(std::time::Duration::from_millis(50)),
      Err(e) => return Err(format!("Wait for command failed: {}", e)),
    }
  };

  let stdout = stdout_thread.join().unwrap_or_default();
  let stderr = stderr_thread.join().unwrap_or_default();

  Ok(std::process::Output {
    status,
    stdout,
    stderr,
  })
}

/// Like `wait_with_cancel` but streams the child stdout directly into
/// `out_path` instead of buffering it in memory. Used to hand a large upstream
/// step's output to a `duckdb` step without ballooning RAM.
fn wait_with_cancel_to_file(
  mut child: std::process::Child,
  cancel: &AtomicBool,
  out_path: &Path,
) -> Result<std::process::Output, String> {
  let stdout = child.stdout.take().ok_or("Failed to get stdout handle")?;
  let stderr = child.stderr.take().ok_or("Failed to get stderr handle")?;

  let file_out = out_path.to_path_buf();
  let stdout_thread = thread::spawn(move || {
    let out = match File::create(&file_out) {
      Ok(f) => f,
      Err(_) => return,
    };
    let mut writer = out;
    let mut reader = BufReader::new(stdout);
    let mut chunk = vec![0u8; 64 * 1024];
    loop {
      match reader.read(&mut chunk) {
        Ok(0) => break,
        Ok(n) => {
          if writer.write_all(&chunk[..n]).is_err() {
            break;
          }
        }
        Err(_) => break,
      }
    }
    let _ = writer.flush();
  });
  let stderr_thread = thread::spawn(move || {
    let mut reader = BufReader::new(stderr);
    let mut buf = Vec::new();
    let _ = reader.read_to_end(&mut buf);
    buf
  });

  let status = loop {
    if cancel.load(Ordering::Relaxed) {
      let _ = child.kill();
    }
    match child.try_wait() {
      Ok(Some(status)) => break status,
      Ok(None) => thread::sleep(std::time::Duration::from_millis(50)),
      Err(e) => return Err(format!("Wait for command failed: {}", e)),
    }
  };

  let _ = stdout_thread.join();
  let stderr = stderr_thread.join().unwrap_or_default();

  Ok(std::process::Output {
    status,
    stdout: Vec::new(),
    stderr,
  })
}

/// Attach step error attribution for a single-command pipeline result.
fn single_output_with_errors(
  result: Result<std::process::Output, String>,
  step_id: Option<&str>,
) -> Result<(std::process::Output, HashMap<String, String>), String> {
  let output = result?;
  let mut step_errors = HashMap::new();
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if !stderr.trim().is_empty() {
      if let Some(id) = step_id {
        step_errors.insert(id.to_string(), stderr);
      }
    }
  }
  Ok((output, step_errors))
}

#[tauri::command]
pub async fn execute_xan_pipeline(
  commands: Vec<PipelineCommand>,
  input_file: String,
  default_delimiter: String,
  max_output_bytes: Option<usize>,
) -> Result<ExecutionResult, String> {
  let cancel_flag = cancellation_flag();

  if cancel_flag.load(Ordering::SeqCst) {
    return Ok(ExecutionResult {
      success: false,
      output: String::new(),
      error: "Execution cancelled".to_string(),
      cancelled: true,
      step_errors: HashMap::new(),
    });
  }

  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let config = load_config()?;
  let no_headers_enabled = config.no_headers.unwrap_or(false);

  // Any DuckDB step switches the pipeline to the sequential materialization
  // engine, which hands each duckdb step its input as a fully-written temp file.
  let has_duckdb = commands.iter().any(|c| is_duckdb(&c.name));
  if has_duckdb {
    return run_duckdb_pipeline(
      commands,
      input_file,
      default_delimiter,
      no_headers_enabled,
      cancel_flag,
      max_output_bytes,
    )
    .await;
  }

  let first_cmd = commands.first().ok_or("No commands provided")?;
  let first_is_cat = matches!(first_cmd.name.as_str(), "cat");
  if !first_is_cat && !Path::new(&input_file).exists() {
    return Err(format!("Input file does not exist"));
  }

  let mut cmd_args_list = Vec::new();
  let mut cmd_ids = Vec::new();
  for (i, cmd) in commands.iter().enumerate() {
    let mut args = vec![cmd.name.clone()];
    cmd_ids.push(cmd.id.clone());

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
          // Split pipe-separated values for positional params (e.g., multiple file paths)
          // Using | because file names may contain commas
          for part in param.value.split('|') {
            let trimmed = part.trim();
            if !trimmed.is_empty() {
              positional_args.push(trimmed.to_string());
            }
          }
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

  let output = tokio::task::spawn_blocking(
    move || -> Result<(std::process::Output, HashMap<String, String>), String> {
      let first_cmd_name = &cmd_args_list[0][0].clone();
      let is_cat_command = first_cmd_name.as_str() == "cat";
      let num_commands = cmd_args_list.len();

      let mut input_file_handle: Option<File> = if is_cat_command {
        None
      } else {
        Some(File::open(&input_file).map_err(|e| format!("Failed to open input file: {}", e))?)
      };

      // Always use piped I/O so we can capture output
      let first_exe = command_executable(&cmd_args_list[0][0], Path::new(&xan_path))?;
      let mut command = Command::new(&first_exe);
      // For plugins the command name is not a subcommand, so it must be skipped.
      if is_plugin_command(&cmd_args_list[0][0]) {
        command.args(&cmd_args_list[0][1..]);
      } else {
        command.args(&cmd_args_list[0]);
      }
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
        let first_step_id = cmd_ids[0].as_deref();
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

          let exe = command_executable(&cmd_args_list[0][0], Path::new(&xan_path))?;
          let mut command = Command::new(&exe);
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

          single_output_with_errors(wait_with_cancel(child, cancel_flag), first_step_id)
        } else if is_cat_command {
          single_output_with_errors(wait_with_cancel(first_child, cancel_flag), first_step_id)
        } else {
          {
            let mut stdin = first_child
              .stdin
              .take()
              .ok_or("Failed to get stdin handle")?;
            let mut buffer = vec![0; 256 * 1024];
            let mut file = input_file_handle.take().unwrap();
            loop {
              if cancel_flag.load(Ordering::Relaxed) {
                break;
              }
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

          wait_with_cancel(first_child, cancel_flag).and_then(|output| {
            let mut step_errors = HashMap::new();
            if !output.status.success() {
              let stderr = String::from_utf8_lossy(&output.stderr).to_string();
              if !stderr.trim().is_empty() {
                if let Some(id) = first_step_id {
                  step_errors.insert(id.to_string(), stderr);
                }
              }
            }
            Ok((output, step_errors))
          })
        }
      } else {
        // Multi-command pipeline
        // Keyed by step id so errors can be attributed to the failing node
        let all_stderr: Arc<Mutex<Vec<(String, Vec<u8>)>>> = Arc::new(Mutex::new(Vec::new()));
        let all_errors: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));
        let mut children = Vec::new();
        let mut children_ids = Vec::new();
        let mut stderr_threads = Vec::new();
        let mut pipe_threads = Vec::new();
        let mut output_handles = Vec::new();

        // Read first child's stderr in background thread
        let first_stderr = first_child
          .stderr
          .take()
          .ok_or("Failed to get stderr handle")?;
        let first_stderr_id = cmd_ids[0].clone().unwrap_or_default();
        let stderr_clone = Arc::clone(&all_stderr);
        stderr_threads.push(thread::spawn(move || {
          let mut reader = BufReader::new(first_stderr);
          let mut buf = Vec::new();
          if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
            if let Ok(mut guard) = stderr_clone.lock() {
              guard.push((first_stderr_id, buf));
            }
          }
        }));

        // Store stdout handle for piping
        let first_stdout = first_child
          .stdout
          .take()
          .ok_or("Failed to get stdout handle")?;
        children.push(first_child);
        children_ids.push(cmd_ids[0].clone().unwrap_or_default());
        output_handles.push(first_stdout);

        // Start all remaining commands and connect pipes BEFORE feeding input
        for i in 1..cmd_args_list.len() {
          let args = &cmd_args_list[i];
          let exe = command_executable(&args[0], Path::new(&xan_path))?;
          let mut command = Command::new(&exe);
          // For plugins the command name is not a subcommand, so it must be skipped.
          if is_plugin_command(&args[0]) {
            command.args(&args[1..]);
          } else {
            command.args(args);
          }
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

          let current_id = cmd_ids[i].clone().unwrap_or_default();

          // Connect previous stdout to this child's stdin using thread
          let prev_stdout = output_handles
            .pop()
            .ok_or("Failed to get previous stdout handle")?;
          let errors_clone = Arc::clone(&all_errors);
          let pipe_id = current_id.clone();
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
                        guard.push((pipe_id.clone(), format!("Pipe write failed: {}", e)));
                      }
                    }
                    break;
                  }
                }
                Err(e) => {
                  if let Ok(mut guard) = errors_clone.lock() {
                    guard.push((pipe_id.clone(), format!("Pipe read failed: {}", e)));
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
          let stderr_id = current_id.clone();
          stderr_threads.push(thread::spawn(move || {
            let mut reader = BufReader::new(child_stderr);
            let mut buf = Vec::new();
            if reader.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
              if let Ok(mut guard) = stderr_clone.lock() {
                guard.push((stderr_id, buf));
              }
            }
          }));

          children.push(child);
          children_ids.push(current_id);
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
          let first_id = cmd_ids[0].clone().unwrap_or_default();
          thread::spawn(move || {
            let mut buffer = vec![0; 64 * 1024];
            loop {
              if cancel_flag.load(Ordering::Relaxed) {
                break;
              }
              match input_file_clone.read(&mut buffer) {
                Ok(0) => break,
                Ok(n) => {
                  if let Err(e) = stdin.write_all(&buffer[..n]) {
                    if e.kind() != ErrorKind::BrokenPipe {
                      if let Ok(mut guard) = errors_clone.lock() {
                        guard.push((first_id.clone(), format!("Write to stdin failed: {}", e)));
                      }
                    }
                    break;
                  }
                }
                Err(e) => {
                  if let Ok(mut guard) = errors_clone.lock() {
                    guard.push((first_id.clone(), format!("Read input file failed: {}", e)));
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
          if cancel_flag.load(Ordering::Relaxed) {
            for child in &mut children {
              let _ = child.kill();
            }
            for child in &mut children {
              let _ = child.wait();
            }
            let _ = last_child.kill();
            if let Ok(status) = last_child.wait() {
              final_status = Some(status);
            }
            break;
          }

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
        let mut combined_stderr = Vec::new();
        let mut step_errors: HashMap<String, String> = HashMap::new();
        {
          let stderr_entries = all_stderr.lock().unwrap();
          for (id, buf) in stderr_entries.iter() {
            if !combined_stderr.is_empty() {
              combined_stderr.extend_from_slice(&b"\n"[..]);
            }
            combined_stderr.extend_from_slice(buf);
            if !id.is_empty() {
              let text = String::from_utf8_lossy(buf).trim().to_string();
              if !text.is_empty() {
                step_errors
                  .entry(id.clone())
                  .and_modify(|e| e.push('\n'))
                  .or_default()
                  .push_str(&text);
              }
            }
          }
        }

        // Add any pipe/input errors to stderr and attribute them
        let errors = all_errors.lock().unwrap();
        if !errors.is_empty() {
          for (id, msg) in errors.iter() {
            if !combined_stderr.is_empty() {
              combined_stderr.extend_from_slice(&b"\n"[..]);
            }
            combined_stderr.extend_from_slice(msg.as_bytes());
            if !id.is_empty() {
              step_errors
                .entry(id.clone())
                .and_modify(|e| e.push('\n'))
                .or_default()
                .push_str(msg);
            }
          }
        }

        Ok((
          std::process::Output {
            status: final_status,
            stdout,
            stderr: combined_stderr,
          },
          step_errors,
        ))
      }
    },
  )
  .await
  .map_err(|e| format!("Task execution failed: {}", e))??;

  let cancelled = cancel_flag.load(Ordering::Relaxed);

  let (process_output, step_errors) = output;

  Ok(ExecutionResult {
    success: process_output.status.success() && !cancelled,
    output: truncate_output(
      String::from_utf8_lossy(&process_output.stdout).to_string(),
      max_output_bytes,
    ),
    error: String::from_utf8_lossy(&process_output.stderr).to_string(),
    cancelled,
    step_errors,
  })
}

/// Cap an output string to `max` bytes, cutting at a UTF-8 char boundary.
fn truncate_output(mut s: String, max: Option<usize>) -> String {
  if let Some(max) = max {
    if s.len() > max {
      let idx = s.floor_char_boundary(max);
      s.truncate(idx);
    }
  }
  s
}

/// Whether a pipeline step is a `duckdb` command (DuckDB CLI plugin).
fn is_duckdb(name: &str) -> bool {
  name.eq_ignore_ascii_case("duckdb")
}

/// Monotonic counter to give every materialized DuckDB input file a unique name
/// (multiple pipelines may run concurrently in the same process).
static TEMP_FILE_COUNTER: AtomicUsize = AtomicUsize::new(0);

/// Path of a scratch CSV used to hand data to a `duckdb` step. DuckDB's CLI
/// cannot reliably `read_csv('/dev/stdin')` on Windows (regression since 1.5.0),
/// so we materialize the piped input to a temp file and stream it into the SQL
/// via a virtual `input` relation. A unique name avoids clobbering concurrent runs.
fn make_temp_csv() -> PathBuf {
  let id = TEMP_FILE_COUNTER.fetch_add(1, Ordering::SeqCst);
  std::env::temp_dir().join(format!("EasyCsv_duckdb_{}_{}.csv", std::process::id(), id))
}

/// Build the CLI argv for a `duckdb` step.
///
/// The piped-upstream CSV (already written to `input_csv`) is exposed to the
/// user's SQL as the virtual relation `input`. Guarded by `<sql>` referencing
/// `input`, we prepend a `CREATE VIEW` that materializes it via `read_csv_auto`.
/// Non-`input` queries (e.g. reading external files, `SELECT 1`) are untouched.
fn build_duckdb_args(
  cmd: &PipelineCommand,
  input_csv: &Path,
  default_delimiter: &str,
) -> Vec<String> {
  let mut map = HashMap::new();
  for p in &cmd.parameters {
    map.insert(p.name.clone(), p.value.clone());
  }

  let sql = map.get("sql").cloned().unwrap_or_default();
  // DuckDB query results are always emitted as CSV (the only supported format),
  // which by default includes a header row. `-bail` enables the stop-on-error
  // behavior; `-separator` mirrors the app's default delimiter. Ignore any
  // legacy `format`/`noheader` parameters.
  let mut args = Vec::new();
  args.push("-csv".to_string());
  if sql.references_input() {
    // Use forward slashes so the path survives as a literal inside single quotes.
    let path = input_csv.to_string_lossy().replace('\\', "/");
    let preamble = format!(
      "CREATE VIEW input AS SELECT * FROM read_csv_auto('{}', header = true);\n",
      path
    );
    args.push("-c".to_string());
    args.push(format!("{}{}", preamble, sql));
  } else {
    args.push("-c".to_string());
    args.push(sql);
  }

  args.push("-bail".to_string());
  let separator = if default_delimiter.is_empty() {
    ","
  } else {
    default_delimiter
  };
  args.push("-separator".to_string());
  args.push(separator.to_string());
  args
}

/// A small wrapper so the intent is readable at the call site.
trait SqlReferencesInput {
  fn references_input(&self) -> bool;
}
impl SqlReferencesInput for str {
  fn references_input(&self) -> bool {
    // Word-boundary `input` (table / column references like `input.col`).
    let bytes = self.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
      if bytes[i].is_ascii_alphabetic() {
        let start = i;
        while i < bytes.len() && bytes[i].is_ascii_alphanumeric()
          || (i < bytes.len() && bytes[i] == b'_')
        {
          i += 1;
        }
        let word = &self[start..i];
        if word.eq_ignore_ascii_case("input") {
          // Ensure it is not preceded by a `.` (namespace qualifier like `x.input`)
          let prev_not_dot = start == 0 || {
            let pb = bytes[start - 1];
            pb != b'.'
          };
          if prev_not_dot {
            return true;
          }
        }
        continue;
      }
      i += 1;
    }
    false
  }
}

/// Run a pipeline that contains at least one `duckdb` step.
///
/// Because DuckDB reads its input from disk (a materialized temp CSV) rather
/// than a live pipe, the whole pipeline is executed sequentially: each step's
/// stdout is fully captured into the next step's input temp file *before* the
/// next step starts, guaranteeing a `duckdb` step never reads a partial file.
/// Pure-xan pipelines keep the existing faster concurrent path (`execute_xan_pipeline`).
fn pipeline_seq(
  commands: &[PipelineCommand],
  input_file: &str,
  default_delimiter: &str,
  no_headers: bool,
  cancel: &AtomicBool,
) -> Result<(std::process::Output, HashMap<String, String>), String> {
  let xan_path = find_xan_executable().ok_or("xan executable not found")?;

  let mut temp_files: Vec<PathBuf> = Vec::new();
  let mut step_errors: HashMap<String, String> = HashMap::new();
  let mut raw_stderr: Vec<(String, Vec<u8>)> = Vec::new();

  // The CSV that the next step consumes. The first step reads the project input
  // file (when present); otherwise an empty scratch file is used.
  let mut current_input: PathBuf = if Path::new(input_file).exists() {
    Path::new(input_file).to_path_buf()
  } else {
    let t = make_temp_csv();
    let _ = std::fs::write(&t, b"");
    temp_files.push(t.clone());
    t
  };

  let num = commands.len();
  let mut final_stdout: Vec<u8> = Vec::new();
  let mut final_status: Option<std::process::ExitStatus> = None;

  for (i, cmd) in commands.iter().enumerate() {
    if cancel.load(Ordering::Relaxed) {
      break;
    }
    let is_last = i == num - 1;
    let name = cmd.name.as_str();
    let step_id = cmd.id.clone().unwrap_or_default();
    let is_cat = name == "cat";
    let duckdb = is_duckdb(name);
    // Commands that read their input as a file argument, not from stdin.
    let needs_file_path = matches!(name, "sort" | "dedup" | "shuffle" | "from");

    let argv: Vec<String> = if duckdb {
      build_duckdb_args(cmd, &current_input, default_delimiter)
    } else {
      let mut args = vec![name.to_string()];
      if i == 0 && no_headers {
        args.push("--no-headers".to_string());
      }
      let mut positional = Vec::new();
      let mut optional = Vec::new();
      for p in &cmd.parameters {
        if p.value == "true" {
          optional.push(format!("--{}", p.name));
        } else if !p.value.is_empty() {
          if p.is_positional.unwrap_or(false) {
            for part in p.value.split('|') {
              let t = part.trim();
              if !t.is_empty() {
                positional.push(t.to_string());
              }
            }
          } else {
            optional.push(format!("--{}", p.name));
            optional.push(p.value.clone());
          }
        }
      }
      let supports_delimiter = !matches!(name, "from" | "range" | "eval" | "run");
      if supports_delimiter && i == 0 {
        optional.push("-d".to_string());
        optional.push(default_delimiter.to_string());
      }
      if needs_file_path {
        positional.push(current_input.to_string_lossy().to_string());
      }
      args.extend(positional);
      args.extend(optional);
      args
    };

    let exe = command_executable(name, Path::new(&xan_path))?;
    let mut command = Command::new(&exe);
    command.args(&argv);

    // duckdb / cat / sort-type read from disk; other xan commands stream the
    // current input CSV through stdin.
    let feed_stdin = !(duckdb || is_cat || needs_file_path);
    let stdin_available = feed_stdin && Path::new(&current_input).exists();
    if stdin_available {
      command.stdin(Stdio::piped());
    } else {
      command.stdin(Stdio::null());
    }
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
      command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = command
      .spawn()
      .map_err(|e| format!("Start pipeline command failed: {}", e))?;

    if stdin_available {
      let mut stdin = child.stdin.take().ok_or("Failed to get stdin handle")?;
      let src = current_input.clone();
      thread::spawn(move || {
        let mut file = match File::open(&src) {
          Ok(f) => f,
          Err(_) => return,
        };
        let mut buf = vec![0u8; 64 * 1024];
        loop {
          match file.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
              if stdin.write_all(&buf[..n]).is_err() {
                break;
              }
            }
            Err(_) => break,
          }
        }
      });
    }

    // For every step but the last, capture stdout into the next step's input.
    let next_temp = if is_last {
      None
    } else {
      let t = make_temp_csv();
      temp_files.push(t.clone());
      Some(t)
    };

    // Non-last steps stream stdout straight into the next input temp file so a
    // large upstream result does not have to be buffered in RAM.
    let output = if let Some(t) = &next_temp {
      wait_with_cancel_to_file(child, cancel, t)?
    } else {
      wait_with_cancel(child, cancel)?
    };

    if !output.stderr.is_empty() {
      let text = String::from_utf8_lossy(&output.stderr).trim().to_string();
      if !text.is_empty() {
        step_errors
          .entry(step_id.clone())
          .and_modify(|e| e.push('\n'))
          .or_default()
          .push_str(&text);
        raw_stderr.push((step_id, output.stderr));
      }
    }

    final_status = Some(output.status);
    if let Some(t) = &next_temp {
      current_input = t.clone();
    } else {
      final_stdout = output.stdout;
    }
  }

  for t in &temp_files {
    let _ = std::fs::remove_file(t);
  }

  // A duckdb step can't accept a xan-style `--output` flag; the frontend
  // expresses "export to file" by appending an `output` param to the last step.
  // When that final step is duckdb, write its captured CSV stdout to the target
  // path here, so `[duckdb] -> [output]` works without an intermediate xan step.
  if let Some(last) = commands.last() {
    if is_duckdb(&last.name) {
      if let Some(path) = last
        .parameters
        .iter()
        .find(|p| p.name == "output" && !p.value.is_empty())
        .map(|p| p.value.clone())
      {
        match std::fs::write(&path, &final_stdout) {
          Ok(()) => final_stdout.clear(),
          Err(e) => {
            step_errors.insert(
              last.id.clone().unwrap_or_default(),
              format!("Failed to write output file: {}", e),
            );
          }
        }
      }
    }
  }

  let status = final_status.unwrap_or_else(|| std::process::Command::new("").status().unwrap());
  let mut combined_stderr = Vec::new();
  for (_, buf) in &raw_stderr {
    if !combined_stderr.is_empty() {
      combined_stderr.extend_from_slice(&b"\n"[..]);
    }
    combined_stderr.extend_from_slice(buf);
  }

  Ok((
    std::process::Output {
      status,
      stdout: final_stdout,
      stderr: combined_stderr,
    },
    step_errors,
  ))
}

/// Thin async wrapper: executes a duckdb-containing pipeline on the blocking
/// pool and maps the result back into `ExecutionResult`.
async fn run_duckdb_pipeline(
  commands: Vec<PipelineCommand>,
  input_file: String,
  default_delimiter: String,
  no_headers: bool,
  cancel_flag: &'static AtomicBool,
  max_output_bytes: Option<usize>,
) -> Result<ExecutionResult, String> {
  let result = tokio::task::spawn_blocking(move || {
    pipeline_seq(
      &commands,
      &input_file,
      &default_delimiter,
      no_headers,
      cancel_flag,
    )
  })
  .await
  .map_err(|e| format!("Task execution failed: {}", e))??;

  let cancelled = cancel_flag.load(Ordering::Relaxed);
  let (process_output, step_errors) = result;

  Ok(ExecutionResult {
    success: process_output.status.success() && !cancelled,
    output: truncate_output(
      String::from_utf8_lossy(&process_output.stdout).to_string(),
      max_output_bytes,
    ),
    error: String::from_utf8_lossy(&process_output.stderr).to_string(),
    cancelled,
    step_errors,
  })
}
