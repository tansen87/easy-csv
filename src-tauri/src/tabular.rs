//! Non-CSV tabular inputs (design `docs/design/024_parquet-duckdb-file-reading.md`).
//!
//! Parquet files and DuckDB database files are read through the DuckDB CLI
//! plugin: the app never links an arrow/parquet/duckdb crate (the `.duckdb`
//! storage format has no pure-Rust reader), it shells out to the user-installed
//! `duckdb` executable — the same optional plugin that powers the `duckdb`
//! pipeline command (design 011).

use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::AtomicBool;

use serde::{Deserialize, Serialize};

use crate::pipeline::wait_with_cancel_to_file;
use crate::plugins::resolve_plugin_executable;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Error shown when the DuckDB CLI plugin is missing but a `.parquet` /
/// `.duckdb` file needs it.
pub const DUCKDB_PLUGIN_MISSING: &str = "DuckDB plugin is required to read .parquet / .duckdb files. Install it under Settings → Plugins.";

/// Error for a chained (non-final) duckdb step whose SQL holds several
/// statements; wrapping it into `CREATE TEMP TABLE … AS ( … )` / `COPY ( … )`
/// requires a single query.
pub const CHAIN_SINGLE_QUERY_ERROR: &str = "A chained duckdb step must be a single query (found multiple statements). Split it into separate steps or place it last.";

/// Input file formats recognized by extension (case-insensitive).
///
/// Everything unknown stays [`InputFormat::Csv`] — the backend must not grow
/// new failure modes for paths it never saw before (the frontend decides what
/// may be opened).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputFormat {
  Csv,
  Parquet,
  Duckdb,
}

pub fn detect_input_format(path: &str) -> InputFormat {
  let ext = Path::new(path)
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_ascii_lowercase();
  match ext.as_str() {
    "parquet" => InputFormat::Parquet,
    // `.db` is ambiguous (could be SQLite); DuckDB reports a clear
    // "not a valid DuckDB database file" error, which beats the old
    // "please use the from command" dead end.
    "duckdb" | "ddb" | "db" => InputFormat::Duckdb,
    _ => InputFormat::Csv,
  }
}

/// Where pipeline input data comes from. Replaces the raw `PathBuf` that used
/// to flow through `pipeline_seq` as `current_input`.
#[derive(Debug, Clone)]
pub enum SourceRef {
  Csv(PathBuf),
  Parquet(PathBuf),
  Duckdb { path: PathBuf, table: String },
}

impl SourceRef {
  pub fn path(&self) -> &Path {
    match self {
      SourceRef::Csv(p) | SourceRef::Parquet(p) | SourceRef::Duckdb { path: p, .. } => p,
    }
  }

  /// `ATTACH` preamble required before [`Self::relation_sql`] can be used.
  fn attach_sql(&self) -> String {
    match self {
      SourceRef::Duckdb { path, .. } => {
        format!("ATTACH {} AS src (READ_ONLY);\n", path_literal(path))
      }
      _ => String::new(),
    }
  }

  /// Table expression usable after `FROM` (run [`Self::attach_sql`] first).
  pub fn relation_sql(&self) -> String {
    match self {
      SourceRef::Csv(p) => format!("read_csv_auto({}, header = true)", path_literal(p)),
      SourceRef::Parquet(p) => format!("read_parquet({})", path_literal(p)),
      SourceRef::Duckdb { table, .. } => format!("src.{}", qualified_ident(table)),
    }
  }
}

/// SQL that exposes a [`SourceRef`] as the virtual relation `input`.
pub fn source_view_sql(src: &SourceRef) -> String {
  format!(
    "{}CREATE OR REPLACE VIEW input AS SELECT * FROM {};",
    src.attach_sql(),
    src.relation_sql()
  )
}

// --- SQL literal / identifier escaping (pure, unit tested) ------------------

/// `'` → `''`, wrapped in single quotes. For string literals (file paths).
pub fn quote_literal(s: &str) -> String {
  format!("'{}'", s.replace('\'', "''"))
}

/// `"` → `""`, wrapped in double quotes. For identifiers (table names).
pub fn quote_ident(s: &str) -> String {
  format!("\"{}\"", s.replace('"', "\"\""))
}

/// File path as a DuckDB string literal: backslashes normalized to `/` (same
/// trick `pipeline.rs` already used for the temp CSV), then quoted.
pub fn path_literal(p: &Path) -> String {
  quote_literal(&p.to_string_lossy().replace('\\', "/"))
}

/// `"schema"."table"` for qualified names, plain `"table"` otherwise.
pub fn qualified_ident(table: &str) -> String {
  table
    .split('.')
    .filter(|part| !part.is_empty())
    .map(quote_ident)
    .collect::<Vec<_>>()
    .join(".")
}

// --- executable resolution ---------------------------------------------------

pub fn duckdb_executable() -> Result<PathBuf, String> {
  resolve_plugin_executable("duckdb").ok_or_else(|| DUCKDB_PLUGIN_MISSING.to_string())
}

// --- DuckDB CLI invocation ---------------------------------------------------

pub(crate) fn run_capture(
  exe: &Path,
  args: &[String],
  label: &str,
) -> Result<std::process::Output, String> {
  let mut command = Command::new(exe);
  command.args(args);
  #[cfg(target_os = "windows")]
  {
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }
  command
    .output()
    .map_err(|e| format!("Failed to run {label}: {}", e))
}

fn duckdb_error(stderr: &[u8]) -> String {
  let text = String::from_utf8_lossy(stderr).trim().to_string();
  if text.is_empty() {
    "duckdb exited with an error (no stderr output)".to_string()
  } else {
    text
  }
}

// --- .duckdb table listing ---------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
pub struct DuckdbTableInfo {
  pub schema: String,
  pub name: String,
  pub kind: String,
}

/// List the user tables / views of a `.duckdb` file (read-only attach).
#[tauri::command]
pub async fn list_duckdb_tables(path: String) -> Result<Vec<DuckdbTableInfo>, String> {
  tokio::task::spawn_blocking(move || list_duckdb_tables_sync(&path))
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

fn list_duckdb_tables_sync(path: &str) -> Result<Vec<DuckdbTableInfo>, String> {
  if !Path::new(path).exists() {
    return Err(format!("File not found: {}", path));
  }
  let exe = duckdb_executable()?;
  let sql = format!(
    "{}SELECT table_schema, table_name, table_type FROM information_schema.tables \
     WHERE table_catalog = 'src' AND table_schema NOT IN ('information_schema', 'pg_catalog') \
     ORDER BY table_schema, table_name;",
    attach_literal(path)
  );
  let output = run_capture(
    &exe,
    &[
      "-csv".to_string(),
      "-noheader".to_string(),
      "-bail".to_string(),
      "-c".to_string(),
      sql,
    ],
    "duckdb",
  )?;
  if !output.status.success() {
    return Err(duckdb_error(&output.stderr));
  }

  let text = String::from_utf8_lossy(&output.stdout);
  let mut rdr = csv::ReaderBuilder::new()
    .has_headers(false)
    .flexible(true)
    .from_reader(Cursor::new(text.as_bytes()));
  let mut tables = Vec::new();
  for result in rdr.records() {
    let record = result.map_err(|e| format!("Failed to parse duckdb output: {}", e))?;
    let get = |i: usize| record.get(i).unwrap_or("").to_string();
    tables.push(DuckdbTableInfo {
      schema: get(0),
      name: get(1),
      kind: get(2),
    });
  }
  Ok(tables)
}

fn attach_literal(path: &str) -> String {
  format!(
    "ATTACH {} AS src (READ_ONLY);\n",
    path_literal(Path::new(path))
  )
}

// --- preview reading ---------------------------------------------------------

/// `read_csv_file`'s counterpart for every tabular format. CSV delegates to the
/// existing `read_csv_sync`; parquet / duckdb run a bounded `SELECT * … LIMIT`
/// through the DuckDB CLI and parse the CSV output.
#[derive(Debug, Serialize, Deserialize)]
pub struct TabularData {
  pub headers: Vec<String>,
  pub rows: Vec<Vec<String>>,
  pub columns: usize,
  /// `"csv" | "parquet" | "duckdb"`
  pub format: String,
  /// Only meaningful for `format == "csv"`.
  pub delimiter: Option<String>,
  pub delimiter_source: Option<String>,
  pub delimiter_confidence: Option<String>,
  /// Only set for duckdb inputs (echoes the chosen table).
  pub source_table: Option<String>,
}

#[tauri::command]
pub async fn read_tabular_file(
  file_path: String,
  table: Option<String>,
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  limit: Option<usize>,
) -> Result<TabularData, String> {
  tokio::task::spawn_blocking(move || {
    read_tabular_sync(&file_path, table, delimiter, fallback_delimiter, limit)
  })
  .await
  .map_err(|e| format!("Task join error: {e}"))?
}

fn read_tabular_sync(
  file_path: &str,
  table: Option<String>,
  delimiter: Option<String>,
  fallback_delimiter: Option<String>,
  limit: Option<usize>,
) -> Result<TabularData, String> {
  match detect_input_format(file_path) {
    InputFormat::Csv => {
      let data = crate::csv::read_csv_sync(
        file_path,
        delimiter.as_deref(),
        fallback_delimiter.as_deref(),
        limit,
      )?;
      Ok(TabularData {
        columns: data.columns,
        format: "csv".to_string(),
        delimiter: Some(data.delimiter),
        delimiter_source: Some(data.delimiter_source),
        delimiter_confidence: Some(data.delimiter_confidence),
        source_table: None,
        headers: data.headers,
        rows: data.rows,
      })
    }
    InputFormat::Parquet => preview_query(Path::new(file_path), None, limit),
    InputFormat::Duckdb => {
      let table = table
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .ok_or_else(|| "A table must be selected for .duckdb input files".to_string())?;
      preview_query(Path::new(file_path), Some(table), limit)
    }
  }
}

fn preview_query(
  path: &Path,
  table: Option<String>,
  limit: Option<usize>,
) -> Result<TabularData, String> {
  if !path.exists() {
    return Err(format!("File not found: {}", path.display()));
  }
  let limit = limit.unwrap_or(51);
  let exe = duckdb_executable()?;

  let (sql, source_table) = match &table {
    Some(table) => (
      format!(
        "{}SELECT * FROM src.{} LIMIT {};",
        attach_literal(&path.to_string_lossy()),
        qualified_ident(table),
        limit
      ),
      Some(table.clone()),
    ),
    None => (
      format!(
        "SELECT * FROM read_parquet({}) LIMIT {};",
        path_literal(path),
        limit
      ),
      None,
    ),
  };

  let output = run_capture(
    &exe,
    &[
      "-csv".to_string(),
      "-bail".to_string(),
      "-c".to_string(),
      sql,
    ],
    "duckdb",
  )?;
  if !output.status.success() {
    return Err(duckdb_error(&output.stderr));
  }

  let (headers, rows) = parse_csv_output(&output.stdout)?;
  Ok(TabularData {
    columns: headers.len(),
    format: if table.is_some() {
      "duckdb".to_string()
    } else {
      "parquet".to_string()
    },
    delimiter: None,
    delimiter_source: None,
    delimiter_confidence: None,
    source_table,
    headers,
    rows,
  })
}

fn parse_csv_output(bytes: &[u8]) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
  let text = String::from_utf8_lossy(bytes);
  let mut rdr = csv::ReaderBuilder::new()
    .has_headers(true)
    .flexible(true)
    .from_reader(Cursor::new(text.as_bytes()));
  let headers: Vec<String> = rdr
    .headers()
    .map_err(|e| format!("Failed to parse duckdb output: {}", e))?
    .iter()
    .map(|s| s.to_string())
    .collect();
  let mut rows = Vec::new();
  for result in rdr.records() {
    let record = result.map_err(|e| format!("Failed to parse duckdb output: {}", e))?;
    rows.push(record.iter().map(|s| s.to_string()).collect());
  }
  Ok((headers, rows))
}

// --- materialization (xan needs CSV) -----------------------------------------

/// Export a non-CSV [`SourceRef`] to a temp CSV so the existing pipeline paths
/// (pure-xan concurrent engine / `pipeline_seq`) can consume it.
///
/// The `-separator` MUST match `default_delimiter`: the first xan step of the
/// pipeline still gets `-d <default_delimiter>` injected, so both sides have to
/// agree on the byte separating fields in the temp file.
pub fn materialize_input_to_csv(
  src: &SourceRef,
  no_headers: bool,
  default_delimiter: &str,
  cancel: &AtomicBool,
  out_path: &Path,
) -> Result<(), String> {
  let exe = duckdb_executable()?;
  let separator = if default_delimiter.is_empty() {
    ","
  } else {
    default_delimiter
  };

  let sql = format!("{}SELECT * FROM {};", src.attach_sql(), src.relation_sql());
  let mut args: Vec<String> = vec![
    "-csv".to_string(),
    "-bail".to_string(),
    "-c".to_string(),
    sql,
  ];
  if no_headers {
    args.push("-noheader".to_string());
  }
  args.push("-separator".to_string());
  args.push(separator.to_string());

  let mut command = Command::new(&exe);
  command.args(&args);
  command.stdin(Stdio::null());
  command.stdout(Stdio::piped());
  command.stderr(Stdio::piped());
  #[cfg(target_os = "windows")]
  {
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }

  let child = command
    .spawn()
    .map_err(|e| format!("Failed to start duckdb: {}", e))?;
  // Stream stdout straight into the temp file — the export may be as large as
  // the source itself, buffering it in RAM is not an option.
  let output = wait_with_cancel_to_file(child, cancel, out_path)?;
  if !output.status.success() {
    return Err(duckdb_error(&output.stderr));
  }
  Ok(())
}

// --- chained duckdb SQL (design 024 §4.4.1) ----------------------------------

/// Strip trailing semicolons/whitespace and reject multi-statement SQL.
///
/// Semicolons inside string literals are a known false positive: we would
/// rather reject than silently change what the user's SQL does.
pub fn chain_query_sql(sql: &str) -> Result<String, String> {
  let mut s = sql.trim();
  while s.ends_with(';') {
    s = s[..s.len() - 1].trim_end();
  }
  if s.is_empty() {
    return Err("SQL query is required".to_string());
  }
  if s.contains(';') {
    return Err(CHAIN_SINGLE_QUERY_ERROR.to_string());
  }
  Ok(s.to_string())
}

/// One pipeline step reduced to what the chain needs: (step id, sql).
pub type ChainStep = (Option<String>, String);

/// Build the single-process SQL script for an all-duckdb pipeline (024 §4.4.1):
///
/// ```sql
/// SET temp_directory = '…';
/// <source view for `input`>
/// CREATE TEMP TABLE _easycsv_step_1 AS ( <sql_1> );
/// CREATE OR REPLACE VIEW input AS SELECT * FROM _easycsv_step_1;
/// CREATE TEMP TABLE _easycsv_step_2 AS ( <sql_2> );
/// CREATE OR REPLACE VIEW input AS SELECT * FROM _easycsv_step_2;
/// DROP TABLE _easycsv_step_1;            -- old intermediates freed at once
/// <sql_k>                                -- final step: `-csv` prints it
/// ```
///
/// Materializing each step into a temp table (instead of redefining `input`
/// directly as the next query) sidesteps the `CREATE OR REPLACE VIEW input …`
/// self-reference binding ambiguity: every user SQL is evaluated while `input`
/// still points at the correct upstream relation.
///
/// Returns the script plus a map of statement start line (1-based) → step id,
/// used to attribute DuckDB's `LINE n:` errors to pipeline steps.
pub fn build_duckdb_chain_sql(
  steps: &[ChainStep],
  source: &SourceRef,
  _default_delimiter: &str,
  temp_dir: &Path,
) -> Result<(String, Vec<(usize, String)>), String> {
  if steps.is_empty() {
    return Err("No commands provided".to_string());
  }

  let mut script = String::new();
  let mut line_map: Vec<(usize, String)> = Vec::new();

  script.push_str(&format!(
    "SET temp_directory = {};\n",
    path_literal(temp_dir)
  ));
  script.push_str(&source_view_sql(source));
  script.push('\n');

  let last = steps.len() - 1;
  for (i, (id, sql)) in steps.iter().enumerate() {
    let step_id = id.clone().unwrap_or_default();
    line_map.push((count_lines(&script) + 1, step_id));

    if i == last {
      // The final step runs as-is; its result set becomes the `-csv` stdout.
      let s = sql.trim();
      if s.is_empty() {
        return Err("SQL query is required".to_string());
      }
      let mut s = s.to_string();
      if !s.ends_with(';') {
        s.push(';');
      }
      script.push_str(&s);
      script.push('\n');
    } else {
      let body = chain_query_sql(sql)?;
      let table = format!("_easycsv_step_{}", i + 1);
      script.push_str(&format!("CREATE TEMP TABLE {table} AS (\n{body}\n);\n"));
      script.push_str(&format!(
        "CREATE OR REPLACE VIEW input AS SELECT * FROM {table};\n"
      ));
      if i > 0 {
        // The previous intermediate is no longer referenced by `input`.
        script.push_str(&format!("DROP TABLE _easycsv_step_{};\n", i));
      }
    }
  }

  Ok((script, line_map))
}

fn count_lines(s: &str) -> usize {
  s.matches('\n').count()
}

/// Map an error line number back to the step whose statement contains it.
/// Lines before the first step (source view region) and empty step ids map to
/// `None` (the error stays global).
pub fn step_for_line<'a>(map: &'a [(usize, String)], line: usize) -> Option<&'a str> {
  let mut found: Option<&str> = None;
  for (start, id) in map {
    if *start > line {
      break;
    }
    found = Some(id.as_str());
  }
  match found {
    Some("") | None => None,
    Some(id) => Some(id),
  }
}

/// First `LINE n:` occurrence in a DuckDB error message (Postgres-style
/// diagnostic). `None` when the stderr carries no line marker.
pub fn first_error_line(text: &str) -> Option<usize> {
  const MARK: &str = "LINE ";
  let mut rest = text;
  while let Some(pos) = rest.find(MARK) {
    let after = &rest[pos + MARK.len()..];
    let digits: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    if !digits.is_empty() {
      return digits.parse::<usize>().ok();
    }
    if after.is_empty() {
      return None;
    }
    rest = &after[1..];
  }
  None
}

#[cfg(test)]
mod tests {
  use super::*;

  fn csv_source() -> SourceRef {
    SourceRef::Csv(PathBuf::from("C:/data/in.csv"))
  }

  #[test]
  fn detect_input_format_by_extension() {
    assert_eq!(detect_input_format("C:/a.csv"), InputFormat::Csv);
    assert_eq!(detect_input_format("C:/a.CSV"), InputFormat::Csv);
    assert_eq!(detect_input_format("C:/a.txt"), InputFormat::Csv);
    assert_eq!(detect_input_format("C:/a.tsv"), InputFormat::Csv);
    assert_eq!(detect_input_format("C:/a.parquet"), InputFormat::Parquet);
    assert_eq!(detect_input_format("C:/a.Parquet"), InputFormat::Parquet);
    assert_eq!(detect_input_format("C:/a.duckdb"), InputFormat::Duckdb);
    assert_eq!(detect_input_format("C:/a.DDB"), InputFormat::Duckdb);
    assert_eq!(detect_input_format("C:/a.db"), InputFormat::Duckdb);
    // Unknown extensions stay CSV — no new failure modes on the backend.
    assert_eq!(detect_input_format("C:/a.xlsx"), InputFormat::Csv);
    assert_eq!(detect_input_format("C:/a.sqlite"), InputFormat::Csv);
    assert_eq!(detect_input_format("noext"), InputFormat::Csv);
  }

  #[test]
  fn escaping_helpers() {
    assert_eq!(quote_literal("O'Brien"), "'O''Brien'");
    assert_eq!(quote_ident("my\"col"), "\"my\"\"col\"");
    assert_eq!(
      path_literal(Path::new("C:\\data\\x.parquet")),
      "'C:/data/x.parquet'"
    );
    assert_eq!(qualified_ident("items"), "\"items\"");
    assert_eq!(qualified_ident("main.items"), "\"main\".\"items\"");
  }

  #[test]
  fn source_view_sql_covers_all_formats() {
    assert_eq!(
      source_view_sql(&csv_source()),
      "CREATE OR REPLACE VIEW input AS SELECT * FROM read_csv_auto('C:/data/in.csv', header = true);"
    );
    assert_eq!(
      source_view_sql(&SourceRef::Parquet(PathBuf::from("C:/data/x.parquet"))),
      "CREATE OR REPLACE VIEW input AS SELECT * FROM read_parquet('C:/data/x.parquet');"
    );
    assert_eq!(
      source_view_sql(&SourceRef::Duckdb {
        path: PathBuf::from("C:/data/db.duckdb"),
        table: "sales 2024".to_string(),
      }),
      "ATTACH 'C:/data/db.duckdb' AS src (READ_ONLY);\nCREATE OR REPLACE VIEW input AS SELECT * FROM src.\"sales 2024\";"
    );
  }

  #[test]
  fn chain_query_sql_strips_trailing_semicolons_and_rejects_multi_statements() {
    assert_eq!(chain_query_sql("SELECT 1;").unwrap(), "SELECT 1");
    assert_eq!(chain_query_sql("  SELECT 1 ;;  \n").unwrap(), "SELECT 1");
    assert_eq!(
      chain_query_sql("SELECT * FROM input").unwrap(),
      "SELECT * FROM input"
    );
    assert!(chain_query_sql("   ").is_err());
    assert!(chain_query_sql(";").is_err());
    let err = chain_query_sql("SELECT 1; SELECT 2;").unwrap_err();
    assert_eq!(err, CHAIN_SINGLE_QUERY_ERROR);
  }

  #[test]
  fn chain_script_shape_and_line_map() {
    let steps = vec![
      (
        Some("s1".to_string()),
        "SELECT * FROM input WHERE a > 1;".to_string(),
      ),
      (
        Some("s2".to_string()),
        "SELECT count(*) FROM input".to_string(),
      ),
    ];
    let (script, map) = build_duckdb_chain_sql(
      &steps,
      &SourceRef::Parquet(PathBuf::from("C:/data/x.parquet")),
      ",",
      Path::new("C:/Temp"),
    )
    .unwrap();

    let mut lines = script.lines();
    assert_eq!(lines.next().unwrap(), "SET temp_directory = 'C:/Temp';");
    assert_eq!(
      lines.next().unwrap(),
      "CREATE OR REPLACE VIEW input AS SELECT * FROM read_parquet('C:/data/x.parquet');"
    );
    assert_eq!(
      lines.next().unwrap(),
      "CREATE TEMP TABLE _easycsv_step_1 AS ("
    );
    assert_eq!(lines.next().unwrap(), "SELECT * FROM input WHERE a > 1");
    assert_eq!(lines.next().unwrap(), ");");
    assert_eq!(
      lines.next().unwrap(),
      "CREATE OR REPLACE VIEW input AS SELECT * FROM _easycsv_step_1;"
    );
    // Last step runs as-is (trailing `;` added when missing).
    assert_eq!(lines.next().unwrap(), "SELECT count(*) FROM input;");
    assert_eq!(lines.next(), None);
    // Single intermediate → no DROP of a nonexistent predecessor.
    assert!(!script.contains("DROP TABLE"));

    assert_eq!(map.len(), 2);
    assert_eq!(map[0], (3, "s1".to_string()));
    assert_eq!(map[1], (7, "s2".to_string()));
  }

  #[test]
  fn chain_script_drops_previous_intermediate_and_keeps_last_sql_verbatim() {
    let steps = vec![
      (None, "SELECT 1".to_string()),
      (None, "SELECT 2".to_string()),
      (None, "SELECT 3;".to_string()),
    ];
    let (script, _) =
      build_duckdb_chain_sql(&steps, &csv_source(), ",", Path::new("C:/Temp")).unwrap();
    assert!(script.contains("DROP TABLE _easycsv_step_1;"));
    // Only non-final steps become temp tables; step 3 is the last one.
    assert!(script.contains("CREATE TEMP TABLE _easycsv_step_2 AS ("));
    assert!(!script.contains("CREATE TEMP TABLE _easycsv_step_3"));
    // The final statement keeps the user's own trailing `;` (no double one).
    assert!(script.trim_end().ends_with("SELECT 3;"));
  }

  #[test]
  fn chain_rejects_multi_statement_and_empty_intermediate_steps() {
    let steps = vec![
      (None, "SELECT 1; SELECT 2".to_string()),
      (None, "SELECT 3".to_string()),
    ];
    let err = build_duckdb_chain_sql(&steps, &csv_source(), ",", Path::new("C:/Temp")).unwrap_err();
    assert_eq!(err, CHAIN_SINGLE_QUERY_ERROR);

    let steps = vec![(None, "   ".to_string()), (None, "SELECT 3".to_string())];
    let err = build_duckdb_chain_sql(&steps, &csv_source(), ",", Path::new("C:/Temp")).unwrap_err();
    assert_eq!(err, "SQL query is required");

    assert!(build_duckdb_chain_sql(&[], &csv_source(), ",", Path::new("C:/Temp")).is_err());
  }

  #[test]
  fn step_for_line_maps_error_lines_to_steps() {
    let map = vec![
      (1, "".to_string()), // SET temp_directory
      (2, "".to_string()), // source view
      (3, "s1".to_string()),
      (8, "s2".to_string()),
    ];
    assert_eq!(step_for_line(&map, 1), None);
    assert_eq!(step_for_line(&map, 2), None);
    assert_eq!(step_for_line(&map, 3), Some("s1"));
    assert_eq!(step_for_line(&map, 7), Some("s1"));
    assert_eq!(step_for_line(&map, 8), Some("s2"));
    assert_eq!(step_for_line(&map, 99), Some("s2"));
    assert_eq!(step_for_line(&map, 0), None);
  }

  #[test]
  fn first_error_line_finds_the_marker() {
    let stderr = "Binder Error: Table \"x\" does not exist\nLINE 4: SELECT * FROM x;\n";
    assert_eq!(first_error_line(stderr), Some(4));
    assert_eq!(first_error_line("no marker here"), None);
    assert_eq!(first_error_line(""), None);
    // Not followed by digits → keep scanning.
    assert_eq!(first_error_line("LINE nope LINE 7:"), Some(7));
  }
}
