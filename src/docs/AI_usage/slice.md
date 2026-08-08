# slice

Purpose: Slice rows of CSV file

Parameters:
- start: The index of the row to slice from
- skip: Same as start
- end: The index of the row to slice to
- len: The length of the slice (can be used instead of end)
- index: Slice a single row
- indices: Return a slice containing multiple indices at once
- last: Return last <n> rows from file

Examples:
- Take rows 5 to 15: slice -s 5 -e 15
