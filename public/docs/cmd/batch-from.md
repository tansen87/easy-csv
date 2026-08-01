# batch-from

```txt
Batch convert: select multiple source files or folders and input format.

This command converts multiple files from various formats (Excel, JSON, etc.)
to CSV in batch. It works together with batch-to to define the complete
conversion pipeline.

batch-from options:
    --source-path <path>       Source folder or file path (required).
                               Multiple paths can be separated by semicolons.
    --format <format>          Input format. One of: csv, ods, xls, xlsb, xlsx,
                               json, jsonl, ndjson, txt, npy, tar, md, markdown.
                               Auto-inferred from file extension if not given.
    --pattern <pattern>        File pattern filter (e.g. "*.xlsx"). [default: *]
    --recursive                Search subdirectories recursively.

Excel/OpenOffice options:
    --sheet-index <i>          0-based index of the sheet to convert.
    --sheet-name <name>        Name of the sheet to convert.

JSON options:
    --sample-size <n>          Number of records to sample before emitting headers.
    --sort-keys                Sort JSON keys lexicographically.
    --key-column <name>        Name for the key column when parsing a JSON map.
    --value-column <name>      Name for the value column when parsing a JSON map.
    --single-object            Map a single JSON object to a single CSV row.

Text/Raw options:
    --column <name>            Name of the column to create.

Markdown options:
    --nth-table <n>            Select nth table in document.

Note: This command must be paired with batch-to to complete the conversion.
```
