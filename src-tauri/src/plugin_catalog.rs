//! Plugin catalog: fetching the signed manifest, verifying it, caching it, and
//! turning it into the view the settings page renders.
//!
//! Design: `docs/design/023_plugin-repository-and-in-app-install.md`.
//!
//! This is the only part of the plugin system that talks to the network, and it
//! is deliberately fail-closed: without a signature that matches a key embedded
//! in the binary, nothing becomes installable. What the signature protects is the
//! *manifest*; each asset is pinned by size and sha256 inside it, so the download
//! host — a mirror, a proxy — cannot change what gets installed.

use std::collections::{BTreeMap, HashSet};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use minisign_verify::{PublicKey, Signature};
use serde::{Deserialize, Serialize};

use crate::config::get_resources_dir;
use crate::plugins::{self, PLATFORM_DIR};

/// Where the catalog comes from, tried in order.
///
/// Unlike design 022's updater `endpoints`, this list is safe to extend because
/// the fallback here is written by us and triggers on *any* failure, timeouts
/// included (see `fetch_catalog`). The GitHub endpoint is the authoritative one;
/// jsDelivr mirrors the same file from `main`, which reaches mainland China
/// considerably more often. Integrity does not depend on which source answers:
/// both serve the same signed manifest, and the manifest pins every asset by
/// size and sha256.
const CATALOG_URLS: [&str; 2] = [
  "https://github.com/tansen87/easy-csv-plugins/releases/latest/download/catalog.json",
  "https://cdn.jsdelivr.net/gh/tansen87/easy-csv-plugins@main/catalog.json",
];

/// Hosts the app will download from. Integrity does not depend on the host (see
/// the module comment), but a compromised catalog must not be able to point the
/// app at arbitrary hosts — or at something listening on localhost.
const ALLOWED_HOSTS: [&str; 5] = [
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
];

/// How long a cached catalog is used without asking GitHub again.
const CACHE_TTL_SECS: u64 = 12 * 60 * 60;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Applies between chunks, not to the whole transfer: a large asset on a slow
/// line must not be killed by a total-time limit.
const READ_TIMEOUT: Duration = Duration::from_secs(30);

// ---------------------------------------------------------------------------
// Manifest types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogAsset {
  /// File name to write into the platform plugin directory.
  pub file: String,
  pub size: u64,
  pub sha256: String,
  /// Candidates, tried in order.
  pub urls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogPlugin {
  pub name: String,
  #[serde(default)]
  pub title: String,
  #[serde(default)]
  pub description: String,
  #[serde(default)]
  pub homepage: String,
  #[serde(default)]
  pub license: String,
  /// Missing means the app is barely usable without it (xan).
  #[serde(default)]
  pub required: bool,
  pub version: String,
  /// Arguments that make the binary print its version; upstreams disagree
  /// (DuckDB's CLI wants `-version`), so the catalog carries it instead of the
  /// app hardcoding a table.
  #[serde(default, rename = "versionArgs")]
  pub version_args: Vec<String>,
  pub assets: BTreeMap<String, CatalogAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
  #[serde(rename = "schemaVersion")]
  pub schema_version: u32,
  /// ISO-8601 UTC. Compared as a string for the rollback guard, which works
  /// because the publisher always writes the same shape.
  #[serde(rename = "generatedAt")]
  pub generated_at: String,
  pub plugins: Vec<CatalogPlugin>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedCatalog {
  fetched_at: u64,
  catalog: Catalog,
}

// ---------------------------------------------------------------------------
// The view handed to the frontend
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct CatalogEntry {
  pub name: String,
  pub title: String,
  pub description: String,
  pub homepage: String,
  pub license: String,
  pub required: bool,
  /// `None` when the catalog has no asset for this platform.
  pub latest_version: Option<String>,
  pub available: bool,
  pub size: Option<u64>,
  /// Whether a binary resolves at all (plugin directory or `PATH`).
  pub installed: bool,
  /// Only known for binaries this app installed.
  pub installed_version: Option<String>,
  pub installed_path: Option<String>,
  /// `registry` (installed by us), `manual` (dropped into the plugin dir) or
  /// `path` (found on `PATH`).
  pub source: Option<String>,
  pub update_available: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct CatalogView {
  pub fetched_at: u64,
  /// The live fetch failed and this is the cached copy.
  pub stale: bool,
  pub plugin_dir: String,
  pub platform: String,
  pub entries: Vec<CatalogEntry>,
}

// ---------------------------------------------------------------------------
// Trust
// ---------------------------------------------------------------------------

/// Public keys the app trusts, one per non-empty line of `plugin-signing.pub`.
///
/// A list rather than a single key: rotating the signing key requires shipping
/// the new key *before* it is used, otherwise an install that never updates would
/// reject every catalog published after the rotation.
pub fn trusted_public_keys() -> Vec<String> {
  include_str!("../plugin-signing.pub")
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .map(str::to_string)
    .collect()
}

/// Verifies `bytes` against a base64-wrapped minisign signature.
///
/// Same shape as `tauri-plugin-updater`'s `verify_signature`: both the key and
/// the signature are base64 on disk and decode to minisign's own text format.
/// Every trusted key is tried, so a rotation can overlap.
pub fn verify_catalog(
  bytes: &[u8],
  signature_base64: &str,
  public_keys: &[String],
) -> Result<(), String> {
  if public_keys.is_empty() {
    return Err("no trusted plugin signing key is embedded in this build".to_string());
  }

  let signature_text = String::from_utf8(base64_decode(signature_base64.trim()))
    .map_err(|_| "the catalog signature is not text after base64 decoding".to_string())?;
  let signature = Signature::decode(&signature_text)
    .map_err(|error| format!("unreadable catalog signature: {error}"))?;

  for key in public_keys {
    let Ok(key_text) = String::from_utf8(base64_decode(key.trim())) else {
      continue;
    };
    let Ok(public_key) = PublicKey::decode(&key_text) else {
      continue;
    };
    // `true` allows legacy (non-prehashed) signatures, matching the updater.
    if public_key.verify(bytes, &signature, true).is_ok() {
      return Ok(());
    }
  }

  Err("the catalog signature does not match any trusted key".to_string())
}

/// A plugin name becomes a file name, so it is a security boundary: reject
/// anything that could escape the plugin directory.
pub fn is_valid_plugin_name(name: &str) -> bool {
  let bytes = name.as_bytes();
  if bytes.is_empty() || bytes.len() > 32 {
    return false;
  }
  if !(bytes[0].is_ascii_lowercase() || bytes[0].is_ascii_digit()) {
    return false;
  }
  bytes
    .iter()
    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-')
}

/// File names come from the catalog too, and are joined onto a directory path.
pub fn is_valid_asset_file(file: &str) -> bool {
  if file.is_empty() || file.len() > 64 || file == "." || file == ".." {
    return false;
  }
  file
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

/// Download hosts the app accepts. `allow_loopback` is only true in debug builds,
/// which is what makes the local end-to-end test in the plugin repository's
/// README possible without weakening a release build.
pub fn allowed_url(url: &str, allow_loopback: bool) -> bool {
  if let Some(rest) = url.strip_prefix("https://") {
    let host = host_of(rest);
    return ALLOWED_HOSTS.contains(&host);
  }
  if allow_loopback {
    if let Some(rest) = url.strip_prefix("http://") {
      let host = host_of(rest);
      return host == "127.0.0.1" || host == "localhost";
    }
  }
  false
}

/// Extracts the host from the part of a URL after the scheme. Public because the
/// download-prefix setting validates a user-supplied URL with the same rules the
/// allowlist uses.
pub fn host_of(rest: &str) -> &str {
  let end = rest
    .find(|c| c == '/' || c == '?' || c == '#')
    .unwrap_or(rest.len());
  // Drop any userinfo, then the port.
  let authority = rest[..end].rsplit('@').next().unwrap_or(&rest[..end]);
  authority.split(':').next().unwrap_or(authority)
}

/// Whether this build may also fetch over plain HTTP from the loopback address.
pub fn loopback_allowed() -> bool {
  cfg!(debug_assertions)
}

// ---------------------------------------------------------------------------
// Parsing, caching
// ---------------------------------------------------------------------------

/// Parses a catalog and rejects the shapes that would be dangerous later.
pub fn parse_catalog(bytes: &[u8]) -> Result<Catalog, String> {
  let catalog: Catalog =
    serde_json::from_slice(bytes).map_err(|error| format!("unreadable catalog: {error}"))?;

  if catalog.schema_version != 1 {
    return Err(format!(
      "unsupported catalog schema version {}",
      catalog.schema_version
    ));
  }
  if catalog.generated_at.is_empty() {
    return Err("the catalog has no generatedAt timestamp".to_string());
  }

  let mut seen: HashSet<&str> = HashSet::new();
  for plugin in &catalog.plugins {
    if !is_valid_plugin_name(&plugin.name) {
      return Err(format!(
        "the catalog contains an invalid plugin name: {}",
        plugin.name
      ));
    }
    if !seen.insert(plugin.name.as_str()) {
      return Err(format!("the catalog lists {} twice", plugin.name));
    }
    if plugin.version.is_empty() {
      return Err(format!("{} has no version", plugin.name));
    }
    for (platform, asset) in &plugin.assets {
      if !is_valid_asset_file(&asset.file) {
        return Err(format!(
          "{} has an invalid file name: {}",
          plugin.name, asset.file
        ));
      }
      if asset.sha256.len() != 64 || !asset.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!(
          "{} has a malformed sha256 for {platform}",
          plugin.name
        ));
      }
      if asset.size == 0 {
        return Err(format!(
          "{} has a zero-sized asset for {platform}",
          plugin.name
        ));
      }
      if asset.urls.is_empty() {
        return Err(format!(
          "{} has no download URL for {platform}",
          plugin.name
        ));
      }
    }
  }

  Ok(catalog)
}

fn cache_path() -> PathBuf {
  get_resources_dir().join("data").join("plugin-catalog.json")
}

fn now_secs() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|elapsed| elapsed.as_secs())
    .unwrap_or(0)
}

fn load_cache() -> Option<CachedCatalog> {
  let text = std::fs::read_to_string(cache_path()).ok()?;
  serde_json::from_str(&text).ok()
}

fn save_cache(cached: &CachedCatalog) {
  let path = cache_path();
  if let Some(parent) = path.parent() {
    let _ = std::fs::create_dir_all(parent);
  }
  if let Ok(text) = serde_json::to_string(cached) {
    let _ = std::fs::write(path, text);
  }
}

/// Version arguments for a plugin, from the cached catalog when it is available.
///
/// Lets a newly published plugin be probed correctly without an app release.
/// `None` means "nothing cached for this plugin" — the caller decides the
/// fallback, because only it knows about the plugins that predate the catalog.
pub fn cached_version_args(name: &str) -> Option<Vec<String>> {
  load_cache()
    .and_then(|cached| {
      cached
        .catalog
        .plugins
        .into_iter()
        .find(|plugin| plugin.name == name)
        .map(|plugin| plugin.version_args)
    })
    .filter(|args| !args.is_empty())
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

pub(crate) fn describe(error: &reqwest::Error) -> String {
  if error.is_timeout() {
    "timed out".to_string()
  } else if error.is_connect() {
    "could not connect".to_string()
  } else {
    error.to_string()
  }
}

async fn get_bytes(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
  if !allowed_url(url, loopback_allowed()) {
    return Err("refused to download from a host outside the allowlist".to_string());
  }
  let response = client
    .get(url)
    .send()
    .await
    .map_err(|error| describe(&error))?;
  if !response.status().is_success() {
    return Err(format!("HTTP {}", response.status()));
  }
  // Redirects land on a different host (GitHub serves assets from
  // objects.githubusercontent.com), so the final URL is checked too.
  if !allowed_url(response.url().as_str(), loopback_allowed()) {
    return Err("a redirect left the allowlist".to_string());
  }
  response
    .bytes()
    .await
    .map(|bytes| bytes.to_vec())
    .map_err(|error| describe(&error))
}

async fn fetch_one(client: &reqwest::Client, base: &str) -> Result<Catalog, String> {
  let bytes = get_bytes(client, base).await?;
  let signature = String::from_utf8(get_bytes(client, &format!("{base}.sig")).await?)
    .map_err(|_| "the signature is not text".to_string())?;
  verify_catalog(&bytes, &signature, &trusted_public_keys())?;
  parse_catalog(&bytes)
}

/// Fetches the catalog from the first source that answers.
///
/// Every source is attempted regardless of *how* the previous one failed. That
/// is the whole point of having a mirror: reaching GitHub from mainland China
/// usually fails by timing out rather than by returning 404, so a fallback that
/// only fires on a bad status code would never fire at all.
///
/// Failures are kept per source and joined, because "could not connect" on its
/// own gives the user nothing to act on — naming which of the two sources was
/// tried is what makes the message worth showing.
async fn fetch_catalog() -> Result<Catalog, String> {
  let client = reqwest::Client::builder()
    .connect_timeout(CONNECT_TIMEOUT)
    .read_timeout(READ_TIMEOUT)
    .build()
    .map_err(|error| format!("could not create the HTTP client: {error}"))?;

  let mut failures: Vec<String> = Vec::new();
  for base in CATALOG_URLS {
    match fetch_one(&client, base).await {
      Ok(catalog) => return Ok(catalog),
      Err(error) => failures.push(format!("{}: {error}", source_label(base))),
    }
  }

  Err(if failures.is_empty() {
    // Only reachable if the list is compiled empty, or every entry was filtered
    // by the host allowlist before a request was even attempted.
    "no catalog URL is allowed in this build".to_string()
  } else {
    format!("no catalog source answered ({})", failures.join("; "))
  })
}

/// A short, human-readable name for a catalog source, for error messages.
///
/// Deliberately hand-written rather than derived from the URL: the user needs to
/// know "GitHub" or "the mirror", not a hostname they cannot do anything about.
fn source_label(base: &str) -> &'static str {
  if base.contains("github.com") {
    "GitHub"
  } else if base.contains("jsdelivr.net") {
    "the mirror"
  } else {
    "a catalog source"
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// A catalog together with how current it is.
pub struct ResolvedCatalog {
  pub catalog: Catalog,
  /// The live fetch failed and this is the cached copy.
  pub stale: bool,
  pub fetched_at: u64,
}

/// The catalog to act on: from the cache while it is fresh, otherwise fetched,
/// verified and cached. Falls back to a stale cache when the network is down, so
/// being offline degrades the settings page instead of breaking it.
pub async fn current_catalog(refresh: bool) -> Result<ResolvedCatalog, String> {
  let cached = load_cache();
  // A `refresh` forces a network round trip; the TTL is what makes opening the
  // settings tab cheap.
  let fresh_enough = !refresh
    && cached
      .as_ref()
      .is_some_and(|entry| now_secs().saturating_sub(entry.fetched_at) < CACHE_TTL_SECS);

  if fresh_enough {
    let entry = cached.expect("checked above");
    return Ok(ResolvedCatalog {
      catalog: entry.catalog,
      stale: false,
      fetched_at: entry.fetched_at,
    });
  }

  match fetch_catalog().await {
    Ok(catalog) => {
      // Rollback guard: refusing an older catalog stops a replay of an older
      // (but validly signed) manifest. The trade-off is that a re-published
      // older release is rejected too, so the error has to say what happened.
      if let Some(previous) = &cached {
        if catalog.generated_at < previous.catalog.generated_at {
          return Err(format!(
            "the published catalog is older than the cached one ({} < {}); refusing to downgrade it",
            catalog.generated_at, previous.catalog.generated_at
          ));
        }
      }
      let fetched_at = now_secs();
      save_cache(&CachedCatalog {
        fetched_at,
        catalog: catalog.clone(),
      });
      Ok(ResolvedCatalog {
        catalog,
        stale: false,
        fetched_at,
      })
    }
    // Offline is normal: fall back to whatever was cached, flagged as stale so
    // the UI can say so instead of pretending it is current.
    Err(error) => match cached {
      Some(previous) => Ok(ResolvedCatalog {
        catalog: previous.catalog,
        stale: true,
        fetched_at: previous.fetched_at,
      }),
      None => Err(format!(
        "{error}. No cached catalog is available, so plugins cannot be listed."
      )),
    },
  }
}

#[tauri::command]
pub async fn get_plugin_catalog(refresh: Option<bool>) -> Result<CatalogView, String> {
  let resolved = current_catalog(refresh.unwrap_or(false)).await?;
  Ok(build_view(
    &resolved.catalog,
    resolved.stale,
    resolved.fetched_at,
  ))
}

fn build_view(catalog: &Catalog, stale: bool, fetched_at: u64) -> CatalogView {
  let records = plugins::install_records();
  let plugin_dir = plugins::get_plugin_dir();

  let entries = catalog
    .plugins
    .iter()
    .map(|plugin| {
      let asset = plugin.assets.get(PLATFORM_DIR);
      let resolved = plugins::resolve_plugin_executable(&plugin.name);
      let record = records.get(&plugin.name);
      let installed_version = record.and_then(|record| record.version.clone());

      // How the binary got there, for the UI label. The db is authoritative for
      // what this app installed; anything else in the plugin directory was put
      // there by hand.
      let source = match (&record.map(|record| record.source.clone()), &resolved) {
        (Some(Some(source)), _) => Some(source.clone()),
        (_, None) => None,
        (_, Some(path)) if path.starts_with(&plugin_dir) => Some("manual".to_string()),
        (_, Some(_)) => Some("path".to_string()),
      };

      CatalogEntry {
        name: plugin.name.clone(),
        title: if plugin.title.is_empty() {
          plugin.name.clone()
        } else {
          plugin.title.clone()
        },
        description: plugin.description.clone(),
        homepage: plugin.homepage.clone(),
        license: plugin.license.clone(),
        required: plugin.required,
        latest_version: asset.map(|_| plugin.version.clone()),
        available: asset.is_some(),
        size: asset.map(|asset| asset.size),
        installed: resolved.is_some(),
        installed_path: resolved.map(|path| path.to_string_lossy().to_string()),
        // Only offer an upgrade for binaries we installed: a version the user
        // dropped in themselves is theirs to manage.
        update_available: match (&installed_version, source.as_deref()) {
          (Some(installed), Some("registry")) => is_newer(&plugin.version, installed),
          _ => false,
        },
        source,
        installed_version,
      }
    })
    .collect();

  CatalogView {
    fetched_at,
    stale,
    plugin_dir: plugin_dir.to_string_lossy().to_string(),
    platform: PLATFORM_DIR.to_string(),
    entries,
  }
}

/// Whether `candidate` is a newer version than `current`. Versions that are not
/// valid semver are compared by inequality — the publisher controls both, so this
/// only affects hand-written catalogs.
pub fn is_newer(candidate: &str, current: &str) -> bool {
  let strip = |value: &str| value.trim_start_matches('v').to_string();
  match (
    semver::Version::parse(&strip(candidate)),
    semver::Version::parse(&strip(current)),
  ) {
    (Ok(candidate), Ok(current)) => candidate > current,
    _ => candidate != current,
  }
}

/// Standard base64, ignoring whitespace and padding.
///
/// Hand-rolled rather than pulling in another dependency: it is twenty lines, it
/// is exercised by the tests below, and the only failure mode that matters is
/// rejecting a valid input — which fails closed.
pub(crate) fn base64_decode(input: &str) -> Vec<u8> {
  let mut output = Vec::with_capacity(input.len() / 4 * 3);
  let mut buffer: u32 = 0;
  let mut bits: u32 = 0;
  for byte in input.bytes() {
    let value = match byte {
      b'A'..=b'Z' => byte - b'A',
      b'a'..=b'z' => byte - b'a' + 26,
      b'0'..=b'9' => byte - b'0' + 52,
      b'+' => 62,
      b'/' => 63,
      _ => continue,
    } as u32;
    buffer = (buffer << 6) | value;
    bits += 6;
    if bits >= 8 {
      bits -= 8;
      output.push((buffer >> bits) as u8);
    }
  }
  output
}

#[cfg(test)]
mod tests {
  use super::*;

  const FIXTURE_CATALOG: &str = include_str!("../tests/fixtures/plugin-catalog/catalog.json");
  const FIXTURE_SIGNATURE: &str = include_str!("../tests/fixtures/plugin-catalog/catalog.json.sig");

  /// The signature covers the fixture's exact bytes, so a line-ending rewrite
  /// silently invalidates it. `.gitattributes` pins these files to LF, and this
  /// assertion turns the resulting "the catalog signature does not match any
  /// trusted key" — which sends you hunting for a key rotation that never
  /// happened — into the actual cause. Only used where verification is expected
  /// to *succeed*; elsewhere the fixture's line endings are irrelevant.
  fn signed_fixture_catalog() -> &'static [u8] {
    assert!(
      !FIXTURE_CATALOG.as_bytes().contains(&b'\r'),
      "the catalog fixture must keep its LF line endings: its bytes are signed"
    );
    FIXTURE_CATALOG.as_bytes()
  }

  #[test]
  fn base64_round_trips_known_vectors() {
    assert_eq!(base64_decode("aGVsbG8="), b"hello");
    assert_eq!(base64_decode("aGVsbG8"), b"hello");
    assert_eq!(base64_decode(""), b"");
    // The decoder is fed whole files, which end with a newline.
    assert_eq!(base64_decode("aGVs\nbG8=\n"), b"hello");
  }

  /// The fixture is the catalog that is actually published, signed by the key
  /// that is actually embedded. If this fails, the signing chain is broken —
  /// not the test.
  #[test]
  fn the_published_catalog_verifies_against_the_embedded_key() {
    let keys = trusted_public_keys();
    assert!(!keys.is_empty(), "plugin-signing.pub must contain a key");
    verify_catalog(signed_fixture_catalog(), FIXTURE_SIGNATURE, &keys)
      .expect("the published catalog must verify");
  }

  #[test]
  fn a_single_changed_byte_invalidates_the_catalog() {
    let keys = trusted_public_keys();
    let mut tampered = FIXTURE_CATALOG.as_bytes().to_vec();
    tampered[0] ^= 0xff;
    assert!(verify_catalog(&tampered, FIXTURE_SIGNATURE, &keys).is_err());
  }

  #[test]
  fn an_untrusted_key_is_rejected() {
    // The app's *updater* key: a real, valid minisign key that never signed this
    // catalog. Keeping the two key pairs apart is only worth something if the
    // verifier actually refuses the other one.
    let updater_key = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENERTZDMjNTRjQxMDIwMzcKUldRM0lCRDBQc0xtemRMY3RaV2FBeENMOTNVR0tkd1NqcmFMenowa3BPRGwzUnVJZlBOVmIwZ1YK";
    assert!(
      verify_catalog(
        FIXTURE_CATALOG.as_bytes(),
        FIXTURE_SIGNATURE,
        &[updater_key.to_string()]
      )
      .is_err()
    );
  }

  #[test]
  fn a_rotation_can_trust_several_keys() {
    // A rotation ships the new key before it signs anything, so the old key must
    // keep verifying while the new one is already accepted. That is what makes a
    // key loss recoverable rather than permanent.
    let updater_key = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IENERTZDMjNTRjQxMDIwMzcKUldRM0lCRDBQc0xtemRMY3RaV2FBeENMOTNVR0tkd1NqcmFMenowa3BPRGwzUnVJZlBOVmIwZ1YK";
    let mut keys = vec![updater_key.to_string()];
    keys.extend(trusted_public_keys());
    assert!(verify_catalog(signed_fixture_catalog(), FIXTURE_SIGNATURE, &keys).is_ok());
  }

  #[test]
  fn an_empty_key_list_fails_closed() {
    assert!(verify_catalog(FIXTURE_CATALOG.as_bytes(), FIXTURE_SIGNATURE, &[]).is_err());
  }

  #[test]
  fn parses_the_published_catalog_and_covers_every_platform() {
    let catalog = parse_catalog(FIXTURE_CATALOG.as_bytes()).expect("fixture must parse");
    assert_eq!(catalog.schema_version, 1);
    assert!(!catalog.generated_at.is_empty());
    assert!(
      catalog
        .plugins
        .iter()
        .any(|plugin| plugin.name == "xan" && plugin.required)
    );
    for plugin in &catalog.plugins {
      assert!(
        plugin.assets.contains_key(PLATFORM_DIR),
        "{} lacks our platform",
        plugin.name
      );
      assert_eq!(
        plugin.assets.len(),
        5,
        "{} should cover five platforms",
        plugin.name
      );
    }
  }

  #[test]
  fn rejects_a_name_that_could_escape_the_plugin_directory() {
    for bad in [
      "../../EasyCsv",
      "..",
      "a/b",
      "a\\b",
      "UPPER",
      ".hidden",
      "-leading",
      "",
      "with space",
      &"x".repeat(33),
    ] {
      assert!(!is_valid_plugin_name(bad), "{bad:?} must be rejected");
    }
    for good in ["xan", "pinyin", "duckdb", "my-plugin", "a1"] {
      assert!(is_valid_plugin_name(good), "{good:?} must be accepted");
    }
  }

  #[test]
  fn rejects_asset_file_names_that_escape() {
    for bad in ["", ".", "..", "a/b", "a\\b", "with space", "nested/dir.exe"] {
      assert!(!is_valid_asset_file(bad), "{bad:?} must be rejected");
    }
    for good in ["xan", "xan.exe", "duckdb_cli", "a-b_c.1"] {
      assert!(is_valid_asset_file(good), "{good:?} must be accepted");
    }
  }

  #[test]
  fn catalog_may_not_point_at_unexpected_hosts() {
    assert!(allowed_url(
      "https://github.com/tansen87/easy-csv-plugins/releases/download/x/y",
      false
    ));
    assert!(allowed_url(
      "https://objects.githubusercontent.com/whatever?token=1",
      false
    ));
    assert!(allowed_url(
      "https://cdn.jsdelivr.net/gh/a/b@main/catalog.json",
      false
    ));

    // Not in the allowlist, or not https.
    assert!(!allowed_url("https://evil.example/x", false));
    assert!(!allowed_url("https://github.com.evil.example/x", false));
    assert!(!allowed_url("http://github.com/x", false));
    assert!(!allowed_url("file:///etc/passwd", false));
    // Loopback is a debug-only affordance.
    assert!(!allowed_url("http://127.0.0.1:8099/x", false));
    assert!(allowed_url("http://127.0.0.1:8099/x", true));
    assert!(allowed_url("http://localhost:8099/x", true));
    assert!(!allowed_url("http://192.168.1.10/x", true));
  }

  #[test]
  fn every_catalog_source_is_reachable_through_the_allowlist() {
    // A source that the allowlist rejects can never be fetched, so it would not
    // be a fallback — it would just be a longer wait followed by the same error.
    for base in CATALOG_URLS {
      assert!(
        allowed_url(base, false),
        "{base} is not allowed by the host allowlist, so it can never be used"
      );
      assert!(
        allowed_url(&format!("{base}.sig"), false),
        "{base}.sig is not allowed"
      );
    }
  }

  #[test]
  fn the_mirror_points_at_main_not_at_a_release() {
    // The whole reason the mirror works is that the release workflow commits the
    // catalog back to `main`. Pointing it at `/releases/...` would make it a
    // duplicate of the primary source rather than a fallback.
    let mirror = CATALOG_URLS
      .iter()
      .find(|url| url.contains("jsdelivr.net"))
      .expect("a mirror must be configured");
    assert!(
      mirror.contains("@main/"),
      "the mirror must serve from main: {mirror}"
    );
    assert!(
      !mirror.contains("/releases/"),
      "the mirror must not use a release asset: {mirror}"
    );
  }

  #[test]
  fn failures_name_the_source_that_failed() {
    // Both sources must be distinguishable in the message; otherwise a user
    // cannot tell whether GitHub or the mirror is the one being blocked.
    assert_eq!(source_label(CATALOG_URLS[0]), "GitHub");
    assert_eq!(source_label(CATALOG_URLS[1]), "the mirror");
    assert_eq!(
      source_label("https://example.test/catalog.json"),
      "a catalog source"
    );
  }

  #[test]
  fn update_detection_follows_semver() {
    assert!(is_newer("0.61.0", "0.60.0"));
    assert!(is_newer("1.5.5", "1.5.4"));
    assert!(is_newer("v0.61.0", "0.60.0"));
    assert!(!is_newer("0.61.0", "0.61.0"));
    assert!(!is_newer("0.60.0", "0.61.0"));
    // Semver treats a pre-release as older than the release, which is what we
    // want: "1.5.5-variegata" must not look like an upgrade over 1.5.5.
    assert!(!is_newer("1.5.5-variegata", "1.5.5"));
    assert!(is_newer("1.5.5", "1.5.5-variegata"));
    // Not parseable as semver at all: any difference counts as an update, since
    // both sides come from catalogs the publisher controls.
    assert!(is_newer("1.5.5 (Variegata)", "1.5.4"));
  }

  #[test]
  fn refuses_a_catalog_that_breaks_the_shape() {
    let base = FIXTURE_CATALOG;
    for (label, mutated) in [
      (
        "schema",
        base.replace("\"schemaVersion\": 1", "\"schemaVersion\": 2"),
      ),
      (
        "name",
        base.replace("\"name\": \"xan\"", "\"name\": \"../../EasyCsv\""),
      ),
      ("sha", base.replace("\"sha256\": \"", "\"sha256\": \"zz")),
    ] {
      assert!(
        parse_catalog(mutated.as_bytes()).is_err(),
        "a catalog broken in {label} must be rejected"
      );
    }
  }
}
