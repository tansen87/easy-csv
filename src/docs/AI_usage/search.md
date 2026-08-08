# search

Purpose: Search for (or replace) patterns in CSV data

Parameters:
- select: Select the columns to search
- pattern: Search pattern
- exact: Exact match
- regex: Use regular expression
- non-empty: Find non-empty cells (no pattern needed)
- empty: Find empty cells (no pattern needed)
- invert-match: Select only rows that did not match
- count: Column name to report total number of matches
- limit: Maximum number of rows to return
- --every-column: Only output a row when every selected column matches a pattern

Examples:
- Filter rows where "city" column contains "Shanghai": search -s city Shanghai
- Rows with id starting with "CN": search -s id -r '^CN'
- Rows with id ending with "1": search -s id -r '1$'
- Exact match, rows where idx equals 1001: search -s idx -e 1001
