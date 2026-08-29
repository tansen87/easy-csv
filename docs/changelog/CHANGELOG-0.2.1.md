# Changelog

## [0.2.1] - 2026-07-12

32 commits since v0.2.0.

### Added

- **System tray**: minimize-to-tray with show/quit menu; closing the window now hides it instead of exiting.
- **Data profile panel**: xan-based stats, field search, and LRU profile caching.
- **Drag-and-drop**: open CSV/pipeline files by dropping them onto the window.
- **Expression editor**: new `ExpressionEditor` with a synchronized highlight layer, 200+ xan function definitions (parameter signatures), autocomplete (function/keyword/column/operator), and a parameter hint bar; integrated into the `map` command.
- **Batch Filter pipeline step**: text operators (`not_starts_with`, `not_ends_with`, `not_contains`, `is_null`, `is_not_null`), separate-file output, custom output path, and editing UI in `CommandDialog`; integrated as a pipeline step that runs after preceding steps.
- **Batch file format conversion**: `batch-from` and `batch-to` commands for batch file-format conversion.
- **Blank command** added to the command palette.
- **Duplicate column check and statistics**.
- **Configurable history limit** setting.
- **Execution notification toggle** in preference settings.
- **Localized parameter descriptions** in `CommandDialog` forms.
- **SearchableSelect**: keyboard navigation (ArrowUp/Down, Enter, Esc) with full ARIA attributes (combobox/listbox/option).
- **UI polish**: backdrop blur on the settings dialog and `Esc` to close `CommandDialog`; refined command parameter descriptions.

### Changed

- **Backend modularization**: split `lib.rs` into `config.rs`, `xan.rs`, `pipeline.rs`, `csv.rs`, and `storage.rs` (plus `main.rs` entry point).
- **Frontend modularization**: extracted the 57 command forms out of `CommandDialog.tsx` into modular components; separated `FlowPanel` components.
- **Batch Filter refactor**: logic extracted into its own module; merged output mode and the Prefix+Number naming strategy removed (only Name+Value kept).
- **`cat` command**: multiple-file input support; batch-filter/batch-from/batch-to dialogs reworked.
- **Command docs**: updated for `cat`, `count`, `from`, `sample`, `separate`, `sort`, `top`.
- **Settings**: enhanced settings dialog and theme selector.
- **Draggable dialogs**: restricted drag boundaries; shared `useDraggable` hook extracted from 10 floating dialogs.
- **History**: `history.json` simplified by removing redundant fields.
- **Initial position** of input data adjusted.

### Fixed

- Tauri file-write permissions (`fs:allow-remove`, `fs:scope`) for Batch Filter.
- Temp-file cleanup logic in Batch Filter.
- Operator display bug when switching filter types.
- Event-listener leak: 6 dialogs (`Filter`/`Sort`/`Replace`/`Pivot`/`TextTransform`/`NumberTransform`) no longer register `mousemove`/`mouseup` on `document` unconditionally.
- `cat` multiple-file input handling.

### Removed

- Pipeline step copy/paste (right-click menu + `Ctrl+V`) in `FlowPanel`.
- `SplashScreen`.
- Redundant history fields and the merged output mode / Prefix+Number naming in Batch Filter.

### Docs

- Added English and Chinese documentation for `output`, `batch-filter`, `batch-from`, `batch-to`.
- Added project index documents and moonblade/expression-editor docs.
- Updated `INDEX.md` for the `CommandDialog` refactor, AI module, and UI/UX scenarios.
