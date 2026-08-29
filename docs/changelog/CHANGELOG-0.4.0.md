# Changelog

## [0.4.0] - 2026-08-29

39 commits since v0.3.0.

### Added

- **Global command palette**: `Ctrl/Cmd+K` modal with a searchable, keyboard-navigable list of actions, tabs, recent files, and xan commands; separate keyboard/mouse navigation modes so hovering never hijacks the selection.
- **Pinyin CLI plugin and desktop plugin system**: backend dispatch, settings UI, and help docs; xan is now registered as a plugin alongside pinyin.
- **CSV diff dialog**: `Ctrl+D` compares two CSV files with an aligned row-by-row view (headers, added/removed/modified rows, identical summary) and pagination for large diffs; diff engine rewritten with the `similar` crate's Myers diff over interned row ids and `spawn_blocking` execution.
- **CSV encoding conversion**: streaming `convert_csv_encoding` Tauri command (64KB chunks, constant memory) between common encodings (auto/BOM, UTF-8, GBK/GB2312, GB18030, UTF-16 LE/BE, Latin-1); exposed via a redesigned `CsvEncodingDialog` and a new "CSV Encoding" File menu entry.
- **Pipeline export as standalone scripts**: save pipeline as PowerShell (`.ps1`) or Shell (`.sh`) xan CLI scripts instead of the old `.xanscript` format.
- **Tab session persistence**: SQLite `session.db` restores tabs + selected tab on startup with debounced autosave and `beforeunload` fallback.
- **Cancel running pipeline execution**: `set_pipeline_cancelled` Tauri command, cancellable polling wait helper, "Cancel Execution" button, and subprocess cleanup on cancel.
- **Pipeline step errors on nodes**: execution errors are now displayed directly on their step nodes.
- **Custom AI provider support**: configurable provider name, base URL, and model list with a schema migration; unified OpenAI-compatible `call_ai` flow.
- **Canvas pipeline status indicator**: bottom-left status bar showing step count, dirty/saved state, and relative last-saved time (auto-updates every 30s).
- **"Clear all version history" button** in VersionControlPanel with a confirmation dialog.
- **Pipeline version history enhancements**: diff view (vs. parent or workspace), search filter, per-version change summary badges, inline message editing, restore confirmation preview, list/timeline toggle, and version cap with pruning (50).
- **Top/bottom connection points** on pipeline nodes (`resolveHandles` picks direction by node-center comparison); edges can now connect vertically.
- **Live bezier right-click connection preview** following the cursor in real time with gradient stroke and arrow marker.
- **Canvas box-select and UX polish**: left-drag box selection (Shift additive), Space/middle-button pan, double-click-to-fit setting, grid fade, and search/empty-guide enhancements.
- **CommandList and LogPanel UX**: keyboard navigation (arrows/Enter/Esc), search merged into the title bar, per-type log filtering chips with count badges, auto-scroll with jump button, and clipboard copy fallback.

### Changed

- **Plugin system**: xan registered as a plugin and plugin resources moved into `resources/plugins/` (extracted at runtime); removed the "Check Plugins" button from settings.
- **Settings UI**: consolidated "General" and "Preference" tabs into a single "General" tab; removed the "Add Plugin" UI and backend `add_plugin` command; transparent progress bar capped at 40% of screen width.
- **Data directories**: all persistent data (`config.db`, `session.db`, `ai_memory.db`, `plugins.db`, `recent-files.json`, `profiles.json`) moved under the `resources/data/` subdirectory.
- **Toast notifications** moved to top-center; dropped unused UI state.
- **DataProfilePanel** reworked as a right sidebar with a pinned search box.
- **Encoding detection**: automatic encoding detection removed; users select encoding explicitly (CSV encoding dialog allows "auto").
- **i18n**: deduplicated and simplified translation keys.

### Fixed

- CSV delimiter reload logic when switching delimiter; removed redundant node error `title` attribute.
- UI stutter when switching language/theme.
- Cut-knife deletions resurrecting cut edges/nodes.
- Console window flash on plugin check (Windows `CREATE_NO_WINDOW`).
- List-item trailing elements hidden behind long text.
- `TableNode` dragging restricted to the title bar.
- `fontsource` fonts bundled correctly in the production build.
- Help search highlighting the current match and suppressing the native find bar on `Ctrl+F`.
- Version comparison done numerically when checking for updates.
- Right-click connection preview anchored on real rendered node rects (fixes vertical-center offset on variable-height cards and edge hit-testing).

### Removed

- Automatic encoding detection (superseded by explicit selection).
- Per-step execution status badges on nodes (backend cannot separate step results).
- `Ctrl+D` CSV-diff canvas shortcut (replaced by the dedicated CSV diff dialog).

### Docs

- Help content rewritten to cover mouse operations.
- `INDEX.md`, `AI-INDEX.md`, and `README` updated.
- Design docs added for top/bottom connections and the right-click bezier preview.
