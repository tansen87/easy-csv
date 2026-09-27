# Changelog

## [0.6.1] - 2026-09-27

4 commits since v0.6.0.

### Added

- **In-app plugin install from a signed repository**: plugins are no longer something you download and drop into a folder by hand. Settings → Plugins lists the available plugins (`xan`, `pinyin`, `duckdb`) with their versions and install state, and installs one with a single click: the app fetches a `catalog.json` manifest over HTTPS, checks its minisign signature against a bundled public key, downloads the asset for the current platform, verifies its `sha256` against the manifest and only then puts it in place. Installed plugins show whether an update is available, can be updated in place, and can be uninstalled when this app installed them. A missing `xan` at startup now opens a guidance dialog instead of failing commands with an obscure error. Design `023_plugin-repository-and-in-app-install`.
- **Offline and slow-network handling for plugin installs**: the manifest is cached with a TTL and dated to reject rollbacks, a cached copy is used when the network is unreachable, and the fetch falls back source by source (GitHub release, then a jsDelivr mirror), naming the source that failed. Downloads can be cancelled mid-flight, and an optional download-acceleration prefix (Settings → Plugins) is tried before each asset's direct URL.
- **Install progress in the update dialog header**: a download/install started from the update dialog now shows a compact progress bar with a percentage in the header itself, so it stays visible while the release notes scroll.

### Changed

- **Windows/Linux data directory now sits beside the executable**: the app installs into `<path>/EasyCsv` and keeps `data/`, `plugins/`, `templates/` and `versions/` next to `EasyCsv.exe`, instead of hiding user data in `%LOCALAPPDATA%`. macOS keeps `~/Library/Application Support/EasyCsv`. When the install directory is not writable (for example under `Program Files`), the data falls back to the previous per-user location. A one-time copy migrates existing data — from both the v0.6 `%LOCALAPPDATA%\EasyCsv` and the v0.4/v0.5 `<install dir>\EasyCsv_resources` — without moving or deleting the source.
- **Uninstall follows the chosen data location**: the NSIS uninstaller removes the install directory (and the per-user fallback) only when the user ticks "delete application data"; otherwise the data is left in place.
- **Updating stays data-safe**: the installer is invoked in update mode, which skips the old uninstaller and its data prompt, so an in-place update never touches user data.

### Fixed

- **"Open output location" did not open anything.** `reveal_paths` calls the opener plugin from Rust, which requires the `opener:default` capability; it was missing from the capability set, so the call was rejected and the frontend surfaced the raw path as an error instead of opening the folder. The command is registered and now permitted, and when nothing can be revealed it names the offending path instead of a bare "does not exist".
- **Clicking "Open plugin folder" could be repeated while it was still working.** Creating the plugin directory on first launch takes a moment; the button now greys out (with a spinner) until the folder is actually opened, and the per-row and toolbar triggers share one in-flight state so a second click cannot queue another reveal.
- **Editing a release body on GitHub does not update `latest.json`**, so the in-app release notes stayed on the workflow's placeholder text. Documented how to tell the two apart and how to sync only the `notes` field without touching the signatures.

### Docs

- Design documents `022` (data-location section) and `023` added.
- `docs/AI/INDEX.md` updated for the new modules, commands, plugin service layer and data paths.
