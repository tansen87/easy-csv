# Changelog

## [0.2.0] - 2026-07-06

181 commits since v0.1.0.

### Added

- **Internationalization**: Chinese/English language switch with Chinese documentation.
- **Recent files** list and quick access.
- **Command search**: searchable command palette and a search box for input data.
- **Coordinate grid** on the canvas and cut-by-angle animation.
- **Multi-node deletion** and multiple nodes selectable for deletion.
- **Help system**: in-app help documents rendered on the frontend (backend help removed).
- **Version update check** with a notification when a new release is available.
- **Screen loading animation**; `xan` is now packaged into the binary (no external path needed).
- **Replace dialog**: multiple value replacements in a single operation.
- **Save / run pipeline**: persist and execute the current pipeline; "run command" shortcut.
- **New xan commands**: `plot`, `scrape`, `bisect`, `input`, `implode`.
- **Undo/redo** support.
- **Bidirectional left/right and multi-branch connections** on the canvas (built on React Flow).
- **Duplicate-column markers** and a `view` command `all`/`select` parameter.
- **Log improvements**: copy the current log block to the log; output notification panel.
- **Right-click shortcuts**: `pad`, `strip`, window aggregation, `replace`, deduplication, reverse, and transpose.
- **Result table / logs toggle** to separate pipeline output from logs.
- **`no-headers` parameter** and `left`/`right`/`slice`, `split`, and `date` transform operations.
- **Spreadsheet view**: pivot, groupby, agg, search, filter, rename, and sort on the table; copyable table data; draggable/fixed header width.
- **Import / export pipeline** (records command positions and connections).
- **Multiple tabs** with per-tab history and independent input data.
- **MainMenu** separated from `App`, with shortcut-key operations and update/help/settings buttons.
- **Header interactions**: search, delete, and double-click rename.
- **Toast prompts** in the bottom-right corner.

### Changed

- **Canvas moved to React Flow**: `screenToFlowPosition`, default connections, and per-tab input data.
- **Command dialogs modularized**: `SortDialog`, `NumberTransform`, `TextTransform` split into individual components; `OperationDialog` removed.
- **Unified UI components**: `SearchableSelect`, select dropdowns, and floating/draggable dialogs.
- **Parameter handling**: uppercase → lowercase parameter names; `XanParameter` changed from flag to boolean; missing parameters added for `cat`, `count`, `search`, `to`, `plot`, etc.
- **Auto-reload** current tab data when the delimiter changes.
- **Retired commands consolidated**: `fuzzy-join` → `join`, `flatmap` → `explode -e`, `grep` → `search --fast-parser`.
- **Custom theme** support, font additions, and visual optimization of the pipeline area.
- **Transparent menu/tab backgrounds**; removed the xan version check.
- **Settings & multi-tab layout** reworked; removed the automatic xan-path search (path is now cached/packaged).
- Unified output as a single command; removed animation effects on theme switching and large gradient backgrounds.

### Fixed

- Removed the request timeout and fixed output-null errors.
- Delimiters now auto-update in tables when importing workflows externally.
- Unnecessary parameters no longer included when saving a pipeline.
- Error propagation through the pipeline; intermediate nodes now report errors after adding an output parameter.
- New node added after deletion now executes on all branches.
- Loading history into a new tab no longer fails to import data; edges are filtered correctly when deleting a step.
- Non-CSV files no longer jump to the flow panel; connection highlighting and history recording fixed.
- Pipeline now executes when connecting to output; fixed the bug where only CSV files could be processed.
- SplitDialog dropdown fixed-position bug; xan-path selection no longer hangs.
- Log is cleared correctly; pipeline buffer deadlock fixed.
- Menu no longer exceeds the screen bounds.

### Removed

- MiniMap from the canvas.
- `no-quoting` parameter.
- `OperationDialog` and the right-click Operation shortcut.
- `XAN_PATH_CACHE` global path cache and automatic xan-path search.
- Loading-from-history into the current tab.
- Table cell editing in the spreadsheet.
- Standalone result-table display and the copy operation.
- Unused quick actions, redundant code, and the legacy pipeline interface.
- `LogPanel` toast (replaced by copy-icon success message and floating prompts).

### Docs

- Added Chinese documentation and in-app help documents.
- Updated `README` and added screenshots.
- Added the MIT license.
