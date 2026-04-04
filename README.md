# Easy Csv

A modern graphical user interface for the [xan](https://github.com/medialab/xan) CSV processing tool, built with Tauri, React, and shadcn-ui.

## Features

- **Visual Pipeline Builder**: Drag and drop xan commands to build data processing pipelines
- **Command Library**: Browse and search all available xan commands organized by category
- **Parameter Configuration**: Easy-to-use forms for configuring command parameters
- **Real-time Logs**: View execution logs and output in real-time
- **Modern UI**: Clean, responsive interface built with shadcn-ui components

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/)
- [xan](https://github.com/medialab/xan) CLI tool

## Installation

1. Install xan CLI tool:
   ```bash
   # Using cargo
   cargo install xan --locked
   
   # Or download pre-built binaries from https://github.com/medialab/xan/releases
   ```

2. Install project dependencies:
   ```bash
   pnpm install
   ```

## Development

Run the development server:
```bash
pnpm tauri dev
```

This will start both the Vite dev server and the Tauri application.

## Building

Build the application for production:
```bash
pnpm tauri build
```

The built application will be in the `src-tauri/target/release/bundle/` directory.

## Usage

1. **Browse Commands**: The left panel shows all available xan commands organized by category
2. **Add to Pipeline**: Click on any command to add it to your pipeline
3. **Configure Parameters**: Click on a step in the pipeline to configure its parameters in the right panel
4. **Reorder Steps**: Drag steps in the pipeline to reorder them
5. **Execute**: Click the "Execute" button to run your pipeline
6. **View Logs**: Check the bottom panel for execution logs and output

## Project Structure

```
xan-gui/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn-ui components
│   │   ├── CommandList.tsx # Left panel command browser
│   │   ├── PipelineBuilder.tsx # Middle panel pipeline editor
│   │   ├── ParameterPanel.tsx  # Right panel parameter editor
│   │   └── LogPanel.tsx    # Bottom panel log viewer
│   ├── data/
│   │   └── commands.ts     # xan command definitions
│   ├── types/
│   │   └── xan.ts          # TypeScript type definitions
│   ├── lib/
│   │   └── utils.ts        # Utility functions
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── index.css           # Global styles
├── src-tauri/
│   ├── src/
│   │   └── lib.rs          # Tauri backend commands
│   └── Cargo.toml          # Rust dependencies
└── package.json            # Node.js dependencies
```

## Available Xan Commands

The application includes support for the following xan command categories:

- **Viewing**: view, flatten
- **Manipulation**: select, slice, split, replace, dedup
- **Filtering**: search, filter
- **Sorting**: sort
- **Aggregation**: count, frequency, stats, pivot
- **Joining**: join
- **Sampling**: sample
- **Conversion**: to, from

## License

MIT

## Acknowledgments

- [xan](https://github.com/medialab/xan) - The powerful CSV processing tool
- [Tauri](https://tauri.app/) - Framework for building desktop applications
- [shadcn-ui](https://ui.shadcn.com/) - Beautiful UI components
- [dnd-kit](https://dndkit.com/) - Drag and drop functionality
