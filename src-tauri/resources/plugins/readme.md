# Plugin binaries (user-managed)

`xan` and `pinyin` are **not** shipped inside the app. The user provides them.

At runtime the app looks for the binaries in the current platform's plugin
directory, and falls back to `PATH`:

| Platform | Drop-in directory |
|----------|-------------------|
| Windows | `<exe_dir>\plugins\windows-x86_64\` — the install directory *is* the data directory |
| macOS | `~/Library/Application Support/EasyCsv/plugins/macos-aarch64/` (or `macos-x86_64/`) |
| Linux | `<exe_dir>/plugins/linux-x86_64-gnu/` (AppImage: next to the `.AppImage` file, in `EasyCsv/`) |

On Windows/Linux the data lives **in the directory the executable sits in** (design
022 §「修订」): app and data are one folder. The installer guarantees that folder is
named `EasyCsv` (`<chosen path>\EasyCsv`), which is what keeps an uninstall from
deleting anything else. macOS keeps its data in `Application Support` because
writing inside a `.app` bundle would invalidate the code signature.

Place the matching binaries there (or install them on `PATH`):

```
windows-x86_64/    xan.exe, pinyin.exe
macos-aarch64/     xan,    pinyin
macos-x86_64/      xan,    pinyin
linux-x86_64-gnu/  xan,    pinyin
linux-aarch64-gnu/ xan,    pinyin
```

- `xan` is a precompiled CLI binary from the xan release page
  (https://github.com/medialab/xan/releases). The `windows-x86_64` copies
  checked into this folder are provided for convenience.
- `pinyin` is built from the repo's own `plugins/pinyin-cli` crate
  (`cargo build --release --manifest-path plugins/pinyin-cli/Cargo.toml`).

The on-disk subdirectory is selected at compile time via `PLATFORM_DIR` in
`src-tauri/src/plugins.rs`.