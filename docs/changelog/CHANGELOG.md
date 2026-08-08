# Changelog

## [0.3.0] - 2026-08-08

44 commits since v0.2.1.

### Added

- **AI assistant**: natural-language requests are converted into xan command pipelines with a RAG-based system prompt that injects only the command docs relevant to the current query.
  - New `call_ai` Tauri command (DeepSeek / GLM / Qwen), persisted AI provider/model/API key config.
  - AI panel with chat UI, history, and one-click insertion of generated commands into the pipeline.
  - Numbered multi-step AI responses (parsed both inside and outside code blocks), batch-adding multiple commands in a single update.
  - Thumbs up/down feedback with toggle support, intent clarification dialog for ambiguous queries, conversation history context for multi-turn responses.
  - SQLite-based AI memory persistence (conversations, feedback, correction rules); learning-data management in settings.
  - RAG upgrade: synonym expansion, fuzzy matching, correction rule weighting.
  - GLM provider added; token usage tracking (prompt/completion/total) for all providers.
  - Multi-line numbered JSON parser for AI command responses.
- **Chart command**: `chart` with line, scatter, bar, histogram, pie, wordcloud and heatmap chart types.
  - Multiple series display via `category` parameter with custom legend toggle (hidden series shown in gray).
  - Dynamic form fields based on the selected chart type.
  - SVG export, dark mode, hover tooltips, and click-to-toggle for heatmap cells.
  - Chart command documentation (EN + ZH) added.
- **Encrypted per-provider API key storage**: config migrated from JSON to SQLite (`config.db`); AES-256-GCM encryption with machine-derived key; new Tauri commands `save_api_key` / `load_api_key` / `delete_api_key` / `has_api_key`.
- **Data lineage visualization overhaul**: manual positioning for precise column layout, fullscreen mode (Esc to exit), MiniMap/Controls/Background, Graph/Timeline view toggle, column-level source tracking, auto-track on every execution.
- **Pipeline version control, conditional branches, and data lineage**.
- **LogPanel**: maximize/restore toggle and tooltips on action buttons.
- **ContextMenu**: `Neg` action.
- **Frontend unit tests**: vitest infrastructure with 155 tests covering command parameters, Tauri invoke call patterns, batch filter and batch convert logic.
- **New app icon**.

### Changed

- **App architecture**: split `App.tsx` (1133 lines) into 6 focused hooks (`useTabs`, `usePipelineState`, `useAppSettings`, `useToast`, `useLogs`, `useUIState`); global keyboard shortcuts moved to App level.
- **Performance**: removed duplicate `getLayoutedElements` call, shallow-equality pipeline comparison, 150ms-debounced CommandList search, `React.memo` on 5 heavy components, `Map`-based O(1) command lookup.
- **AI prompt rules**: use `search` for equality filters, `to` for non-CSV exports, `cat` with `mode=rows + union + glob` for directory merges; deduplicated rules; enforced `as` clause for new columns in `map`/`groupby`/`agg`.
- **AI panel input**: auto-resizing textarea (1–4 lines), send shortcut changed from Enter to Ctrl+Enter, send button moved inside textarea.
- **Version history**: auto-save version on pipeline execution; `loadVersions(tabId)` called on init and tab switch to fix persistence on refresh; removed the separate "history" tab.
- **Panels**: LogPanel moved to bottom-right with per-message delete; panel widths made responsive with `min()` CSS; conditional branches removed.
- **Docs**: markdown docs moved from `public/` to `src/docs/` for Vite compatibility and inlined at build time (eliminates fetch).
- **Dependencies**: `@tauri-apps/api` upgraded to 2.11.1; `recharts@^2.15.3` added.

### Fixed

- Table-node scrollbar drag/wheel inside React Flow canvas.
- Version history not loading after refresh.
- `get_db()` panics replaced with proper error propagation (no more crashes when DB is unavailable).
- Search/filter pattern escaping when pattern starts with `-` (xan flag parsing).
- Input typing bug and ScrollArea height in `SearchFilterForms`.
- HelpDialog search input losing focus on keystroke.
- Context menu enabled on panels.
- VersionControlPanel cross-contamination of shared newTag state; delete confirmation added.
- Keyboard shortcut behavior; empty-state and recent-files cleanup.
- Dialog accessibility: `role="dialog"`, focus trap, backdrop click-to-close, Escape handling on all 5 dialogs.
- No-drag class consolidation on draggable dialogs.
- Manual command additions no longer auto-create edges (only AI-inserted commands do).

### Removed

- HuggingFace provider support.
- `PersistentNotification` panel and simplified notification system.
- Redundant undo/redo logic (consolidated into `usePipelineState`).
- Dead code: `save_history`/`load_history`, `history_limit`, `HistoricalPipeline` interface and related state.

### Docs

- README overhaul: features, testing, keyboard shortcuts, AI providers/models, docs locations, and xan.exe embedding note.
- Refresh help docs and light/dark screenshots.
- AI docs index and merged USAGE.md combining the 58 per-command docs.
