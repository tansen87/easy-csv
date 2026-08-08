# bisect

Purpose: Binary search on sorted CSV data

Parameters:
- column: Column to search on (required)
- value: Value to search for (required)
- search: Perform an exact search and only emit rows matching the query
- reverse: Indicate that the file is sorted in descending order
- numeric: Indicate that searched values are numbers and order is numerical
- exclude: Rows matching query exactly will be filtered out
