# Changelog

## [0.6.0] - 2026-09-26

32 commits since v0.5.0.

### Added

- **In-app updates**: the app now downloads and installs new GitHub releases itself instead of only opening the release page. Updates are signed and signature-checked, and a silent check runs a few seconds after launch (toggle under Settings → Updates), flagging new versions in the toolbar without ever installing on its own. Manual download stays available as a fallback. Design `022_github-auto-update-and-admin-free-install`.
- **DuckDB as an optional CLI plugin**: SQL editor with streaming pipeline support, `-bail` and the configured delimiter forwarded as `-separator`, and the final stdout writable to a file via `output`. DuckDB is not bundled — users point the plugin at their own binary.
- **Split a CSV into good/bad rows**: a separate dialog that re-serializes through a `flexible(true)` reader/writer so bad rows are merged forward instead of dropped, with a streaming (constant-memory) mode for files that do not fit in memory. Designs `016_separate-good-bad-rows`, `017_separate-dialog-ux`.
- **Delimiter detection when opening a file**: the reader samples the first 64 KiB, scores the candidates (weighting the header row) and reports the resolved delimiter along with its source and confidence. The tab remembers it, the input node displays it, and execution reuses it, so the preview and the run agree. A global toggle plus one shared `DelimiterModeSelect` control appear in both settings and on the input node badge. Design `018_open-file-delimiter-detection`.
- **Split a text file into N-line parts**: byte-exact splitting that does not parse CSV — constant memory, usable on very large or half-broken files, keeps the input extension, and offers a `no_headers` option. Design `021_split-lines-by-line-count`.
- **Encoding conversion remembers its last run**: output path, byte counts, completion time and the source/target encodings are restored on reopen, with "open output location" and "clear record"; the button greys out once the output file is gone. Design `020_encoding-conversion-history`.
- **Canvas keyboard panning** (WASD / arrow keys, Shift to move faster) and a **pressed-keys HUD** showing keys and mouse buttons above the status indicator. Designs `013_canvas-keyboard-pan`, `014_canvas-key-indicator`.
- **Follow-system language option** alongside English and Chinese, with dialog labels localized. Design `015_follow-system-language`.
- **"Open output location"** (`reveal_paths`) in the separate and split dialogs.
- **Tooling**: ESLint flat config with cycle and cross-module import rules, plus `typecheck` / `lint` / `check:index` scripts and matching CI gates; a `pnpm tauri:build` wrapper that supplies the updater signing key so local builds do not fail on it.

### Changed

- **Windows user data moved out of the install folder**: it now lives in `%LOCALAPPDATA%\EasyCsv` instead of `<exe dir>\EasyCsv_resources`. A one-time migration copies `data/` and `plugins/` — including the user-provided `xan` / `pinyin` binaries — and keeps the old directory in place. macOS and Linux paths are unchanged. This is what allows the app to run from a read-only or per-user install location.
- **Windows installer is NSIS only, per user**: `bundle.targets` narrowed from `all` to `nsis` with `installMode: currentUser`, so installing and updating no longer prompt for administrator rights. The MSI target is gone.
- **Frontend restructured** (design `019_frontend-structure-refactor`): business code lives under `src/modules/<domain>/`, one file per command form, command and i18n tables split by domain, shared types in `src/types/`, hooks renamed to `use*`, and `ui/` components in PascalCase.
- **Log and command panels** no longer have a collapsed capsule state.
- **Command palette** template entries use a group icon instead of per-item icons.
- **Shared `Select`** replaces `SearchableSelect`.
- **Editor focus ring, scrollbar and dark-mode input styling** polished.
- **`duckdb` parameters**: `noheader` dropped; `-bail` and `-separator` added.

### Fixed

- **Component filename casing**: six `components/ui` files were tracked in lowercase while every import used PascalCase. Invisible on Windows, but `tsc` failed with TS1261 and case-sensitive platforms could not resolve them at all.
- **13 pre-existing ESLint errors** that had been failing the lint gate: empty catch blocks, seven ineffective escapes inside the AI prompt template (output unchanged), a lucide `Infinity` icon shadowing the global, and two deliberate control-character regexes now explicitly disabled with a stated reason.
- **CI: pnpm is pinned.** `build.yml` asked for `latest`, which had moved to 12.x and rejects the `lockfileVersion: 9.0` lockfile under `--frozen-lockfile`, failing every platform at the install step.
- **CI: the build gate no longer requires a signing key** — updater artifacts are disabled for that workflow, since it is a gate rather than a release.
- **Release: the signing secret is validated before the build**, so a malformed secret fails within seconds with an actionable message instead of a cryptic decode error after roughly twenty minutes.
- **`check:index`** — `docs/AI/INDEX.md` referenced a design document by an abbreviated path.
- **Result-table node stays selectable**, so it elevates when selected.

### Removed

- The MSI installer target on Windows.
- `SearchableSelect`.
- The collapsed capsule state for the log and command panels.
- The `noheader` parameter of the `duckdb` command.

### Docs

- Design documents `013`–`022` added.
- `docs/AI/INDEX.md` updated for the new modules, commands and data paths.
