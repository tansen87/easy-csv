# batch-to

```txt
Batch convert: select output format and output directory.

This command defines the output format and destination for batch conversion.
It works together with batch-from to define the complete conversion pipeline.

batch-to options:
    <format>                   Output format (required). One of: csv, html, json,
                               jsonl, md, ndjson, npy, txt, xlsx.
                               [default: xlsx]
    --output-dir <dir>         Output directory. Defaults to the same directory
                               as the source file.
    --sample-size <n>          Number of rows to sample to infer column types (JSON).
                               [default: 512]
    --nulls                    Convert empty string to null value (JSON).
    --omit                     Ignore empty values (JSON).
    --strings <columns>        Force selected columns as raw strings (JSON).
    --dtype <type>             Number type for npy conversion: f32 or f64.
    --select <columns>         Column to emit as text (txt) or numerical columns
                               for NPY.
    --limit <n>                Maximum number of rows to emit (Markdown).

Note: This command must be paired with batch-from to complete the conversion.
```
