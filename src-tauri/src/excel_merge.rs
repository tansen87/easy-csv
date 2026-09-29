//! Excel multi-file merge (design 025): turn the sheets of N workbooks —
//! possibly spread over several folders — into ONE table.
//!
//! Reading/writing Excel is delegated to `xan` (`from` / `cat rows` / `to`);
//! this module only orchestrates: discover workbooks → convert each selected
//! sheet to a temp CSV → pre-flight the headers → concatenate → emit.
//!
//! Hard-won facts this code relies on (all verified against xan 0.60.0):
//! - `cat rows` only reads CSV: feeding it `.xlsx` parses zip bytes as CSV.
//! - `-U`/`-I` realign columns **by name**; final order = first part's order,
//!   then previously-unseen columns appended in encounter order.
//! - `--source-column` is silently dropped under `-U`/`-I`, so the source
//!   column is prepended by us instead (it survives the union realign).
//! - `--paths` entries are resolved against the child's cwd → must be absolute.
//! - `to xlsx` always writes a single sheet named `Sheet1`.
//!
//! Concurrency is deliberately NOT used here (§2.6 of design 025): peak memory
//! stays `max(single sheet)` instead of `K × max`, which is the property the
//! whole design is built around.

use crate::pipeline::TempFiles;
use crate::tabular::run_capture;
use crate::xan::find_xan_executable;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::Instant;

const XAN_MISSING: &str =
  "xan is not installed. Open the plugins tab to install it, then try again.";
const DEFAULT_SOURCE_COLUMN: &str = "source";

// --- public payload types ----------------------------------------------------
//
// NOTE on casing: command *arguments* arrive camelCase (Tauri v2 converts
// top-level argument names), and a nested struct argument is deserialized by
// serde with its own field names — hence `rename_all = "camelCase"` on the
// request. Response payloads follow the project convention of the other
// file-level commands (snake_case, mirroring `SplitLinesResult` /
// `TabularData`); the frontend maps them to camelCase locally.

#[derive(Debug, Clone, Serialize)]
pub struct ExcelSourceFile {
  pub path: String,
  pub sheets: Vec<String>,
  pub ok: bool,
  pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExcelScanResult {
  pub files: Vec<ExcelSourceFile>,
  pub file_count: usize,
  /// Union of the sheet names of every readable workbook, in encounter order.
  pub sheet_names: Vec<String>,
  pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExcelMergeRequest {
  pub roots: Vec<String>,
  #[serde(default)]
  pub recursive: bool,
  #[serde(default)]
  pub extensions: Vec<String>,
  /// `"first"`(default) | `"name"` | `"all"` — mutually exclusive, no "index".
  #[serde(default = "default_sheet_mode")]
  pub sheet_mode: String,
  #[serde(default)]
  pub sheet_name: Option<String>,
  /// `"error"`(default) | `"skip"`
  #[serde(default)]
  pub missing_sheet: Option<String>,
  /// `"union"`(default) | `"strict"` | `"intersection"`
  #[serde(default = "default_align")]
  pub align: String,
  /// `"none"`(default) | `"file"` | `"file_sheet"`
  #[serde(default)]
  pub source_column: Option<String>,
  #[serde(default)]
  pub source_column_name: Option<String>,
  #[serde(default)]
  pub output_path: String,
  pub output_format: String,
  #[serde(default)]
  pub out_delimiter: Option<String>,
  /// Workbooks to skip (display paths as reported by `scan_excel_sources`).
  /// Intentional exclusion, not a warning; matched case-insensitively.
  #[serde(default)]
  pub exclude: Vec<String>,
}

fn default_sheet_mode() -> String {
  "first".to_string()
}

fn default_align() -> String {
  "union".to_string()
}

#[derive(Debug, Serialize)]
pub struct ColumnCoverage {
  pub column: String,
  pub present_in: usize,
  pub total: usize,
}

#[derive(Debug, Serialize)]
pub struct UnionSummary {
  pub final_columns: Vec<String>,
  /// Columns that not every part has — this is the quantified "widening".
  pub not_in_all_parts: Vec<ColumnCoverage>,
  /// Pairs of final columns differing only by case / surrounding whitespace.
  pub near_duplicate_columns: Vec<(String, String)>,
}

#[derive(Debug, Serialize)]
pub struct ExcelMergeResult {
  pub output_path: String,
  pub output_format: String,
  pub source_file_count: usize,
  pub sheet_count: usize,
  pub total_rows: usize,
  pub header: Vec<String>,
  /// Workbooks/sheets excluded before or during the merge, with the reason.
  pub skipped: Vec<String>,
  /// Non-fatal problems (unreadable workbooks, …) surfaced to the dialog.
  pub warnings: Vec<String>,
  /// Only for `align = union`: makes the widening visible (§3.5).
  pub union_summary: Option<UnionSummary>,
  pub elapsed_ms: u64,
}

// --- option enums ------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum SheetMode {
  First,
  Name,
  All,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum MissingSheetPolicy {
  Error,
  Skip,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum Align {
  Union,
  Strict,
  Intersection,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum SourceColumnMode {
  None,
  File,
  FileSheet,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) enum OutputFormat {
  Csv,
  Xlsx,
}

impl OutputFormat {
  fn extension(self) -> &'static str {
    match self {
      OutputFormat::Csv => "csv",
      OutputFormat::Xlsx => "xlsx",
    }
  }
}

fn parse_sheet_mode(v: &str) -> Result<SheetMode, String> {
  match v {
    "first" => Ok(SheetMode::First),
    "name" => Ok(SheetMode::Name),
    "all" => Ok(SheetMode::All),
    other => Err(format!(
      "Invalid sheet mode: {other:?} (expected \"first\", \"name\" or \"all\")"
    )),
  }
}

fn parse_missing_sheet(v: Option<&str>) -> Result<MissingSheetPolicy, String> {
  match v.unwrap_or("error") {
    "error" => Ok(MissingSheetPolicy::Error),
    "skip" => Ok(MissingSheetPolicy::Skip),
    other => Err(format!(
      "Invalid missing-sheet policy: {other:?} (expected \"error\" or \"skip\")"
    )),
  }
}

fn parse_align(v: &str) -> Result<Align, String> {
  match v {
    "union" => Ok(Align::Union),
    "strict" => Ok(Align::Strict),
    "intersection" => Ok(Align::Intersection),
    other => Err(format!(
      "Invalid alignment: {other:?} (expected \"union\", \"strict\" or \"intersection\")"
    )),
  }
}

fn parse_source_column(v: Option<&str>) -> Result<SourceColumnMode, String> {
  match v.unwrap_or("none") {
    "none" => Ok(SourceColumnMode::None),
    "file" => Ok(SourceColumnMode::File),
    "file_sheet" => Ok(SourceColumnMode::FileSheet),
    other => Err(format!(
      "Invalid source column mode: {other:?} (expected \"none\", \"file\" or \"file_sheet\")"
    )),
  }
}

fn parse_output_format(v: &str) -> Result<OutputFormat, String> {
  match v {
    "csv" => Ok(OutputFormat::Csv),
    "xlsx" => Ok(OutputFormat::Xlsx),
    other => Err(format!(
      "Invalid output format: {other:?} (expected \"csv\" or \"xlsx\")"
    )),
  }
}

/// One character (or the two-character `\t` escape); empty means "default".
/// NOTE: no `trim()` here — a literal tab delimiter would be trimmed away.
fn normalize_delimiter(v: Option<&str>) -> Result<Option<char>, String> {
  let Some(raw) = v else { return Ok(None) };
  if raw.is_empty() {
    return Ok(None);
  }
  let normalized = if raw == "\\t" { "\t" } else { raw };
  let mut chars = normalized.chars();
  let Some(first) = chars.next() else {
    return Err("Output delimiter must not be empty".to_string());
  };
  if chars.next().is_some() {
    return Err(format!(
      "Invalid output delimiter: {raw:?} (must be a single character)"
    ));
  }
  Ok(Some(first))
}

// --- xan invocation shell ----------------------------------------------------

fn xan_executable() -> Result<PathBuf, String> {
  find_xan_executable()
    .map(PathBuf::from)
    .ok_or_else(|| XAN_MISSING.to_string())
}

/// Normalize xan stderr into a single readable line.
fn xan_error(stderr: &[u8]) -> String {
  let text = String::from_utf8_lossy(stderr)
    .lines()
    .map(|l| l.trim())
    .filter(|l| !l.is_empty())
    .collect::<Vec<_>>()
    .join("; ");
  if text.is_empty() {
    "xan exited with an error (no stderr output)".to_string()
  } else {
    text
  }
}

fn xan_run(exe: &Path, args: &[String]) -> Result<(), String> {
  let output = run_capture(exe, args, "xan")?;
  if output.status.success() {
    Ok(())
  } else {
    Err(xan_error(&output.stderr))
  }
}

/// Display a path the way the rest of the app does: forward slashes, without
/// the `\\?\` prefix `fs::canonicalize` adds on Windows.
fn display_path(path: &Path) -> String {
  let raw = path.to_string_lossy().replace('\\', "/");
  raw.strip_prefix("//?/").unwrap_or(&raw).to_string()
}

fn path_arg(path: &Path) -> String {
  path.to_string_lossy().to_string()
}

/// Sheet names of one workbook, in workbook order (`xan from --list-sheets`).
pub(crate) fn list_workbook_sheets(exe: &Path, path: &Path) -> Result<Vec<String>, String> {
  let args = vec![
    "from".to_string(),
    "--list-sheets".to_string(),
    path_arg(path),
  ];
  let output = run_capture(exe, &args, "xan")?;
  if !output.status.success() {
    return Err(xan_error(&output.stderr));
  }
  Ok(
    String::from_utf8_lossy(&output.stdout)
      .lines()
      .map(|l| l.trim().to_string())
      .filter(|l| !l.is_empty())
      .collect(),
  )
}

/// Convert one sheet of a workbook into a CSV file. `sheet = None` uses xan's
/// default (first sheet, `--sheet-index 0`).
pub(crate) fn sheet_to_csv(
  exe: &Path,
  path: &Path,
  sheet: Option<&str>,
  out: &Path,
) -> Result<(), String> {
  let mut args = vec!["from".to_string()];
  if let Some(name) = sheet {
    args.push("--sheet-name".to_string());
    args.push(name.to_string());
  }
  args.push(path_arg(path));
  args.push("-o".to_string());
  args.push(path_arg(out));
  xan_run(exe, &args)
}

/// Concatenate the part CSVs. `align` maps to plain / `-U` / `-I`.
pub(crate) fn concat_rows(
  exe: &Path,
  paths_list: &Path,
  align: Align,
  out: &Path,
) -> Result<(), String> {
  let mut args = vec!["cat".to_string(), "rows".to_string()];
  match align {
    Align::Union => args.push("-U".to_string()),
    Align::Intersection => args.push("-I".to_string()),
    Align::Strict => {}
  }
  args.push("--paths".to_string());
  args.push(path_arg(paths_list));
  args.push("-o".to_string());
  args.push(path_arg(out));
  xan_run(exe, &args)
}

pub(crate) fn csv_to_xlsx(exe: &Path, src: &Path, out: &Path) -> Result<(), String> {
  xan_run(
    exe,
    &[
      "to".to_string(),
      "xlsx".to_string(),
      path_arg(src),
      "-o".to_string(),
      path_arg(out),
    ],
  )
}

pub(crate) fn fmt_delimiter(
  exe: &Path,
  delimiter: char,
  src: &Path,
  out: &Path,
) -> Result<(), String> {
  xan_run(
    exe,
    &[
      "fmt".to_string(),
      "-t".to_string(),
      delimiter.to_string(),
      path_arg(src),
      "-o".to_string(),
      path_arg(out),
    ],
  )
}

// --- pure core (unit-testable without xan; CI runs these) --------------------

/// Lowercase extension set without leading dots; empty input → `["xlsx"]`.
pub(crate) fn normalize_extensions(extensions: &[String]) -> Vec<String> {
  let mut out: Vec<String> = extensions
    .iter()
    .map(|e| e.trim().trim_start_matches('.').to_ascii_lowercase())
    .filter(|e| !e.is_empty())
    .collect();
  if out.is_empty() {
    out.push("xlsx".to_string());
  }
  out.sort();
  out.dedup();
  out
}

fn has_matching_extension(path: &Path, extensions: &[String]) -> bool {
  match path.extension() {
    Some(ext) => extensions.contains(&ext.to_string_lossy().to_ascii_lowercase()),
    None => false,
  }
}

/// Canonical-path dedupe key; falls back to the lowercased display path when
/// the file cannot be canonicalized (e.g. it disappeared mid-scan).
fn canonical_key(path: &Path) -> String {
  fs::canonicalize(path)
    .map(|p| p.to_string_lossy().to_lowercase())
    .unwrap_or_else(|_| path.to_string_lossy().replace('\\', "/").to_lowercase())
}

/// Discover workbooks under the given roots (files and/or directories, mixed).
///
/// - deterministic order (sorted by lowercased path)
/// - deduplicated by canonical path (a file picked directly *and* through its
///   parent folder is merged once)
/// - symlinked directories are never followed (loop protection)
/// - unreadable entries become warnings instead of failures
pub(crate) fn collect_workbooks(
  roots: &[String],
  recursive: bool,
  extensions: &[String],
) -> (Vec<PathBuf>, Vec<String>) {
  let exts = normalize_extensions(extensions);
  let mut found: Vec<PathBuf> = Vec::new();
  let mut warnings: Vec<String> = Vec::new();
  let mut seen: HashSet<String> = HashSet::new();
  let mut stack: Vec<PathBuf> = roots.iter().map(PathBuf::from).collect();

  while let Some(current) = stack.pop() {
    let meta = match fs::metadata(&current) {
      Ok(m) => m,
      Err(e) => {
        warnings.push(format!("Cannot access {}: {}", display_path(&current), e));
        continue;
      }
    };
    if meta.is_file() {
      if has_matching_extension(&current, &exts) && seen.insert(canonical_key(&current)) {
        found.push(current);
      }
      continue;
    }
    if !meta.is_dir() {
      continue;
    }
    let entries = match fs::read_dir(&current) {
      Ok(e) => e,
      Err(e) => {
        warnings.push(format!(
          "Cannot read directory {}: {}",
          display_path(&current),
          e
        ));
        continue;
      }
    };
    let mut files: Vec<PathBuf> = Vec::new();
    let mut subdirs: Vec<PathBuf> = Vec::new();
    for entry in entries.flatten() {
      let file_type = match entry.file_type() {
        Ok(t) => t,
        Err(_) => continue,
      };
      if file_type.is_dir() {
        if file_type.is_symlink() {
          warnings.push(format!(
            "Skipped symlinked directory {}",
            display_path(&entry.path())
          ));
          continue;
        }
        if recursive {
          subdirs.push(entry.path());
        }
        continue;
      }
      let child = entry.path();
      if !file_type.is_symlink() && has_matching_extension(&child, &exts) {
        files.push(child);
      }
    }
    files.sort();
    for file in files {
      if seen.insert(canonical_key(&file)) {
        found.push(file);
      }
    }
    for dir in subdirs {
      stack.push(dir);
    }
  }

  found.sort_by_key(|p| p.to_string_lossy().to_lowercase());
  (found, warnings)
}

/// One sheet selected for merging.
#[derive(Debug, Clone)]
pub(crate) struct SelectedSheet {
  pub path: PathBuf,
  /// Sheet name, if known. `Some(_)` even in `first` mode (kept for labels);
  /// the xan invocation itself omits the sheet argument there.
  pub sheet: Option<String>,
  /// `Some(_)` only for `name` mode: the argument passed to `--sheet-name`.
  pub sheet_arg: Option<String>,
}

impl SelectedSheet {
  fn label(&self, base: &Path) -> String {
    source_label(
      &self.path,
      self.sheet.as_deref(),
      SourceColumnMode::FileSheet,
      base,
    )
  }
}

/// Resolve the three (mutually exclusive) sheet modes into the part list.
/// Returns `(parts, pre_skipped)`; `pre_skipped` carries workbooks/sheets
/// excluded before conversion, each with a reason.
pub(crate) fn resolve_parts(
  sources: &[ExcelSourceFile],
  mode: SheetMode,
  sheet_name: Option<&str>,
  missing: MissingSheetPolicy,
) -> Result<(Vec<SelectedSheet>, Vec<String>), String> {
  let mut parts: Vec<SelectedSheet> = Vec::new();
  let mut pre_skipped: Vec<String> = Vec::new();

  match mode {
    SheetMode::First => {
      for source in sources.iter().filter(|s| s.ok) {
        match source.sheets.first() {
          Some(first) => parts.push(SelectedSheet {
            path: PathBuf::from(&source.path),
            sheet: Some(first.clone()),
            // xan's default is sheet index 0 — no argument needed.
            sheet_arg: None,
          }),
          None => pre_skipped.push(format!("{} (no sheets)", source.path)),
        }
      }
    }
    SheetMode::Name => {
      let name = match sheet_name.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        Some(name) => name.to_string(),
        None => return Err("A sheet name is required when sheet mode is \"name\"".to_string()),
      };
      let mut missing_in: Vec<String> = Vec::new();
      for source in sources.iter().filter(|s| s.ok) {
        if source.sheets.iter().any(|s| s == &name) {
          parts.push(SelectedSheet {
            path: PathBuf::from(&source.path),
            sheet: Some(name.clone()),
            sheet_arg: Some(name.clone()),
          });
        } else {
          missing_in.push(source.path.clone());
        }
      }
      if !missing_in.is_empty() {
        match missing {
          MissingSheetPolicy::Skip => {
            for path in &missing_in {
              pre_skipped.push(format!("{path} (sheet \"{name}\" not found)"));
            }
          }
          MissingSheetPolicy::Error => {
            return Err(format!(
              "Sheet \"{name}\" not found in {} workbook(s): {}",
              missing_in.len(),
              missing_in.join(", ")
            ));
          }
        }
      }
    }
    SheetMode::All => {
      for source in sources.iter().filter(|s| s.ok) {
        if source.sheets.is_empty() {
          pre_skipped.push(format!("{} (no sheets)", source.path));
          continue;
        }
        for sheet in &source.sheets {
          parts.push(SelectedSheet {
            path: PathBuf::from(&source.path),
            sheet: Some(sheet.clone()),
            sheet_arg: Some(sheet.clone()),
          });
        }
      }
    }
  }

  Ok((parts, pre_skipped))
}

/// A part's header plus a label identifying where it came from.
#[derive(Debug, Clone)]
pub(crate) struct HeaderedPart {
  pub source: String,
  pub header: Vec<String>,
}

/// Validate headers (strict) or compute the final column order
/// (union / intersection). The rules mirror `xan cat rows`:
/// - union: first part's order, then previously-unseen columns appended in
///   encounter order (verified: `a,b` + `b,z` + `b,m` → `a,b,z,m`);
/// - intersection: first part's columns restricted to those every part has;
/// - strict: every part must match the first part exactly.
pub(crate) fn plan_alignment(parts: &[HeaderedPart], align: Align) -> Result<Vec<String>, String> {
  let first = parts
    .first()
    .ok_or_else(|| "No parts to merge".to_string())?;
  match align {
    Align::Strict => {
      let mut conflicts: Vec<String> = Vec::new();
      for part in parts.iter().skip(1) {
        if part.header != first.header {
          conflicts.push(format!(
            "expected {:?} (from \"{}\"), but \"{}\" has {:?}",
            first.header, first.source, part.source, part.header
          ));
          if conflicts.len() >= 3 {
            break;
          }
        }
      }
      if conflicts.is_empty() {
        Ok(first.header.clone())
      } else {
        Err(format!(
          "Inconsistent headers (strict mode): {}. Switch the alignment to \"union\" if the columns are allowed to differ.",
          conflicts.join("; ")
        ))
      }
    }
    Align::Union => {
      let mut final_columns: Vec<String> = first.header.clone();
      for part in parts.iter().skip(1) {
        for column in &part.header {
          if !final_columns.contains(column) {
            final_columns.push(column.clone());
          }
        }
      }
      Ok(final_columns)
    }
    Align::Intersection => {
      let common: Vec<String> = first
        .header
        .iter()
        .filter(|column| {
          parts
            .iter()
            .all(|part| part.header.iter().any(|c| c == *column))
        })
        .cloned()
        .collect();
      if common.is_empty() {
        return Err("No column is shared by every part (intersection is empty)".to_string());
      }
      Ok(common)
    }
  }
}

/// Quantify what the union widened, so the default policy is not silent.
pub(crate) fn union_summary(parts: &[HeaderedPart], final_columns: Vec<String>) -> UnionSummary {
  let total = parts.len();
  let not_in_all_parts: Vec<ColumnCoverage> = final_columns
    .iter()
    .map(|column| {
      let present_in = parts
        .iter()
        .filter(|part| part.header.iter().any(|c| c == column))
        .count();
      (column.clone(), present_in)
    })
    .filter(|(_, present_in)| *present_in < total)
    .map(|(column, present_in)| ColumnCoverage {
      column,
      present_in,
      total,
    })
    .collect();

  let mut near_duplicate_columns: Vec<(String, String)> = Vec::new();
  for i in 0..final_columns.len() {
    for j in (i + 1)..final_columns.len() {
      let a = &final_columns[i];
      let b = &final_columns[j];
      if is_near_duplicate_column(a, b) {
        near_duplicate_columns.push((a.clone(), b.clone()));
      }
    }
  }

  UnionSummary {
    final_columns,
    not_in_all_parts,
    near_duplicate_columns,
  }
}

/// Same column modulo case and surrounding whitespace (`amount` vs `Amount`).
pub(crate) fn is_near_duplicate_column(a: &str, b: &str) -> bool {
  a != b && a.trim().to_lowercase() == b.trim().to_lowercase()
}

/// Longest directory prefix shared by every path (component-wise). Falls back
/// to an empty base when the paths share nothing (different drives, etc.).
pub(crate) fn common_ancestor(paths: &[PathBuf]) -> PathBuf {
  let Some(first) = paths.first() else {
    return PathBuf::new();
  };
  let mut base: Vec<Component> = first.components().collect();
  for path in paths.iter().skip(1) {
    let comps: Vec<Component> = path.components().collect();
    let mut keep = 0;
    while keep < base.len() && keep < comps.len() && base[keep] == comps[keep] {
      keep += 1;
    }
    base.truncate(keep);
    if base.is_empty() {
      break;
    }
  }
  base.into_iter().collect()
}

fn relative_display(path: &Path, base: &Path) -> String {
  match path.strip_prefix(base) {
    Ok(relative) => display_path(relative),
    Err(_) => display_path(path),
  }
}

/// Source-column value: `"file"` → relative path, `"file_sheet"` →
/// `relative path#sheet name`. Falls back to the absolute path when the file
/// is not under `base`.
pub(crate) fn source_label(
  path: &Path,
  sheet: Option<&str>,
  mode: SourceColumnMode,
  base: &Path,
) -> String {
  let rel = relative_display(path, base);
  match mode {
    SourceColumnMode::None => String::new(),
    SourceColumnMode::File => rel,
    SourceColumnMode::FileSheet => match sheet {
      Some(name) => format!("{rel}#{name}"),
      None => rel,
    },
  }
}

/// Write the `--paths` manifest: one **absolute** path per line (relative
/// entries would be resolved against the child process's cwd).
pub(crate) fn write_paths_list(dest: &Path, parts: &[PathBuf]) -> Result<(), String> {
  let mut content = String::new();
  for part in parts {
    let absolute = fs::canonicalize(part).unwrap_or_else(|_| part.clone());
    content.push_str(&display_path(&absolute));
    content.push('\n');
  }
  fs::write(dest, content).map_err(|e| format!("Failed to write paths list: {e}"))
}

/// Default output location: next to the first input, `{stem}_merged.{ext}`.
/// An explicit output has its extension forced to match the chosen format.
pub(crate) fn resolve_output_path(
  output_path: &str,
  first_input: &Path,
  format: OutputFormat,
) -> PathBuf {
  let trimmed = output_path.trim();
  if !trimmed.is_empty() {
    let mut path = PathBuf::from(trimmed);
    let wants = format.extension();
    if path.extension().map(|e| e != wants).unwrap_or(true) {
      path.set_extension(wants);
    }
    return path;
  }
  let parent = first_input
    .parent()
    .filter(|p| !p.as_os_str().is_empty())
    .map(Path::to_path_buf)
    .unwrap_or_else(|| PathBuf::from("."));
  let stem = first_input
    .file_stem()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| "merged".to_string());
  parent.join(format!("{stem}_merged.{}", format.extension()))
}

fn make_temp_dir() -> Result<PathBuf, String> {
  let dir = std::env::temp_dir().join(format!(
    "easycsv-merge-{}-{}",
    std::process::id(),
    Utc::now().timestamp_nanos_opt().unwrap_or_default()
  ));
  fs::create_dir_all(&dir).map_err(|e| format!("Failed to create temp dir: {e}"))?;
  Ok(dir)
}

/// First CSV record of a file (the header row of a part).
fn first_record_of_csv(path: &Path) -> Result<Vec<String>, String> {
  let file =
    fs::File::open(path).map_err(|e| format!("Failed to open {}: {e}", display_path(path)))?;
  let mut reader = csv::Reader::from_reader(file);
  let headers = reader
    .headers()
    .map_err(|e| format!("Failed to parse {}: {e}", display_path(path)))?;
  Ok(headers.iter().map(|s| s.to_string()).collect())
}

/// Row count (data rows, header excluded) + header of one CSV file.
fn read_header_and_rows(path: &Path) -> Result<(Vec<String>, usize), String> {
  let file =
    fs::File::open(path).map_err(|e| format!("Failed to open {}: {e}", display_path(path)))?;
  let mut reader = csv::Reader::from_reader(file);
  let header = reader
    .headers()
    .map_err(|e| format!("Failed to parse {}: {e}", display_path(path)))?
    .iter()
    .map(|s| s.to_string())
    .collect::<Vec<_>>();
  let mut rows = 0usize;
  for record in reader.records() {
    record.map_err(|e| format!("Failed to parse {}: {e}", display_path(path)))?;
    rows += 1;
  }
  Ok((header, rows))
}

/// Prepend a constant column to a CSV (header + every data row). This replaces
/// `cat rows --source-column`, which is silently dropped under `-U`/`-I`.
fn prepend_source_column(
  src: &Path,
  dest: &Path,
  column: &str,
  value: &str,
) -> Result<usize, String> {
  let file =
    fs::File::open(src).map_err(|e| format!("Failed to open {}: {e}", display_path(src)))?;
  let mut reader = csv::Reader::from_reader(file);
  let out_file =
    fs::File::create(dest).map_err(|e| format!("Failed to create {}: {e}", display_path(dest)))?;
  let mut writer = csv::Writer::from_writer(out_file);

  let headers = reader
    .headers()
    .map_err(|e| format!("Failed to parse {}: {e}", display_path(src)))?
    .clone();

  let mut header_row: Vec<String> = vec![column.to_string()];
  header_row.extend(headers.iter().map(|s| s.to_string()));
  writer
    .write_record(&header_row)
    .map_err(|e| format!("Failed to write {}: {e}", display_path(dest)))?;

  let mut rows = 0usize;
  for record in reader.records() {
    let record = record.map_err(|e| format!("Failed to parse {}: {e}", display_path(src)))?;
    let mut row: Vec<&str> = vec![value];
    row.extend(record.iter());
    writer
      .write_record(&row)
      .map_err(|e| format!("Failed to write {}: {e}", display_path(dest)))?;
    rows += 1;
  }
  writer
    .flush()
    .map_err(|e| format!("Failed to write {}: {e}", display_path(dest)))?;
  Ok(rows)
}

/// Same-volume staging file so the final `rename` replaces the destination
/// atomically on every platform.
fn output_staging_path(output: &Path) -> PathBuf {
  let file_name = output
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .unwrap_or_else(|| "output".to_string());
  output
    .parent()
    .map(|p| p.join(format!(".{file_name}.easycsv-tmp")))
    .unwrap_or_else(|| PathBuf::from(format!(".{file_name}.easycsv-tmp")))
}

// --- commands ----------------------------------------------------------------

/// Scan-only: discover workbooks and their sheets, without converting anything.
#[tauri::command]
pub async fn scan_excel_sources(
  roots: Vec<String>,
  recursive: bool,
  extensions: Option<Vec<String>>,
) -> Result<ExcelScanResult, String> {
  tokio::task::spawn_blocking(move || scan_sync(&roots, recursive, &extensions.unwrap_or_default()))
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

/// Merge the selected sheets of every discovered workbook into one table.
#[tauri::command]
pub async fn merge_excel_sources(request: ExcelMergeRequest) -> Result<ExcelMergeResult, String> {
  tokio::task::spawn_blocking(move || merge_sync(request))
    .await
    .map_err(|e| format!("Task join error: {e}"))?
}

fn scan_sync(
  roots: &[String],
  recursive: bool,
  extensions: &[String],
) -> Result<ExcelScanResult, String> {
  if roots.iter().all(|r| r.trim().is_empty()) {
    return Err("No input sources provided".to_string());
  }
  let exe = xan_executable()?;
  let (files, mut warnings) = collect_workbooks(roots, recursive, extensions);

  let mut sources: Vec<ExcelSourceFile> = Vec::new();
  let mut sheet_names: Vec<String> = Vec::new();
  for path in &files {
    match list_workbook_sheets(&exe, path) {
      Ok(sheets) => {
        for sheet in &sheets {
          if !sheet_names.contains(sheet) {
            sheet_names.push(sheet.clone());
          }
        }
        sources.push(ExcelSourceFile {
          path: display_path(path),
          sheets,
          ok: true,
          error: None,
        });
      }
      Err(error) => {
        warnings.push(format!("{}: {}", display_path(path), error));
        sources.push(ExcelSourceFile {
          path: display_path(path),
          sheets: Vec::new(),
          ok: false,
          error: Some(error),
        });
      }
    }
  }

  Ok(ExcelScanResult {
    file_count: sources.len(),
    files: sources,
    sheet_names,
    warnings,
  })
}

fn merge_sync(request: ExcelMergeRequest) -> Result<ExcelMergeResult, String> {
  let started = Instant::now();
  if request.roots.iter().all(|r| r.trim().is_empty()) {
    return Err("No input sources provided".to_string());
  }
  let sheet_mode = parse_sheet_mode(&request.sheet_mode)?;
  let missing = parse_missing_sheet(request.missing_sheet.as_deref())?;
  let align = parse_align(&request.align)?;
  let source_mode = parse_source_column(request.source_column.as_deref())?;
  let format = parse_output_format(&request.output_format)?;
  let delimiter = normalize_delimiter(request.out_delimiter.as_deref())?;

  if sheet_mode == SheetMode::Name
    && request
      .sheet_name
      .as_deref()
      .unwrap_or("")
      .trim()
      .is_empty()
  {
    return Err("A sheet name is required when sheet mode is \"name\"".to_string());
  }

  let source_column_name = request
    .source_column_name
    .as_deref()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty())
    .unwrap_or_else(|| DEFAULT_SOURCE_COLUMN.to_string());

  let exe = xan_executable()?;
  let (files, mut warnings) =
    collect_workbooks(&request.roots, request.recursive, &request.extensions);

  // Workbooks the user excluded in the preview (case-insensitive match on the
  // display path the scan reported). Filtering here also skips their
  // `--list-sheets` calls.
  let excluded: HashSet<String> = request
    .exclude
    .iter()
    .map(|p| p.trim().replace('\\', "/").to_lowercase())
    .collect();
  let files: Vec<PathBuf> = files
    .into_iter()
    .filter(|path| !excluded.contains(&display_path(path).to_lowercase()))
    .collect();

  let mut sources: Vec<ExcelSourceFile> = Vec::new();
  for path in &files {
    match list_workbook_sheets(&exe, path) {
      Ok(sheets) => sources.push(ExcelSourceFile {
        path: display_path(path),
        sheets,
        ok: true,
        error: None,
      }),
      Err(error) => {
        warnings.push(format!("{}: {}", display_path(path), error));
        sources.push(ExcelSourceFile {
          path: display_path(path),
          sheets: Vec::new(),
          ok: false,
          error: Some(error),
        });
      }
    }
  }

  let (selected, mut skipped) =
    resolve_parts(&sources, sheet_mode, request.sheet_name.as_deref(), missing)?;
  if selected.is_empty() {
    let detail = if warnings.is_empty() {
      String::new()
    } else {
      format!(" Problems: {}", warnings.join("; "))
    };
    return Err(format!("No sheets selected to merge.{detail}"));
  }

  let dir = make_temp_dir()?;
  let mut result = merge_in_dir(
    &exe,
    &dir,
    &request,
    align,
    source_mode,
    &source_column_name,
    format,
    delimiter,
    &selected,
    &mut skipped,
  )?;
  let _ = fs::remove_dir_all(&dir);

  result.warnings = warnings;
  result.elapsed_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
  Ok(result)
}

#[allow(clippy::too_many_arguments)]
fn merge_in_dir(
  exe: &Path,
  dir: &Path,
  request: &ExcelMergeRequest,
  align: Align,
  source_mode: SourceColumnMode,
  source_column_name: &str,
  format: OutputFormat,
  delimiter: Option<char>,
  selected: &[SelectedSheet],
  skipped: &mut Vec<String>,
) -> Result<ExcelMergeResult, String> {
  let mut temps = TempFiles::default();
  let mut base =
    common_ancestor(&selected.iter().map(|s| s.path.clone()).collect::<Vec<_>>());
  // With a single workbook the common ancestor is the file itself; source
  // labels are relative to its directory instead (otherwise they'd be empty).
  if selected.len() == 1 {
    if let Some(parent) = base.parent() {
      base = parent.to_path_buf();
    }
  }

  let mut part_paths: Vec<PathBuf> = Vec::new();
  let mut headered: Vec<HeaderedPart> = Vec::new();
  let mut total_rows = 0usize;

  for (index, sheet) in selected.iter().enumerate() {
    let raw = dir.join(format!("raw_{index:04}.csv"));
    sheet_to_csv(exe, &sheet.path, sheet.sheet_arg.as_deref(), &raw).map_err(|e| {
      format!(
        "Failed to read {}#{}: {}",
        display_path(&sheet.path),
        sheet.sheet.clone().unwrap_or_default(),
        e
      )
    })?;

    if fs::metadata(&raw).map(|m| m.len() == 0).unwrap_or(true) {
      skipped.push(format!("{} (empty sheet)", sheet.label(&base)));
      let _ = fs::remove_file(&raw);
      continue;
    }

    let part = if source_mode == SourceColumnMode::None {
      raw
    } else {
      let with_source = dir.join(format!("part_{index:04}.csv"));
      let value = source_label(&sheet.path, sheet.sheet.as_deref(), source_mode, &base);
      let rows = prepend_source_column(&raw, &with_source, source_column_name, &value)?;
      total_rows += rows;
      temps.push(with_source.clone());
      let _ = fs::remove_file(&raw);
      with_source
    };
    temps.push(part.clone());

    let header = first_record_of_csv(&part)?;
    headered.push(HeaderedPart {
      source: sheet.label(&base),
      header,
    });
    part_paths.push(part);
  }

  if headered.is_empty() {
    return Err("All selected sheets are empty".to_string());
  }

  let final_header = plan_alignment(&headered, align)?;
  let summary = if align == Align::Union {
    Some(union_summary(&headered, final_header.clone()))
  } else {
    None
  };

  let paths_list = dir.join("paths.txt");
  write_paths_list(&paths_list, &part_paths)?;
  temps.push(paths_list.clone());

  let merged = dir.join("merged.csv");
  concat_rows(exe, &paths_list, align, &merged).map_err(|e| {
    format!(
      "Failed to concatenate the {} part(s): {}",
      part_paths.len(),
      e
    )
  })?;
  temps.push(merged.clone());

  let total_rows = if source_mode == SourceColumnMode::None {
    read_header_and_rows(&merged)?.1
  } else {
    total_rows
  };

  let first_input = selected
    .first()
    .map(|s| s.path.clone())
    .unwrap_or_else(|| PathBuf::from("."));
  let output = resolve_output_path(&request.output_path, &first_input, format);
  if let Some(parent) = output.parent() {
    if !parent.as_os_str().is_empty() {
      fs::create_dir_all(parent).map_err(|e| {
        format!(
          "Failed to create output directory {}: {e}",
          display_path(parent)
        )
      })?;
    }
  }
  // Same-volume staging file → the final `rename` is atomic on all platforms.
  let staging = output_staging_path(&output);
  temps.push(staging.clone());

  match format {
    OutputFormat::Csv => match delimiter {
      Some(delim) => fmt_delimiter(exe, delim, &merged, &staging)?,
      None => {
        fs::copy(&merged, &staging)
          .map_err(|e| format!("Failed to write {}: {e}", display_path(&staging)))?;
      }
    },
    OutputFormat::Xlsx => csv_to_xlsx(exe, &merged, &staging)
      .map_err(|e| format!("Failed to write the xlsx output: {e}"))?,
  }

  fs::rename(&staging, &output).map_err(|e| {
    format!(
      "Failed to move the result to {}: {e}",
      display_path(&output)
    )
  })?;

  Ok(ExcelMergeResult {
    output_path: display_path(&output),
    output_format: match format {
      OutputFormat::Csv => "csv".to_string(),
      OutputFormat::Xlsx => "xlsx".to_string(),
    },
    source_file_count: selected
      .iter()
      .map(|s| display_path(&s.path))
      .collect::<HashSet<_>>()
      .len(),
    sheet_count: headered.len(),
    total_rows,
    header: final_header,
    skipped: std::mem::take(skipped),
    warnings: Vec::new(),
    union_summary: summary,
    elapsed_ms: 0, // filled by `merge_sync`
  })
}

// --- tests -------------------------------------------------------------------

#[cfg(test)]
mod tests {
  use super::*;

  // -- fixture builder (minimal xlsx, inline strings, stored zip entries) ----

  #[cfg(test)]
  mod fixture {
    use super::*;
    use std::io::Write;

    pub(crate) struct Sheet {
      pub name: String,
      pub rows: Vec<Vec<String>>,
    }

    pub(crate) fn sheet(name: &str, rows: &[&[&str]]) -> Sheet {
      Sheet {
        name: name.to_string(),
        rows: rows
          .iter()
          .map(|r| r.iter().map(|s| s.to_string()).collect())
          .collect(),
      }
    }

    pub(crate) fn empty_sheet(name: &str) -> Sheet {
      Sheet {
        name: name.to_string(),
        rows: Vec::new(),
      }
    }

    fn column_name(mut column: usize) -> String {
      let mut out = String::new();
      while column > 0 {
        let remainder = (column - 1) % 26;
        out.insert(0, (b'A' + remainder as u8) as char);
        column = (column - 1) / 26;
      }
      out
    }

    fn escape(value: &str) -> String {
      value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
    }

    fn sheet_xml(rows: &[Vec<String>]) -> String {
      let mut xml = String::from(
        r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>"#,
      );
      for (row_index, row) in rows.iter().enumerate() {
        xml.push_str(&format!("<row r=\"{}\">", row_index + 1));
        for (column_index, value) in row.iter().enumerate() {
          let reference = format!("{}{}", column_name(column_index + 1), row_index + 1);
          xml.push_str(&format!(
            "<c r=\"{reference}\" t=\"inlineStr\"><is><t>{}</t></is></c>",
            escape(value)
          ));
        }
        xml.push_str("</row>");
      }
      xml.push_str("</sheetData></worksheet>");
      xml
    }

    /// Minimal-but-valid xlsx (inline strings, stored zip entries — no extra
    /// crate features required). calamine/xan reads it fine.
    pub(crate) fn write_workbook(path: &Path, sheets: &[Sheet]) -> Result<(), String> {
      if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
      }
      let file = fs::File::create(path).map_err(|e| e.to_string())?;
      let mut writer = zip::ZipWriter::new(file);
      let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

      let mut entry = |name: &str, content: &str| -> Result<(), String> {
        writer
          .start_file(name, options)
          .map_err(|e| e.to_string())?;
        writer
          .write_all(content.as_bytes())
          .map_err(|e| e.to_string())
      };

      let overrides: String = sheets
        .iter()
        .enumerate()
        .map(|(i, _)| {
          format!(
            "<Override PartName=\"/xl/worksheets/sheet{}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>",
            i + 1
          )
        })
        .collect::<Vec<_>>()
        .join("");
      entry(
        "[Content_Types].xml",
        &format!(
          "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>{overrides}</Types>"
        ),
      )?;
      entry(
        "_rels/.rels",
        "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>",
      )?;
      let sheet_tags: String = sheets
        .iter()
        .enumerate()
        .map(|(i, s)| {
          format!(
            "<sheet name=\"{}\" sheetId=\"{}\" r:id=\"rId{}\"/>",
            escape(&s.name),
            i + 1,
            i + 1
          )
        })
        .collect();
      entry(
        "xl/workbook.xml",
        &format!(
          "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>{sheet_tags}</sheets></workbook>"
        ),
      )?;
      let relationships: String = sheets
        .iter()
        .enumerate()
        .map(|(i, _)| {
          format!(
            "<Relationship Id=\"rId{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet{}.xml\"/>",
            i + 1,
            i + 1
          )
        })
        .collect();
      entry(
        "xl/_rels/workbook.xml.rels",
        &format!(
          "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">{relationships}</Relationships>"
        ),
      )?;
      for (i, sheet) in sheets.iter().enumerate() {
        entry(
          &format!("xl/worksheets/sheet{}.xml", i + 1),
          &sheet_xml(&sheet.rows),
        )?;
      }
      writer.finish().map_err(|e| e.to_string())?;
      Ok(())
    }
  }

  fn unique_dir(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
      "easycsv-merge-test-{}-{}",
      label,
      Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    fs::create_dir_all(&dir).expect("create test dir");
    dir
  }

  fn source(path: &str, sheets: &[&str]) -> ExcelSourceFile {
    ExcelSourceFile {
      path: path.to_string(),
      sheets: sheets.iter().map(|s| s.to_string()).collect(),
      ok: true,
      error: None,
    }
  }

  fn part(source: &str, header: &[&str]) -> HeaderedPart {
    HeaderedPart {
      source: source.to_string(),
      header: header.iter().map(|s| s.to_string()).collect(),
    }
  }

  /// xan location for gated tests: env override → the dev checkout's
  /// resources dir → whatever the app resolves. `None` = skip on CI.
  ///
  /// The binary is **copied into the plugin directory the production resolver
  /// looks at** (`%TEMP%/easycsv-test-data/plugins/<platform>` under
  /// `cargo test`, mirroring design 022's data layout). That way the merge
  /// code under test resolves xan through the very same
  /// `find_xan_executable()` path the app uses — no test-only shortcuts.
  fn xan_for_test() -> Option<PathBuf> {
    static INSTALLED: std::sync::OnceLock<Option<PathBuf>> = std::sync::OnceLock::new();
    INSTALLED
      .get_or_init(|| {
        let source = locate_xan_source()?;
        let target = crate::config::get_resources_dir()
          .join("plugins")
          .join(crate::plugins::PLATFORM_DIR)
          .join(if cfg!(windows) { "xan.exe" } else { "xan" });
        if !target.is_file() {
          fs::create_dir_all(target.parent()?).ok()?;
          fs::copy(&source, &target).ok()?;
          // Warm up the binary: on Windows the first execution of a freshly
          // copied exe can transiently fail (Defender scan), which would make
          // the gated tests flaky.
          let _ = run_capture(&target, &["--version".to_string()], "xan");
        }
        Some(target)
      })
      .clone()
  }

  fn locate_xan_source() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("EASYCSV_XAN_FOR_TEST") {
      let candidate = PathBuf::from(path);
      if candidate.is_file() {
        return Some(candidate);
      }
    }
    let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .join("resources")
      .join("plugins")
      .join(crate::plugins::PLATFORM_DIR)
      .join(if cfg!(windows) { "xan.exe" } else { "xan" });
    if candidate.is_file() {
      return Some(candidate);
    }
    find_xan_executable().map(PathBuf::from)
  }

  // -- normalize_extensions ---------------------------------------------------

  #[test]
  fn normalize_extensions_defaults_and_folds_case() {
    assert_eq!(normalize_extensions(&[]), vec!["xlsx".to_string()]);
    assert_eq!(
      normalize_extensions(&[".XLSX".to_string(), "Xls".to_string(), "xlsx".to_string()]),
      vec!["xls".to_string(), "xlsx".to_string()]
    );
  }

  // -- collect_workbooks ------------------------------------------------------

  #[test]
  fn collect_workbooks_walks_recursively_and_filters_extensions() {
    let dir = unique_dir("collect-recursive");
    fixture::write_workbook(&dir.join("in/a/report_2024_01.xlsx"), &[]).unwrap();
    fs::write(dir.join("in/a/notes.txt"), "not a workbook").unwrap();
    fs::create_dir_all(dir.join("in/b/sub/deep")).unwrap();
    fixture::write_workbook(&dir.join("in/b/sub/report_2024_03.XLSX"), &[]).unwrap();
    fixture::write_workbook(&dir.join("in/b/sub/deep/x.xlsx"), &[]).unwrap();

    let (found, warnings) = collect_workbooks(
      &[dir.join("in").to_string_lossy().to_string()],
      true,
      &["xlsx".to_string()],
    );
    assert!(warnings.is_empty());
    let names: Vec<String> = found.iter().map(|p| display_path(p)).collect();
    assert_eq!(names.len(), 3);
    // Sorted by lowercased full path: a/01 < b/sub/deep/x < b/sub/report…
    assert!(names[0].ends_with("in/a/report_2024_01.xlsx"));
    assert!(names[1].ends_with("in/b/sub/deep/x.xlsx"));
    assert!(names[2].ends_with("in/b/sub/report_2024_03.XLSX"));

    // Non-recursive: only the direct child of the root.
    let (found, _) = collect_workbooks(
      &[dir.join("in").to_string_lossy().to_string()],
      false,
      &["xlsx".to_string()],
    );
    assert!(found.is_empty(), "no workbooks directly under in/");

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn collect_workbooks_deduplicates_by_canonical_path() {
    let dir = unique_dir("collect-dedupe");
    fixture::write_workbook(&dir.join("in/a/one.xlsx"), &[]).unwrap();
    let root = dir.join("in").to_string_lossy().to_string();
    let file = dir.join("in/a/one.xlsx").to_string_lossy().to_string();

    let (found, warnings) = collect_workbooks(&[root, file], true, &["xlsx".to_string()]);
    assert!(warnings.is_empty());
    assert_eq!(found.len(), 1);

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn collect_workbooks_is_deterministic() {
    let dir = unique_dir("collect-deterministic");
    fixture::write_workbook(&dir.join("in/z.xlsx"), &[]).unwrap();
    fixture::write_workbook(&dir.join("in/a.xlsx"), &[]).unwrap();
    fixture::write_workbook(&dir.join("in/M.xlsx"), &[]).unwrap();

    let root = dir.join("in").to_string_lossy().to_string();
    let (first, _) = collect_workbooks(&[root.clone()], false, &["xlsx".to_string()]);
    let (second, _) = collect_workbooks(&[root], false, &["xlsx".to_string()]);
    assert_eq!(
      first.iter().map(|p| display_path(p)).collect::<Vec<_>>(),
      second.iter().map(|p| display_path(p)).collect::<Vec<_>>()
    );
    // Case-insensitive ordering: a.xlsx < M.xlsx < z.xlsx
    assert!(first[0].ends_with("a.xlsx"));
    assert!(first[1].ends_with("M.xlsx"));
    assert!(first[2].ends_with("z.xlsx"));

    let _ = fs::remove_dir_all(&dir);
  }

  // -- resolve_parts ----------------------------------------------------------

  #[test]
  fn resolve_parts_first_uses_each_workbooks_first_sheet() {
    let sources = vec![
      source("a.xlsx", &["Q1", "Q2"]),
      source("b.xlsx", &["Other"]),
    ];
    let (parts, skipped) =
      resolve_parts(&sources, SheetMode::First, None, MissingSheetPolicy::Error).unwrap();
    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0].sheet.as_deref(), Some("Q1"));
    assert_eq!(parts[0].sheet_arg, None, "first mode relies on the default");
    assert_eq!(parts[1].sheet.as_deref(), Some("Other"));
    assert!(skipped.is_empty());
  }

  #[test]
  fn resolve_parts_name_errors_or_skips_missing_workbooks() {
    let sources = vec![
      source("a.xlsx", &["Q1", "Q2"]),
      source("b.xlsx", &["Other"]),
    ];

    let error = resolve_parts(
      &sources,
      SheetMode::Name,
      Some("Q1"),
      MissingSheetPolicy::Error,
    )
    .unwrap_err();
    assert!(error.contains("not found in 1 workbook(s)"), "{error}");
    assert!(error.contains("b.xlsx"), "{error}");

    let (parts, skipped) = resolve_parts(
      &sources,
      SheetMode::Name,
      Some("Q1"),
      MissingSheetPolicy::Skip,
    )
    .unwrap();
    assert_eq!(parts.len(), 1);
    assert_eq!(parts[0].sheet_arg.as_deref(), Some("Q1"));
    assert_eq!(skipped.len(), 1);
    assert!(skipped[0].contains("b.xlsx"));
    assert!(skipped[0].contains("not found"));
  }

  #[test]
  fn resolve_parts_name_requires_a_name() {
    let sources = vec![source("a.xlsx", &["Q1"])];
    assert!(
      resolve_parts(
        &sources,
        SheetMode::Name,
        Some("  "),
        MissingSheetPolicy::Error
      )
      .is_err()
    );
    assert!(resolve_parts(&sources, SheetMode::Name, None, MissingSheetPolicy::Error).is_err());
  }

  #[test]
  fn resolve_parts_all_expands_every_sheet() {
    let sources = vec![source("a.xlsx", &["Q1", "Q2"]), source("b.xlsx", &[])];
    let (parts, skipped) =
      resolve_parts(&sources, SheetMode::All, None, MissingSheetPolicy::Error).unwrap();
    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0].sheet_arg.as_deref(), Some("Q1"));
    assert_eq!(parts[1].sheet_arg.as_deref(), Some("Q2"));
    assert_eq!(skipped, vec!["b.xlsx (no sheets)"]);
  }

  // -- plan_alignment ---------------------------------------------------------

  #[test]
  fn plan_alignment_union_appends_new_columns_in_encounter_order() {
    let parts = vec![
      part("f1", &["a", "b"]),
      part("f2", &["b", "z"]),
      part("f3", &["b", "m"]),
    ];
    let final_columns = plan_alignment(&parts, Align::Union).unwrap();
    // Verified against xan: NOT alphabetical order.
    assert_eq!(final_columns, vec!["a", "b", "z", "m"]);
  }

  #[test]
  fn plan_alignment_intersection_keeps_only_common_columns() {
    let parts = vec![
      part("f1", &["id", "name", "amount"]),
      part("f2", &["name", "id"]),
    ];
    let final_columns = plan_alignment(&parts, Align::Intersection).unwrap();
    assert_eq!(final_columns, vec!["id", "name"]);
  }

  #[test]
  fn plan_alignment_strict_reports_conflicting_sources() {
    let parts = vec![
      part("f1", &["id", "name"]),
      part("f2", &["name", "id"]),
      part("f3", &["name", "id"]),
    ];
    let error = plan_alignment(&parts, Align::Strict).unwrap_err();
    assert!(error.contains("Inconsistent headers"), "{error}");
    assert!(error.contains("f2"), "{error}");
    assert!(error.contains("Switch the alignment"), "{error}");
  }

  #[test]
  fn plan_alignment_strict_accepts_identical_headers() {
    let parts = vec![part("f1", &["id"]), part("f2", &["id"])];
    assert_eq!(plan_alignment(&parts, Align::Strict).unwrap(), vec!["id"]);
  }

  #[test]
  fn plan_alignment_requires_parts() {
    assert!(plan_alignment(&[], Align::Union).is_err());
  }

  // -- union_summary / is_near_duplicate_column -------------------------------

  #[test]
  fn union_summary_quantifies_widening() {
    let parts = vec![
      part("f1", &["id", "name"]),
      part("f2", &["id", "name", "memo"]),
      part("f3", &["id", "name", "memo"]),
    ];
    let final_columns = plan_alignment(&parts, Align::Union).unwrap();
    let summary = union_summary(&parts, final_columns);
    assert_eq!(summary.final_columns, vec!["id", "name", "memo"]);
    assert_eq!(summary.not_in_all_parts.len(), 1);
    assert_eq!(summary.not_in_all_parts[0].column, "memo");
    assert_eq!(summary.not_in_all_parts[0].present_in, 2);
    assert_eq!(summary.not_in_all_parts[0].total, 3);
    assert!(summary.near_duplicate_columns.is_empty());
  }

  #[test]
  fn union_summary_flags_near_duplicate_columns() {
    let parts = vec![part("f1", &["amount", "id"]), part("f2", &["Amount", "id"])];
    let final_columns = plan_alignment(&parts, Align::Union).unwrap();
    let summary = union_summary(&parts, final_columns);
    assert_eq!(
      summary.near_duplicate_columns,
      vec![("amount".to_string(), "Amount".to_string())]
    );
    // Not every part has either spelling → both reported as widening.
    assert_eq!(summary.not_in_all_parts.len(), 2);
  }

  #[test]
  fn union_summary_is_silent_when_nothing_widened() {
    let parts = vec![part("f1", &["id"]), part("f2", &["id"])];
    let summary = union_summary(&parts, vec!["id".to_string()]);
    assert!(summary.not_in_all_parts.is_empty());
    assert!(summary.near_duplicate_columns.is_empty());
  }

  #[test]
  fn is_near_duplicate_column_matches_case_and_whitespace_only() {
    assert!(is_near_duplicate_column("amount", "Amount"));
    assert!(is_near_duplicate_column("id ", "id"));
    assert!(is_near_duplicate_column(" i d", "I D"));
    assert!(!is_near_duplicate_column("amount", "amout"));
    assert!(!is_near_duplicate_column("amount", "total"));
    assert!(
      !is_near_duplicate_column("id", "id"),
      "identical is not a pair"
    );
  }

  // -- source_label / common_ancestor -----------------------------------------

  #[test]
  fn source_label_builds_file_and_file_sheet_labels() {
    let base = PathBuf::from("/data/in");
    let path = PathBuf::from("/data/in/a/report.xlsx");
    assert_eq!(
      source_label(&path, None, SourceColumnMode::File, &base),
      "a/report.xlsx"
    );
    assert_eq!(
      source_label(&path, Some("Q1"), SourceColumnMode::FileSheet, &base),
      "a/report.xlsx#Q1"
    );
  }

  #[test]
  fn source_label_falls_back_to_absolute_when_not_under_base() {
    let base = PathBuf::from("/data/in");
    let path = PathBuf::from("/other/place/report.xlsx");
    assert_eq!(
      source_label(&path, Some("Q1"), SourceColumnMode::FileSheet, &base),
      "/other/place/report.xlsx#Q1"
    );
  }

  #[test]
  fn common_ancestor_finds_the_shared_directory() {
    let paths = vec![
      PathBuf::from("/data/in/a/one.xlsx"),
      PathBuf::from("/data/in/b/sub/two.xlsx"),
    ];
    assert_eq!(common_ancestor(&paths), PathBuf::from("/data/in"));
  }

  #[test]
  fn common_ancestor_is_empty_when_paths_share_nothing() {
    // Relative paths (no root / drive component) that diverge immediately.
    let paths = vec![PathBuf::from("one/one.xlsx"), PathBuf::from("two/two.xlsx")];
    assert_eq!(common_ancestor(&paths), PathBuf::new());
  }

  // -- write_paths_list -------------------------------------------------------

  #[test]
  fn write_paths_list_writes_absolute_forward_slash_lines() {
    let dir = unique_dir("paths-list");
    fixture::write_workbook(&dir.join("in/a/one.xlsx"), &[]).unwrap();
    fixture::write_workbook(&dir.join("in/带 空格.xlsx"), &[]).unwrap();
    let parts = vec![dir.join("in/a/one.xlsx"), dir.join("in/带 空格.xlsx")];
    let list = dir.join("paths.txt");

    write_paths_list(&list, &parts).unwrap();
    let content = fs::read_to_string(&list).unwrap();
    let lines: Vec<&str> = content.lines().collect();
    assert_eq!(lines.len(), 2);
    for line in &lines {
      assert!(Path::new(line).is_absolute(), "{line} is not absolute");
      assert!(!line.contains('\\'), "{line} keeps backslashes");
    }
    assert!(lines[1].contains("带 空格.xlsx"), "{}", lines[1]);

    let _ = fs::remove_dir_all(&dir);
  }

  // -- resolve_output_path ----------------------------------------------------

  #[test]
  fn resolve_output_path_defaults_next_to_the_first_input() {
    let output = resolve_output_path(
      "  ",
      &PathBuf::from("/data/in/a/one.xlsx"),
      OutputFormat::Xlsx,
    );
    assert_eq!(output, PathBuf::from("/data/in/a/one_merged.xlsx"));

    let output = resolve_output_path("", &PathBuf::from("/data/in/a/one.xlsx"), OutputFormat::Csv);
    assert_eq!(output, PathBuf::from("/data/in/a/one_merged.csv"));
  }

  #[test]
  fn resolve_output_path_forces_the_extension_to_match_the_format() {
    let output = resolve_output_path(
      "/data/out/result.v2.csv",
      &PathBuf::from("/data/in/a/one.xlsx"),
      OutputFormat::Xlsx,
    );
    assert_eq!(output, PathBuf::from("/data/out/result.v2.xlsx"));

    let output = resolve_output_path(
      "/data/out/result.csv",
      &PathBuf::from("/data/in/a/one.xlsx"),
      OutputFormat::Csv,
    );
    assert_eq!(output, PathBuf::from("/data/out/result.csv"));
  }

  // -- normalize_delimiter ----------------------------------------------------

  #[test]
  fn normalize_delimiter_accepts_single_characters_and_tab() {
    assert_eq!(normalize_delimiter(None).unwrap(), None);
    assert_eq!(normalize_delimiter(Some("")).unwrap(), None);
    assert_eq!(normalize_delimiter(Some(",")).unwrap(), Some(','));
    assert_eq!(normalize_delimiter(Some("\\t")).unwrap(), Some('\t'));
    assert_eq!(normalize_delimiter(Some("\t")).unwrap(), Some('\t'));
    assert!(normalize_delimiter(Some("  ")).is_err());
    assert!(normalize_delimiter(Some("ab")).is_err());
  }

  // -- xan-gated tests (skipped on CI, where xan is unavailable) --------------

  fn merge_request(dir: &Path, sheet_mode: &str, align: &str, source: &str) -> ExcelMergeRequest {
    ExcelMergeRequest {
      roots: vec![dir.join("in").to_string_lossy().to_string()],
      recursive: true,
      extensions: vec!["xlsx".to_string()],
      sheet_mode: sheet_mode.to_string(),
      sheet_name: None,
      missing_sheet: None,
      align: align.to_string(),
      source_column: Some(source.to_string()),
      source_column_name: None,
      exclude: Vec::new(),
      output_path: dir.join("out/result.csv").to_string_lossy().to_string(),
      output_format: "csv".to_string(),
      out_delimiter: None,
    }
  }

  /// Three workbooks mirroring §2.3 of the design doc: identical headers, one
  /// with a different column order, one with an unrelated extra sheet.
  fn build_merge_fixture(dir: &Path) {
    fixture::write_workbook(
      &dir.join("in/a/report_2024_01.xlsx"),
      &[
        fixture::sheet(
          "Q1",
          &[
            &["id", "name", "amount"],
            &["1", "alice", "100"],
            &["2", "bob", "200"],
          ],
        ),
        fixture::sheet("Q2", &[&["id", "name", "amount"], &["3", "carol", "300"]]),
      ],
    )
    .unwrap();
    fixture::write_workbook(
      &dir.join("in/a/report_2024_02.xlsx"),
      &[
        fixture::sheet("Q1", &[&["id", "name", "amount"], &["4", "dave", "400"]]),
        fixture::sheet(
          "Q2",
          &[
            &["id", "name", "amount"],
            &["5", "erin", "500"],
            &["6", "frank", "600"],
          ],
        ),
      ],
    )
    .unwrap();
    fixture::write_workbook(
      &dir.join("in/b/sub/report_2024_03.xlsx"),
      &[
        fixture::sheet("Q1", &[&["name", "id", "amount"], &["gina", "7", "700"]]),
        fixture::sheet("Notes", &[&["memo"], &["hello"]]),
      ],
    )
    .unwrap();
  }

  #[test]
  fn xan_lists_workbook_sheets_in_workbook_order() {
    if xan_for_test().is_none() {
      return;
    }
    let exe = xan_for_test().expect("xan present");
    let dir = unique_dir("xan-list-sheets");
    fixture::write_workbook(
      &dir.join("wb.xlsx"),
      &[
        fixture::sheet("Q1", &[&["id"]]),
        fixture::sheet("Zulu", &[&["id"]]),
      ],
    )
    .unwrap();

    let sheets = list_workbook_sheets(&exe, &dir.join("wb.xlsx")).unwrap();
    assert_eq!(sheets, vec!["Q1".to_string(), "Zulu".to_string()]);

    assert!(list_workbook_sheets(&exe, &dir.join("missing.xlsx")).is_err());
    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_converts_a_sheet_preserving_its_own_column_order() {
    if xan_for_test().is_none() {
      return;
    }
    let exe = xan_for_test().expect("xan present");
    let dir = unique_dir("xan-sheet-to-csv");
    fixture::write_workbook(
      &dir.join("wb.xlsx"),
      &[fixture::sheet("Q1", &[&["name", "id"], &["gina", "7"]])],
    )
    .unwrap();

    let out = dir.join("part.csv");
    sheet_to_csv(&exe, &dir.join("wb.xlsx"), Some("Q1"), &out).unwrap();
    let (header, rows) = read_header_and_rows(&out).unwrap();
    assert_eq!(header, vec!["name", "id"]);
    assert_eq!(rows, 1);

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_union_end_to_end_matches_the_verified_chain() {
    if xan_for_test().is_none() {
      return;
    }
    let dir = unique_dir("xan-merge-union");
    build_merge_fixture(&dir);

    let mut request = merge_request(&dir, "all", "union", "file_sheet");
    let output = dir.join("out/merged.csv");
    request.output_path = output.to_string_lossy().to_string();

    let result = merge_sync(request).expect("merge should succeed");
    assert_eq!(result.output_format, "csv");
    assert_eq!(result.source_file_count, 3);
    assert_eq!(result.sheet_count, 6);
    assert_eq!(result.total_rows, 8);
    assert_eq!(
      result.header,
      vec!["source", "id", "name", "amount", "memo"]
    );
    assert!(result.skipped.is_empty());
    let summary = result.union_summary.expect("union summary present");
    // The `Notes` sheet lacks id/name/amount, so those are widened too —
    // reported in final-column order, memo last.
    assert_eq!(summary.not_in_all_parts.len(), 4);
    assert_eq!(summary.not_in_all_parts[0].column, "id");
    assert_eq!(summary.not_in_all_parts[0].present_in, 5);
    assert_eq!(summary.not_in_all_parts[3].column, "memo");
    assert_eq!(summary.not_in_all_parts[3].present_in, 1);
    assert_eq!(summary.not_in_all_parts[3].total, 6);

    let expected = "source,id,name,amount,memo\n\
a/report_2024_01.xlsx#Q1,1,alice,100,\n\
a/report_2024_01.xlsx#Q1,2,bob,200,\n\
a/report_2024_01.xlsx#Q2,3,carol,300,\n\
a/report_2024_02.xlsx#Q1,4,dave,400,\n\
a/report_2024_02.xlsx#Q2,5,erin,500,\n\
a/report_2024_02.xlsx#Q2,6,frank,600,\n\
b/sub/report_2024_03.xlsx#Q1,7,gina,700,\n\
b/sub/report_2024_03.xlsx#Notes,,,,hello\n";
    let actual = fs::read_to_string(&output).unwrap();
    assert_eq!(actual, expected, "merged CSV must match the verified chain");

    // The staging file is gone; only the final output remains.
    let staging = output_staging_path(&output);
    assert!(!staging.exists());

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_strict_fails_before_writing_any_output() {
    if xan_for_test().is_none() {
      return;
    }
    let dir = unique_dir("xan-merge-strict");
    build_merge_fixture(&dir);

    let mut request = merge_request(&dir, "all", "strict", "none");
    let output = dir.join("out/merged.csv");
    request.output_path = output.to_string_lossy().to_string();

    let error = merge_sync(request).unwrap_err();
    assert!(error.contains("Inconsistent headers"), "{error}");
    assert!(!output.exists(), "no output file may appear on failure");

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_name_mode_reports_missing_sheets() {
    if xan_for_test().is_none() {
      return;
    }
    let dir = unique_dir("xan-merge-name");
    fixture::write_workbook(
      &dir.join("in/has_q1.xlsx"),
      &[fixture::sheet("Q1", &[&["id"], &["1"]])],
    )
    .unwrap();
    fixture::write_workbook(
      &dir.join("in/no_q1.xlsx"),
      &[fixture::sheet("Other", &[&["id"], &["2"]])],
    )
    .unwrap();

    let mut request = merge_request(&dir, "name", "union", "file");
    request.sheet_name = Some("Q1".to_string());
    request.missing_sheet = Some("error".to_string());
    let error = merge_sync(request).unwrap_err();
    assert!(error.contains("not found in 1 workbook(s)"), "{error}");
    assert!(error.contains("no_q1.xlsx"), "{error}");

    // With `skip`, only the workbook that has the sheet is merged.
    let mut request = merge_request(&dir, "name", "union", "file");
    request.sheet_name = Some("Q1".to_string());
    request.missing_sheet = Some("skip".to_string());
    request.output_path = dir.join("out/merged.csv").to_string_lossy().to_string();
    let result = merge_sync(request).unwrap();
    assert_eq!(result.sheet_count, 1);
    assert_eq!(result.skipped.len(), 1);
    assert!(result.skipped[0].contains("no_q1.xlsx"));

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_excludes_workbooks_marked_in_the_preview() {
    if xan_for_test().is_none() {
      return;
    }
    let dir = unique_dir("xan-merge-exclude");
    fixture::write_workbook(
      &dir.join("in/a/one.xlsx"),
      &[fixture::sheet("Data", &[&["id"], &["1"]])],
    )
    .unwrap();
    fixture::write_workbook(
      &dir.join("in/b/two.xlsx"),
      &[fixture::sheet("Data", &[&["id"], &["2"]])],
    )
    .unwrap();

    let mut request = merge_request(&dir, "all", "union", "file_sheet");
    // Exclusion matches the display path case-insensitively, ignoring
    // backslash vs forward slash.
    request.exclude = vec![dir.join("in\\B\\two.xlsx").to_string_lossy().to_string()];
    request.output_path = dir.join("out/merged.csv").to_string_lossy().to_string();

    let result = merge_sync(request).unwrap();
    assert_eq!(result.source_file_count, 1);
    assert_eq!(result.total_rows, 1);

    let content = fs::read_to_string(dir.join("out/merged.csv")).unwrap();
    assert!(content.contains("one.xlsx"), "{content}");
    assert!(!content.contains("two.xlsx"), "{content}");

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_skips_empty_sheets() {
    if xan_for_test().is_none() {
      return;
    }
    let dir = unique_dir("xan-merge-empty");
    fixture::write_workbook(
      &dir.join("in/wb.xlsx"),
      &[
        fixture::sheet("Data", &[&["id", "name"], &["1", "alice"]]),
        fixture::empty_sheet("Blank"),
      ],
    )
    .unwrap();

    let mut request = merge_request(&dir, "all", "union", "file_sheet");
    request.output_path = dir.join("out/merged.csv").to_string_lossy().to_string();
    let result = merge_sync(request).unwrap();
    assert_eq!(result.sheet_count, 1);
    assert_eq!(result.total_rows, 1);
    assert_eq!(result.skipped.len(), 1);
    assert!(result.skipped[0].contains("(empty sheet)"));
    assert!(result.skipped[0].contains("Blank"));

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_writes_a_single_sheet_xlsx_and_defaults_the_output_path() {
    if xan_for_test().is_none() {
      return;
    }
    let exe = xan_for_test().expect("xan present");
    let dir = unique_dir("xan-merge-xlsx");
    fixture::write_workbook(
      &dir.join("in/one.xlsx"),
      &[fixture::sheet("Data", &[&["id", "name"], &["1", "alice"]])],
    )
    .unwrap();

    let mut request = merge_request(&dir, "first", "union", "file");
    request.output_path = String::new(); // → in/one_merged.csv … but format = csv
    request.output_format = "xlsx".to_string();
    let result = merge_sync(request).unwrap();

    // Extension is forced to match the chosen format, and the file sits next
    // to the first input.
    let expected = dir.join("in/one_merged.xlsx");
    assert_eq!(
      Path::new(&result.output_path),
      expected.as_path(),
      "{}",
      result.output_path
    );
    assert!(expected.is_file());

    // xan's xlsx writer always emits a single sheet named `Sheet1`.
    let sheets = list_workbook_sheets(&exe, &expected).unwrap();
    assert_eq!(sheets, vec!["Sheet1".to_string()]);

    let _ = fs::remove_dir_all(&dir);
  }

  #[test]
  fn xan_merge_reports_xan_absence_and_skips_unreadable_workbooks() {
    let dir = unique_dir("xan-merge-warnings");
    fixture::write_workbook(
      &dir.join("in/good.xlsx"),
      &[fixture::sheet("Data", &[&["id"]])],
    )
    .unwrap();
    // A `.xlsx` that is not a zip → `from --list-sheets` fails.
    fs::write(dir.join("in/broken.xlsx"), "not a workbook").unwrap();

    let mut request = merge_request(&dir, "all", "union", "file_sheet");
    request.output_path = dir.join("out/merged.csv").to_string_lossy().to_string();
    let result = merge_sync(request).unwrap();
    assert_eq!(result.source_file_count, 1);
    assert!(
      result.warnings.iter().any(|w| w.contains("broken.xlsx")),
      "{:?}",
      result.warnings
    );
    assert!(result.skipped.is_empty());

    let _ = fs::remove_dir_all(&dir);
  }
}
