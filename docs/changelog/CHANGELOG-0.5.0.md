# Changelog

## [0.5.0] - 2026-09-08

23 commits since v0.4.0.

### Added

- **Linux / macOS cross-platform support**: the app now builds and runs on Windows, macOS, and Linux. Resource/data directories follow each platform's standard location (see "Changed"), per-platform packaging config (`tauri.linux.conf.json` / `tauri.macos.conf.json`), and a three-platform CI matrix. Design `012_cross-platform-linux-macos`.
- **Execution history**: SQLite-backed records of pipeline runs with a viewer dialog (tab, status, duration, row count, output summary); history persists across restarts and can be cleared from settings.
- **Dockable side panels**: panels with collapsed capsules and persisted dock state.
- **Reusable pipeline templates**: save and re-apply pipeline templates.
- **Pipeline variables**: `{{name}}` placeholder support mapped to positional script arguments.
- **Execution result preview as canvas table node**: pipeline output rendered inline on the canvas.
- **Multi-value pattern filtering**: search/filter supports multiple patterns via repeated `-P` flags.
- **Streaming AI responses** via SSE with a non-stream fallback.
- **Canvas right-click context menu**: paste and "save intermediate as input".
- **Multi-branch execution hardening**: cycle detection, overwrite confirmation, and cancellable batch loops.
- **Command palette cleanup**: group-header icons only (no per-item icons) plus English search aliases.
- **Right-click Mode toggle redesigned** as a hover-expanding dot.

### Changed

- **App renamed to "EasyCsv"**: package/product name updated; the built executable and installers are now named `EasyCsv` (binary named explicitly via Cargo, `productName` = `EasyCsv`, `mainBinaryName` pinned).
- **Plugins are user-managed**: `xan`/`pinyin` are no longer bundled or auto-extracted. Users drop the binaries into the platform plugin directory (`<resources>/plugins/<target>/`, or `PATH`); resolution falls back to `PATH`.
- **Cross-platform data/plugin directories**: Windows keeps `<exe>/easy-csv_resources`; macOS uses `~/Library/Application Support/EasyCsv`; Linux uses `~/.local/share/easy-csv`; all DB data stays under `.../data/`.
- **Script export defaults** to `.sh` on macOS/Linux and `.ps1` on Windows; the save dialog filter order follows the default.
- **Shortcut display** renders ⌘ on macOS vs Ctrl elsewhere (binding already accepted both).
- **Top bar regrouped**: right-side icons organized into zones with panels/help menus.

### Fixed

- Cross-platform compile of `tauri-plugin-prevent-default` (`PlatformOptions`/`.platform()` are Windows-only; now cfg-gated for macOS/Linux).
- CI backend tests no longer fail on a missing `../dist` (frontend is built before `cargo test`).
- Floating dialogs now drag only via their header bar.
- AI no longer emits redundant aggregation prompts; repairs treated as aliases.
- Crate references migrated from `easycsv` to `easy_csv` naming.

### Removed

- Bundled `xan`/`pinyin` plugin binaries (now user-provided).
- `Alt+D` keyboard shortcuts.
- Command palette per-item icons.

### Docs

- Design docs added (including `012_cross-platform-linux-macos`).
- `INDEX.md` updated for the cross-platform data/plugin paths.