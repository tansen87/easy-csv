# Easy Csv

Handle CSV data in a modular way (chain operations together like building blocks using [xan](https://github.com/medialab/xan))

## Screenshots

![light](/docs/img/light.jpg)

![dark](/docs/img/dark.jpg)

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

```bash
pnpm tauri dev
```

## Building

```bash
pnpm tauri build
```

## Usage

1. **Open File / Import Pipeline**: Open csv file or import pipeline
2. **Browse Commands**: The left panel shows all available xan commands organized by category
3. **Add to Flow**: Click on any command to add it to your flow
4. **Configure Parameters**: Click on the setting icon in the upper right corner of the card to modify parameters
5. **Execute**: Click the "Execute" button to run your flow

## License

MIT
