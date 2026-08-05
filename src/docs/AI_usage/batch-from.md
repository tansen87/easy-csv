# batch-from

Purpose: select multiple source files or folders and input format

Parameters:
- source-path: Source folder or file path (required)
- format: Input format (auto-inferred if not given) [csv|ods|xls|xlsb|xlsx|json|jsonl|ndjson|txt|npy|tar|md|markdown]
- pattern: File pattern filter (e.g. *.xlsx)
- recursive: Search subdirectories
- sheet-name: Name of the sheet to convert (Excel/OpenOffice)
- column: Name of the column to create (text lines)
