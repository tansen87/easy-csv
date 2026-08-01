# filter

Purpose: Only keep some CSV rows based on an evaluated expression

Parameters:
- expression: Filter expression (col1 > 1) (required)
- invert-match: If set, will invert the evaluated value
- limit: Number of rows to return

Examples:
- Filter rows with age > 30: filter 'age > 30'
- Filter rows where name contains "Zhang" and score >= 90: filter 'name.contains("Zhang") && score >= 90'
