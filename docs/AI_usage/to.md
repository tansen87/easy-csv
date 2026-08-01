# to

Purpose: Convert a CSV file to other formats

Parameters:
- format: Output format [html|json|jsonl|md|ndjson|npy|txt|xlsx] (required)
- nulls: Convert empty string to null value
- omit: Ignore empty values
- strings: Force selected columns as raw strings
- select: Column to emit as text (txt) or numerical columns for NPY
- limit: Maximum number of rows to emit

Examples:
- Convert to Excel: to xlsx
