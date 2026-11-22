# Changelog

## [0.8.4] - 2026-11-22

3 commits since v0.8.3.

### Added

- **A command field in the menu bar** (design `073`). The middle of the title bar — roughly 500px that until now was an empty drag strip — holds a real input with a `›` prompt. Clicking or pressing `Ctrl F` opens an anchored 620px panel below it instead of the old centred modal with a 30% scrim, so the canvas is no longer dimmed and the field you type in stays visible while you choose. With an empty query the panel is the catalog: 61 operations in 14 groups with the `01`–`14` numbering inherited from `072`, sticky group headers carrying a count, and 34px single-line rows (monospace name, description, keycap) followed by current pipeline steps, files, tabs and templates. Typing switches to one scored list — name, Chinese description, category and pinyin initials all match — with a source label on each row; steps are part of the same search, so jumping to a node no longer needs a second box. `↑`/`↓` cycles across groups, `↵` opens, `Esc` clears the query first and closes on the second press, and clicking outside closes while leaving the caret in the field. Below 960px the field folds into a 28px icon beside Execute and the panel grows its own query row.
- **Every command now has its help one key away** (design `074`). The command form's title bar carries a **Docs** button that opens the same help page the Help menu does, and the command panel opens it with `Shift+Enter` — the footer spells out `⇧↵ 文档` and dims it when the highlighted row has no documentation. The Help menu and Help dialog are unchanged.

### Changed

- **The docked command catalog is gone** (design `074`). Once the menu bar had a field, the 260px column on the left edge was a second answer to the same question: the same 61 commands, a second search box, a second row grammar, and the tool rail sliding 268px out of its way every time it opened. The column, the `⌘` icon that toggled it and the `commandPanelInset` shift are removed; the canvas keeps those 260px, the tool rail sits at `x=12` again, and the onboarding guide and its "add a step" button now open the menu-bar field (which is outlined during onboarding). An empty pipeline no longer opens anything by itself, and the panel's first-step hint bar is gone rather than moved. Designs `072` and `055` otherwise stand — their category order, numbering and row-end entries live on in the input panel.
- **`Ctrl F` is the only command-search shortcut.** `Ctrl K` and `Alt C` are removed with no aliases; the keyboard-shortcuts list in Help, the onboarding keycaps, the empty state and the field's own keycap all read `Ctrl F` now.
- **The command-search entry points collapsed from three to one.** The View menu no longer lists "Command panel" or "Search", the centred `Ctrl K` palette and the canvas `SearchOverlay` are deleted, and their step-jump logic moved into the shared panel. What remains is the field, the Help route and the command forms.

### Removed

- The docked command panel (`CommandList`, `CommandRow`, `commandSearch`), the `⌘` menu-bar icon, the `SearchOverlay` / `useCanvasSearch` pair, the `Ctrl K` and `Alt C` shortcuts, and the panel's first-step hint bar.

### Docs

- Designs `073` (menu-bar command input) and `074` (retiring the docked panel) added with prototypes and implementation notes; `073` records the `Ctrl F` consolidation and the two accepted deviations, `074` records the decisions taken on 2026-11-22.
- `docs/AI/INDEX.md` updated for the new `CommandBar`, the step source and the removed modules.
