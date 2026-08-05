# batch-to

Purpose: select output format and output directory

Parameters:
- format: Output format [csv|html|json|jsonl|md|ndjson|npy|txt|xlsx] (required)
- output-dir: Output directory (empty = same as source file)
- nulls: Convert empty string to null value (JSON)
- omit: Ignore empty values (JSON)
- strings: Force selected columns as raw strings (JSON)
- select: Column to emit as text (txt) or numerical columns for NPY
- limit: Maximum number of rows to emit (Markdown)
