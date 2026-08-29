# Changelog

## [0.1.0] - 2026-04-05

Initial release (22 commits).

### Added

- **CSV workspace**: open and manage CSV files in a workspace backed by the `xan` CLI.
- **Command execution**: run `xan` commands against the active dataset, including pipelines of multiple commands executed in sequence.
- **Format (`fmt`) command**: configurable output delimiter and parameter support.
- **Search/filter command**: parameter support for filtering rows.
- **Sort command**: additional parameter support.
- **Global search path for `xan`**: commands resolve `xan` from a global location.
- **No-quoting parameter**: option to disable quoting in output.
- **Theme switching**: light/dark theme change support.
- **Help display**: in-app help for commands.
- **CLI window handling**: hide the underlying CLI window during execution for a cleaner UI.

### Changed

- Renamed the project to **easy-csv**.
- Refined log styling and removed noisy log output.
- Updated the application icon.
- Bumped `vite`, `typescript`, and `react` dependencies.

### Fixed

- Output-delimiter handling in the `fmt` command.
- Execution of multiple commands in a single pipeline.
