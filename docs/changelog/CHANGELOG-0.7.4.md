# Changelog

## [0.7.4] - 2026-11-01

4 commits since v0.7.3.

### Added

- **Number Rows by Group** (Tools → Number Rows by Group): a new file-level tool that prepends a per-group sequence number to a CSV. Pick the file, the group column and the index column name, then run it; rows of the same group are numbered 1, 2, 3… and the new column is placed first. Two toggles keep the result predictable. **Groups are already contiguous** restarts the counter whenever the group column changes, for files already sorted or grouped; leave it off (the default) when one group appears in several separate runs, and the counter keeps counting across them. **Allow rows with a different field count** is off by default so a ragged row stops the run with an error instead of silently shifting columns. Both are passed to the reader and the writer, so the row shape the tool reads is the shape it writes. The run streams with 1 MiB buffers, compares group keys byte-for-byte, reuses one record buffer per row and keeps memory flat, so file size does not change the peak. Header rows are handled explicitly and `skiprows` applies before the header, so the first data row is never swallowed. Output lands next to the input as `*_group_enum.<ext>` (or in a chosen directory) with the input's delimiter and quoting style, and the dialog keeps the last settings and the last result.

- **CSV to Excel** (Tools → CSV to Excel): converts a CSV into an `.xlsx` workbook with two output shapes. **Single sheet** writes one worksheet and refuses files above Excel's 1,048,575 data-row limit, telling you to switch to split mode rather than writing a truncated file. **Split across sheets** writes several worksheets inside one workbook, each holding up to the configured rows and repeating the header row. Column count is checked against Excel's 16,384-column limit too. The delimiter is auto-detected from the input, `skiprows` is honoured before the header, and rows are counted while streaming instead of making a separate full pass over the file. The blocking work runs off the async runtime, settings are validated on both sides (rows per sheet must be at least 1 and no more than Excel's limit), the output directory is configurable, and the dialog remembers the last parameters and result.

### Changed

- **DuckDB and `xan fixlengths` now have in-app help**: both commands ship generated docs in English and Chinese. The DuckDB page explains that upstream data is exposed as the `input` relation, that `.duckdb` inputs also expose the selected table through the `src` schema, that consecutive `duckdb` steps run in one process without a CSV round-trip, and that every step except the last must be a single statement.
- **Template apply is simpler**: the Apply button no longer carries a play icon, and the first-run guide dropped its gesture hint line.
- **"保存Pipeline" is now "保存为脚本"** in the Chinese UI, matching what the action actually produces.

### Fixed

- **Execution history scrolls again**: the dialog used a max-height, which let the record list grow past the panel and made older entries unreachable. It now has a fixed height with its own scrolling area.
- **The log level filter fits a narrow panel**: the five filter chips were replaced by one select that keeps the per-level counts and is labelled for screen readers, so nothing is truncated when the log panel is minimised.
