# Easy Csv

Handle CSV data in a modular way — chain [xan](https://github.com/medialab/xan) commands together like building blocks in a visual pipeline, without leaving your desktop.

Built with [Tauri](https://tauri.app/) v2 + React 19 + React Flow, and powered by [xan](https://github.com/medialab/xan) as the underlying CSV toolkit.

## Screenshots

![light](/docs/img/light.jpg)

![dark](/docs/img/dark.jpg)

## Features

- **Visual pipeline editor** — drag, connect and configure xan commands on a node canvas (dagre auto-layout, cut/fall animations, undo/redo, copy/paste)
- **61 built-in xan commands** — from basic `sort` / `filter` / `select` to `pivot`, `window`, `join`, `stats`, `split`, `partition`, `to` / `from` conversion and more, each with a dedicated configuration dialog
- **AI assistant** — describe what you want in natural language (Chinese/English), and the assistant generates ready-to-insert pipeline steps via DeepSeek / Qwen, with RAG over per-command docs
- **Expression editor** — syntax highlighting and autocomplete for 200+ [Moonblade](https://github.com/medialab/xan) functions
- **Batch operations** — batch filter (split one CSV into many files by column value) and batch format conversion (CSV ↔ XLSX ↔ JSON)
- **Data profiling** — one-click column statistics (count, nulls, min/max/mean, etc.) via `xan stats`
- **Built-in templates** — the template library ships with starting points (a runnable sample pipeline, quick clean-up, profiling, grouping, sort + top N)
- **Pipeline versioning** — save / restore / delete pipeline versions with tags
- **Data lineage** — track how columns transform through your pipeline
- **Execution log** — per-step output inspection and copy
- **Bilingual UI** — English / 中文, plus dark/light/system themes

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/) toolchain (1.94 or higher)

## Installation

1. Place a Windows `xan.exe` binary in `src-tauri/resources/` — it is embedded into the binary at compile time and extracted on first run (see `src-tauri/src/xan.rs`). You can build it with `cargo build --release` from the [xan](https://github.com/medialab/xan) source, or download a pre-built binary from [xan releases](https://github.com/medialab/xan/releases).
2. Install project dependencies:

```bash
pnpm install
```

## Development

```bash
pnpm tauri dev
```

## Building

```bash
pnpm tauri build
```

## Testing

```bash
pnpm test        # run the vitest suite
pnpm test:watch  # watch mode
```

## Usage

1. **Open a CSV** — drag & drop a file onto the window, or use `Ctrl+O`. Nothing to hand yet? Click **See an example** on the welcome screen for a sample dataset plus a pipeline that already runs.
2. **Add a step** — press `Alt+C` for the command panel (it is hidden by default) and click any of the 61 xan commands; or press `Alt+A` and describe what you need, letting the assistant build the step.
3. **Pipelines and branches** — a new step becomes **its own branch** and applies straight to the input, so it runs without being connected. To chain two steps, **right-press on an operation node** and drag onto the target (the connection must start on an operation node; the canvas's gesture card lists the rest).
4. **Configure parameters** — click the gear icon on a step card, or double-click the node.
5. **Execute** — press `Ctrl+R`. The log panel opens automatically when a run starts and holds every step's output; a toast at the top reports the finish.
6. **Export** — add a `to` or `output` step to write results to disk. `Ctrl+S` / `Ctrl+E` save and export the pipeline itself, and the template library (`Ctrl+T`) ships with built-in starting points.

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` / `Ctrl+N` | Open file / open file in new tab |
| `Ctrl+S` / `Ctrl+E` | Save / export pipeline |
| `Ctrl+I` | Import pipeline |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+R` | Execute pipeline |
| `Shift+H` / `Shift+C` / `Shift+S` | Help / check update / settings |
| `Alt+C` / `Alt+Q` / `Alt+A` | Commands / logs / AI panel |

## AI Assistant

Configure your provider and API key in **Settings → AI** (`Shift+S`).

Supported providers:

| Provider | Model examples |
|----------|----------------|
| DeepSeek | `deepseek-v4-flash`, `deepseek-v4-pro` |
| Qwen | `qwen-turbo`, `qwen-max`, `qwen3.7-plus` |
| GLM | `glm-4.7-flash`, `glm-4-flash-250414`, `glm-4-flash` |

The assistant only uses your current message (not conversation history), and commands it generates are automatically connected to the last step in your pipeline.

## Documentation

- [docs/AI/INDEX.md](docs/AI/INDEX.md) — full architecture and codebase index (Rust backend, frontend, hooks, components, how to modify each area)
- [docs/AI/USAGE.md](docs/AI/USAGE.md) — merged usage docs for all 58 xan commands
- [src/docs/AI_usage/](src/docs/AI_usage) — generated per-command docs (source: `pnpm run generate-ai-usage`)
- [src/docs/cmd/](src/docs/cmd) — per-command help docs (English)
- [docs/cmd_zh/](docs/cmd_zh) — per-command help docs (Chinese)

## License

MIT
