# Changelog

## [0.7.2] - 2026-10-21

1 commit since v0.7.1.

### Added

- **Guided right-click quick actions**: right-clicking the input table now opens a compact floating dialog anchored at the cursor, restoring the v0.5.0 interaction for filtering (text/number), sorting, replacing, pivoting, date formatting, text/number transforms, slicing, padding, window aggregation and batch filtering. Each dialog shows only the friendly fields — column, operator, values, formats, replace pairs — instead of raw xan parameters, and Apply builds the step with a readable alias (Sort, Replace, Date Transform, …). An **Advanced** link hands the values entered so far to the full parameter dialog, so low-level flags such as `parallel` and `threads` stay reachable. Design `031_quick-action-dialogs`.

### Changed

- **Quick dialogs scroll with the shared `ScrollArea`**: the shell caps the Radix viewport height directly, so tall forms scroll inside the dialog instead of pushing the footer away. The filter dialog has a taller middle area, its value tags wrap instead of breaking the layout, and the pivot "columns" and "row groups" lists use `ScrollArea` too.

- **One parameter builder**: `command/lib/initialParams.ts` and its 28 tests were removed; `quick/lib/buildQuickCommand.ts` is now the single translation from guided fields to xan arguments and aliases.

### Fixed

- **Filter dialog overflow**: long or numerous values no longer hide the "ignore case" option — the middle area scrolls and the checkbox remains reachable.

### Docs

- Design document `031_quick-action-dialogs` added, and `docs/AI/INDEX.md` updated for the quick-action module, its tests and the right-click chain.
