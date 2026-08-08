# enum

Purpose: Enumerate CSV file by prepending an index column

Parameters:
- column-name: Name of the column to prepend. Will default to 'index', or 'byte_offset' when -B, --byte-offset is given
- start: Number to count from

Examples:
- Add index column: enum
- Add custom named index column: enum -c row_id
- Add index starting from 1: enum -s 1
- Add byte offset column: enum -B
