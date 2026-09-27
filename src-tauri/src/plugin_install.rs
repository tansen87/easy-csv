//! Downloading, verifying and placing plugin binaries.
//!
//! Design: `docs/design/023_plugin-repository-and-in-app-install.md`.
//!
//! Order of operations is the whole point: everything is verified before the
//! plugin directory is touched, and the final move is a same-volume rename, so a
//! failure can never leave a half-written executable where the app would run it.
//! The previous binary is not backed up either — it is never opened, because a
//! failed download dies in `.staging`.

use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use crate::config::get_resources_dir;
use crate::plugin_catalog::{self, CatalogAsset};
use crate::plugins::{self, PLATFORM_DIR, PluginStatus};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Between chunks, so a slow line can still finish a large asset.
const READ_TIMEOUT: Duration = Duration::from_secs(30);
/// Progress events are throttled: one per chunk would flood the webview.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(150);

/// Event name the settings page listens on.
pub const PROGRESS_EVENT: &str = "plugin://progress";

#[derive(Clone, serde::Serialize)]
pub struct PluginProgress {
  pub name: String,
  /// `downloading` | `verifying` | `done`
  pub phase: String,
  pub downloaded: u64,
  pub total: u64,
}

/// Names with an install in flight. A `std::sync::Mutex` is enough: it is only
/// ever held for a push or a retain, never across an await.
static INSTALLING: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Names the user asked to stop. Kept separate from `INSTALLING` because a
/// cancellation has to be recorded while the install is still running — the
/// download loop polls this and then unwinds on its own, which is what unwinds
/// the `InFlight` claim with it.
static CANCELLED: Mutex<Vec<String>> = Mutex::new(Vec::new());

/// Whether the user asked to cancel, and clears the flag as it reports it.
///
/// Checking-and-clearing in one step means a cancel that arrives just as a
/// download finishes cannot poison the *next* attempt for the same plugin.
fn take_cancellation(name: &str) -> bool {
  let Ok(mut guard) = CANCELLED.lock() else {
    return false;
  };
  let index = guard.iter().position(|entry| entry == name);
  match index {
    Some(index) => {
      guard.remove(index);
      true
    }
    None => false,
  }
}

fn clear_cancellation(name: &str) {
  if let Ok(mut guard) = CANCELLED.lock() {
    guard.retain(|entry| entry != name);
  }
}

/// Asks an in-flight install to stop.
///
/// Returns whether an install was actually running. Cancelling one that already
/// finished is not an error — the UI races with the last chunk — so the caller
/// only uses the value to decide whether to say anything.
#[tauri::command]
pub async fn cancel_plugin_install(name: String) -> Result<bool, String> {
  let in_flight = INSTALLING
    .lock()
    .map(|guard| guard.iter().any(|entry| entry == &name))
    .unwrap_or(false);
  if !in_flight {
    return Ok(false);
  }
  let mut guard = CANCELLED
    .lock()
    .map_err(|_| "the plugin cancel lock is poisoned".to_string())?;
  if !guard.iter().any(|entry| entry == &name) {
    guard.push(name);
  }
  Ok(true)
}

struct InFlight(String);

impl InFlight {
  fn claim(name: &str) -> Result<Self, String> {
    let mut guard = INSTALLING
      .lock()
      .map_err(|_| "the plugin install lock is poisoned".to_string())?;
    if guard.iter().any(|entry| entry == name) {
      return Err(format!("{name} is already being downloaded"));
    }
    guard.push(name.to_string());
    Ok(Self(name.to_string()))
  }
}

impl Drop for InFlight {
  fn drop(&mut self) {
    if let Ok(mut guard) = INSTALLING.lock() {
      guard.retain(|entry| entry != &self.0);
    }
    // A cancellation that outlived its install (the user pressed cancel right as
    // the download finished) must not cancel the next one.
    clear_cancellation(&self.0);
  }
}

/// The sentinel the download loop returns when the user cancelled.
///
/// Distinguished from a real failure so `install_plugin` can report it without
/// the settings page painting an error banner for a deliberate action.
pub const CANCELLED_ERROR: &str = "cancelled";

fn emit(app: &AppHandle, name: &str, phase: &str, downloaded: u64, total: u64) {
  let _ = app.emit(
    PROGRESS_EVENT,
    PluginProgress {
      name: name.to_string(),
      phase: phase.to_string(),
      downloaded,
      total,
    },
  );
}

fn io_error(context: &str, error: std::io::Error) -> String {
  // On Windows a running plugin binary cannot be replaced; say so instead of
  // surfacing a bare "access denied".
  if error.kind() == std::io::ErrorKind::PermissionDenied {
    return format!(
      "{context}: {error} (the file may be in use — close anything running it and retry)"
    );
  }
  format!("{context}: {error}")
}

#[tauri::command]
pub async fn install_plugin(app: AppHandle, name: String) -> Result<PluginStatus, String> {
  // The name becomes a file name, so it is checked before anything else.
  if !plugin_catalog::is_valid_plugin_name(&name) {
    return Err(format!("invalid plugin name: {name}"));
  }
  let _in_flight = InFlight::claim(&name)?;

  // Refresh first: installing should never act on a stale manifest.
  let resolved = plugin_catalog::current_catalog(true).await?;
  let plugin = resolved
    .catalog
    .plugins
    .iter()
    .find(|plugin| plugin.name == name)
    .ok_or_else(|| format!("{name} is not in the catalog"))?;
  let asset = plugin
    .assets
    .get(PLATFORM_DIR)
    .ok_or_else(|| format!("{name} is not published for {PLATFORM_DIR}"))?;

  // `parse_catalog` already enforced this; repeated because this is the value
  // that ends up joined onto a path.
  if !plugin_catalog::is_valid_asset_file(&asset.file) {
    return Err(format!("{name} has an invalid file name: {}", asset.file));
  }

  let plugin_dir = plugins::get_plugin_dir();
  let staging = get_resources_dir().join("plugins").join(".staging");
  std::fs::create_dir_all(&plugin_dir)
    .map_err(|error| io_error("could not create the plugin folder", error))?;
  std::fs::create_dir_all(&staging)
    .map_err(|error| io_error("could not create the staging folder", error))?;

  let part = staging.join(format!("{name}.part"));
  let _ = std::fs::remove_file(&part); // leftovers from an earlier attempt

  if let Err(error) = download(&app, &name, asset, &part).await {
    // The partial file is harmless where it is, but leaving it behind would let
    // a later attempt see a stale `.part` and mislead anyone poking at the
    // folder. The download loop already removes it on a normal failure; this
    // covers the cancellation path, where it returns early.
    let _ = std::fs::remove_file(&part);
    // A terminal phase so the UI can leave its progress state even when the run
    // ends without a file. Nothing is left to verify, so this is not "done".
    emit(
      &app,
      &name,
      if error == CANCELLED_ERROR {
        "cancelled"
      } else {
        "failed"
      },
      0,
      asset.size,
    );
    return Err(error);
  }
  emit(&app, &name, "verifying", asset.size, asset.size);

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;
    // Without this the binary lands fine and then fails to execute.
    let _ = std::fs::set_permissions(&part, std::fs::Permissions::from_mode(0o755));
  }

  let target = plugin_dir.join(&asset.file);
  std::fs::rename(&part, &target)
    .map_err(|error| io_error(&format!("could not place {}", target.display()), error))?;

  plugins::ensure_registered(&name)?;
  plugins::record_install(&name, &plugin.version, &asset.sha256)?;

  emit(&app, &name, "done", asset.size, asset.size);

  plugins::status_for(&name).ok_or_else(|| {
    format!("{name} was installed but its executable could not be resolved afterwards")
  })
}

async fn download(
  app: &AppHandle,
  name: &str,
  asset: &CatalogAsset,
  part: &Path,
) -> Result<(), String> {
  let client = reqwest::Client::builder()
    .connect_timeout(CONNECT_TIMEOUT)
    .read_timeout(READ_TIMEOUT)
    .build()
    .map_err(|error| format!("could not create the HTTP client: {error}"))?;

  let allow_loopback = plugin_catalog::loopback_allowed();

  // Candidates in order: a mirror that is unreachable must not stop the next one,
  // and integrity does not depend on which one answers.
  //
  // The user's proxy prefix is tried before the direct URL for each asset, and
  // only as an *extra* candidate — the direct URL stays in the list, so a proxy
  // that is down or rejects the host costs one attempt rather than the install.
  let candidates = download_candidates(asset, allow_loopback);

  let mut last_error = String::new();
  for url in &candidates {
    match download_one(&client, app, name, asset, url, part, allow_loopback).await {
      Ok(()) => return Ok(()),
      Err(error) => {
        // A cancellation is not a reason to try the next candidate: the user
        // asked to stop, so stop.
        if error == CANCELLED_ERROR {
          return Err(error);
        }
        last_error = error;
        let _ = std::fs::remove_file(part);
      }
    }
  }

  Err(if last_error.is_empty() {
    "the catalog lists no usable download URL".to_string()
  } else {
    last_error
  })
}

/// Expands an asset's URLs into the full list of URLs to try, in order.
///
/// Split out from `download` so the ordering is testable without a network: the
/// rule that matters is that a proxy appearing in two of the three slots is not
/// the same as it appearing before the direct URL, and the direct URL must never
/// be dropped.
fn download_candidates(asset: &CatalogAsset, allow_loopback: bool) -> Vec<String> {
  let prefix = crate::config::plugin_download_prefix();

  let mut candidates: Vec<String> = Vec::new();
  for url in &asset.urls {
    // The prefixed form is tried first, and is *not* checked against the host
    // allowlist: that list exists to constrain what the catalog may point at,
    // while a proxy host is the user's own choice. The scheme and host shape are
    // still validated in `apply_prefix`.
    if let Some(prefixed) = prefix.as_ref().and_then(|prefix| apply_prefix(prefix, url)) {
      candidates.push(prefixed);
    }
    if plugin_catalog::allowed_url(url, allow_loopback) {
      candidates.push(url.clone());
    }
  }
  candidates
}

/// Prepends a proxy prefix to a URL.
///
/// The whole URL is appended verbatim, which is what the common
/// `https://ghproxy.example/<full-url>` form expects. The result is validated as
/// https before it is used, so a prefix stored by an older build cannot smuggle
/// in something else.
fn apply_prefix(prefix: &str, url: &str) -> Option<String> {
  // The prefix carries the separator; the URL is appended whole (it starts with
  // `https://`, so a bare concatenation after trimming the prefix's own slash
  // would produce `...examplehttps://...`).
  let combined = format!("{}/{}", prefix.trim_end_matches('/'), url);
  // Hosts differ from the catalog's allowlist on purpose; only the scheme and a
  // well-formed host are required.
  combined
    .starts_with("https://")
    .then_some(combined)
    .filter(|candidate| {
      let rest = candidate.strip_prefix("https://").unwrap_or_default();
      !plugin_catalog::host_of(rest).is_empty()
    })
}

async fn download_one(
  client: &reqwest::Client,
  app: &AppHandle,
  name: &str,
  asset: &CatalogAsset,
  url: &str,
  part: &Path,
  allow_loopback: bool,
) -> Result<(), String> {
  let mut response = client
    .get(url)
    .send()
    .await
    .map_err(|error| plugin_catalog::describe(&error))?;

  if !response.status().is_success() {
    return Err(format!("HTTP {}", response.status()));
  }
  if !plugin_catalog::allowed_url(response.url().as_str(), allow_loopback) {
    return Err("a redirect left the allowlist".to_string());
  }

  let mut file = tokio::fs::File::create(part)
    .await
    .map_err(|error| io_error("could not open the download file", error))?;
  let mut hasher = Sha256::new();
  let mut written: u64 = 0;
  let mut last_emit = Instant::now();

  while let Some(chunk) = response
    .chunk()
    .await
    .map_err(|error| plugin_catalog::describe(&error))?
  {
    // Checked per chunk rather than on a timer: a chunk is exactly the natural
    // unit of "the user could have pressed cancel by now", and it needs no
    // extra task or channel. Dropping out here leaves the partial file to the
    // caller, which deletes it.
    if take_cancellation(name) {
      return Err(CANCELLED_ERROR.to_string());
    }
    written += chunk.len() as u64;
    // The catalog already stated the size, so stop before filling the disk with
    // something that cannot be the right file anyway.
    if written > asset.size {
      return Err(format!(
        "the download is larger than the catalog says ({written} > {})",
        asset.size
      ));
    }
    hasher.update(&chunk);
    tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
      .await
      .map_err(|error| io_error("could not write the download", error))?;
    if last_emit.elapsed() >= PROGRESS_INTERVAL {
      last_emit = Instant::now();
      emit(app, name, "downloading", written, asset.size);
    }
  }

  tokio::io::AsyncWriteExt::flush(&mut file)
    .await
    .map_err(|error| io_error("could not flush the download", error))?;
  drop(file);

  if written != asset.size {
    return Err(format!(
      "size mismatch: received {written} bytes, the catalog says {}",
      asset.size
    ));
  }

  let digest = hex::encode(hasher.finalize());
  if !digest.eq_ignore_ascii_case(&asset.sha256) {
    return Err("checksum mismatch: the file does not match the signed catalog".to_string());
  }

  emit(app, name, "downloading", written, asset.size);
  Ok(())
}

#[tauri::command]
pub async fn uninstall_plugin(name: String) -> Result<(), String> {
  if !plugin_catalog::is_valid_plugin_name(&name) {
    return Err(format!("invalid plugin name: {name}"));
  }

  let plugin_dir = plugins::get_plugin_dir();
  let path =
    plugins::resolve_plugin_executable(&name).ok_or_else(|| format!("{name} is not installed"))?;

  // Only remove what this app put in its own directory. A binary on PATH belongs
  // to the user's package manager, and one dropped in by hand is theirs too.
  if !path.starts_with(&plugin_dir) {
    return Err(format!(
      "{name} was not installed by Easy CSV (it resolves to {}); remove it with whatever put it there",
      path.display()
    ));
  }

  std::fs::remove_file(&path)
    .map_err(|error| io_error(&format!("could not delete {}", path.display()), error))?;
  plugins::clear_install_record(&name)?;

  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn asset(urls: &[&str]) -> CatalogAsset {
    CatalogAsset {
      file: "xan".to_string(),
      size: 1,
      sha256: "0".repeat(64),
      urls: urls.iter().map(|url| url.to_string()).collect(),
    }
  }

  #[test]
  fn only_one_install_per_plugin_at_a_time() {
    let first = InFlight::claim("xan").expect("first claim must succeed");
    assert!(
      InFlight::claim("xan").is_err(),
      "a second claim must be refused"
    );
    // A different plugin is independent.
    let other = InFlight::claim("duckdb").expect("other plugin must be claimable");
    drop(other);
    assert!(
      InFlight::claim("duckdb").is_ok(),
      "dropping releases the claim"
    );
    drop(first);
    assert!(
      InFlight::claim("xan").is_ok(),
      "dropping releases the claim"
    );
  }

  const DIRECT: &str =
    "https://github.com/tansen87/easy-csv-plugins/releases/download/xan-v0.61.0/xan.exe";

  #[test]
  fn a_prefix_is_prepended_verbatim() {
    // The conventional proxy form takes the whole URL after the prefix, so the
    // scheme and slashes of the original must survive untouched.
    let combined = apply_prefix("https://ghproxy.example/", DIRECT).expect("must combine");
    assert_eq!(combined, format!("https://ghproxy.example/{DIRECT}"));
  }

  #[test]
  fn a_prefix_without_a_trailing_slash_still_works() {
    // People paste both forms; a missing slash must not produce
    // `https://ghproxy.examplehttps://...`.
    let combined = apply_prefix("https://ghproxy.example", DIRECT).expect("must combine");
    assert_eq!(combined, format!("https://ghproxy.example/{DIRECT}"));
  }

  #[test]
  fn a_prefix_that_is_not_https_is_refused() {
    // Defence in depth: `set_plugin_download_prefix` rejects these, but a value
    // written by an older build is re-checked at use.
    assert!(apply_prefix("http://ghproxy.example/", DIRECT).is_none());
    assert!(apply_prefix("file:///tmp/", DIRECT).is_none());
  }

  #[test]
  fn without_a_prefix_only_the_catalog_urls_are_tried() {
    // `download_candidates` reads the stored setting, which is unset in tests.
    let candidates = download_candidates(&asset(&[DIRECT]), false);
    assert_eq!(candidates, vec![DIRECT.to_string()]);
  }

  #[test]
  fn a_url_outside_the_allowlist_is_never_tried_directly() {
    // The allowlist constrains the *catalog*; a catalog pointing somewhere odd
    // must yield no direct candidate at all.
    let candidates = download_candidates(&asset(&["https://evil.example/xan"]), false);
    assert!(
      candidates.is_empty(),
      "unexpected candidates: {candidates:?}"
    );
  }

  #[test]
  fn cancelling_an_install_that_is_not_running_reports_false() {
    // The UI races with the last chunk, so "nothing to cancel" must be a quiet
    // no-op rather than an error.
    assert!(!take_cancellation("never-started"));
    assert!(
      !CANCELLED
        .lock()
        .unwrap()
        .iter()
        .any(|entry| entry == "never-started")
    );
  }

  #[tokio::test]
  async fn cancelling_an_in_flight_install_is_recorded_once() {
    let in_flight = InFlight::claim("xan").expect("claim must succeed");
    assert!(cancel_plugin_install("xan".to_string()).await.unwrap());
    // Recorded for the download loop to pick up...
    assert!(take_cancellation("xan"));
    // ...and consumed, so it cannot cancel a second run.
    assert!(!take_cancellation("xan"));
    drop(in_flight);
  }

  #[test]
  fn dropping_an_install_clears_any_leftover_cancellation() {
    // A cancel that arrives just as the download completes would otherwise be
    // still sitting in the list when the user retries.
    let in_flight = InFlight::claim("xan").expect("claim must succeed");
    CANCELLED.lock().unwrap().push("xan".to_string());
    drop(in_flight);
    assert!(
      !CANCELLED.lock().unwrap().iter().any(|entry| entry == "xan"),
      "the cancellation must not outlive its install"
    );
  }
}
