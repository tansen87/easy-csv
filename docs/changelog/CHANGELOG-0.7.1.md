# Changelog

## [0.7.1] - 2026-10-20

5 commits since v0.7.0.

### Changed

- **Settings rebuilt around a directory, a search box and one row per setting**: the single scrolling column of control blocks is gone. The dialog now has a left column with the search box pinned at its top and a directory of six groups (appearance, data & help, window, updates, AI, plugins) highlighting the group you are in, and a right column where each group is a rounded card and **every setting is one row** — title on the left, an optional one-line description, the control right-aligned, about 36px tall. This is the macOS System Settings shape: you find a setting instead of scrolling to it. Search matches titles, descriptions and a hand-written alias table (`dark`, `theme`, …), and it can also hit a group name — so the plugins group, which has no rows of its own, is findable; terms are ANDed, groups with no hit are greyed out in the directory but stay where they are instead of being reordered, matches are highlighted inline, and **no count appears anywhere in the UI** (the result count is announced to screen readers only). `/` focuses the search box, `Esc` clears the query before it closes the dialog, and "restore defaults / save settings" now float at the bottom center instead of owning a footer strip. Three long-standing misfilings were corrected on the way: **Clear execution history** moved out of the AI tab into **Data & Help**; the **custom AI provider** row is always present and merely disabled with an explanation when it does not apply, rather than appearing and vanishing; and the AI tab's four-button cluster became four separate rows so each one can be found by search. Design `030_settings-navigation`.

- **Plugin management folded into the settings rows**: the plugins group no longer embeds the old list panel. Its heading row carries the summary (installed count, **open plugin folder**, **fetch latest version**), and each plugin is one row showing its name, a one-line status (required · installed / not installed · update available · version · size) and its actions (project page, open folder, uninstall, download/update — switching to cancel with a percentage while a download runs), with the download-acceleration prefix as one more row. The old `PluginManager` / `PluginRow` list UI was deleted.

- **Built-in templates no longer appear in the template library**: the library lists only the templates you saved. The demo pipeline is kept for the two places that need it — the empty-state "try the example" card and Help → View Example — so onboarding is unaffected. The dialog is wider, long text truncates with an ellipsis instead of pushing the buttons out of the dialog, and a flaky plugin test that clicked a button while it was still disabled now waits for it to become enabled.

- **README**: added a table of contents and a **Download and install** table naming the asset and the exact procedure per platform (Windows per-user install into `%LOCALAPPDATA%\EasyCsv` with no UAC prompt, plus the SmartScreen note; macOS dragging into `~/Applications`; the AppImage; and the `.deb`, which cannot self-update), with notes on the one-click `xan` install at first launch, on which installs support in-app updates, and on which release assets are updater metadata you never download by hand. A Simplified Chinese README (`README_ZH.md`) was added and linked from the English one.

### Fixed

- **Data Profile used the wrong delimiter**: the panel was handed the global default delimiter rather than the current tab's resolved one, so right after opening a file whose delimiter had been auto-detected its statistics disagreed with the preview table, and you had to switch the delimiter by hand to make them match. It now reads the tab's resolved delimiter — the same value the preview table and pipeline execution use — so the detected delimiter applies immediately.

- **The running indicator froze when Windows animations are turned off**: the 2px indeterminate bar under the Execute button (and the same bar on Help while an update check is in flight) was switched off by the `prefers-reduced-motion` rule, so on a machine with "show animations" disabled a running pipeline looked idle. The bar now animates regardless of that setting.

- **Redundant panel title icons removed**: the Data Profile, data lineage and version control panels each drew a decorative icon next to a title that already says what it is. Only the shared group-header icon remains.

### Docs

- Design document `030_settings-navigation` added (with its two prototypes), and `docs/AI/INDEX.md` refreshed for the new settings structure, the per-plugin row component and the removed list UI.
