# dedup

Purpose: Deduplicate a CSV file

Parameters:
- select: Select a subset of columns to on which to deduplicate
- keep-last: Keep the last row having a specific identity, rather than the first one
- keep-duplicates: Emit only the duplicated rows
- choose: Evaluate an expression to decide whether to keep a newly seen row. Column names are prefixed with current_ and new_

Examples:
- Deduplicate on email column: dedup -s email
