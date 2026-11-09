# Changelog

## [0.8.1] - 2026-11-09

7 commits since v0.8.0.

### Added

- **Confirmation dialog rebuilt** (design `050`). The generic yes/no box is now a 400px card that separates the question from its subject: a title, one short line saying what will happen, and — under a hairline in monospace — the thing it will happen to (the template name, the output path, the saved version's label). The footer is a fixed 56px bar with `Cancel` in ghost and the action as the primary button, and irreversible actions take a red **danger** tone instead of the ink button. Deleting a template, deleting a saved version and clearing all versions now name their target and read as destructive; the overwrite-output prompt prints the file it will overwrite, and the reload prompt names its own action instead of a generic "Confirm". The header's close button is gone (Cancel and `Esc` both do that job), the card fades in with a 4px rise over 160ms, and the dialog is properly labelled with `aria-labelledby` / `aria-describedby` so a screen reader reads the title and body in order. `Enter` no longer fires the action twice when a button already has focus.

### Changed

- **`--border-soft` is now a real token**: a hairline *inside* a surface — section rules in help pages, list rules in panels — softer than `--border` so a card does not read as a set of boxes. It is defined for both themes (8% ink on light, 9% paper on dark) and mapped to `border-border-soft`. `.help-content` had been referencing the variable before it existed, which silently dropped those rules to `currentColor`.
- **The selected tab's badge no longer loses its background**: `.tab-selected .tab-badge` was painted with `--bg`, a variable that was never defined, so the badge fell back to transparent. It now uses `--background`.

### Fixed

- **Batch Filter reads actual column values when the value source is "from column"**. `xan frequency` writes a three-column `field,value,count` table using the delimiter it read the input with, and only the 10 most frequent values unless asked for more; the old code split each line on a tab, took the first cell and dropped a `value` header, so every extracted "value" was really the whole record (`品类,服饰,3`) and matched nothing when reused as a filter pattern. The call now passes `--all` and `--no-extra` (dropping the `<empty>` / `<rest>` sentinels, which are not searchable values), and new tested helpers in `utils/batchFilterValues` sniff the delimiter from the header record and split quote-aware, so a value containing the delimiter, quotes or an embedded newline survives byte for byte. Values are never trimmed, because they have to match the column exactly.
- **Batch Filter's column mode works on tabular input too**: the pre-batch data is now spilled once to a per-run temp file (`.batch_tmp_<runId>.csv`) that both value extraction and every per-value filter pass read, replacing both the old hand-rolled `split(",")` (which ignored quoting) and the repeated temp write per value. The file name carries the run id, so two tabs batching at once cannot overwrite each other, and cleanup is best-effort on every exit path so a leftover temp file cannot fail a run.
- **A cleared extract column falls back to the filter column**, since filtering a column by its own distinct values is the only sensible reading of an empty choice.

### Build

- **Bundler downloads are pre-seeded in CI.** During the v0.8.0 build, GitHub's `releases/download` endpoint returned 504 for the AppImage tools (`AppRun`, `linuxdeploy`) on Linux and for `nsis-3.11.zip` on Windows, and the bundler only tries once. Both workflows now fetch those files through the API asset endpoint and place them where Tauri looks (`~/.cache/tauri` and `%LOCALAPPDATA%\tauri\NSIS`), so the bundler skips its own download.

### Docs

- `docs/design/prototypes/050/01-confirm-dialog.html` added as the reference for the dialog, and `docs/AI/INDEX.md` refreshed for the new `utils/batchFilterValues` module and its tests.
