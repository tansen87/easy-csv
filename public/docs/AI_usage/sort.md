# sort

Purpose: Sort CSV data

Parameters:
- select: Select a subset of columns to sort by (required)
- reverse: Reverse sort order, i.e. descending order
- numeric: Compare according to the numerical value of cells
- count: Number of times the line was consecutively duplicated
- uniq: Drop identical consecutive lines
- columns: Sort selected columns alphabetically by their names
- cells: Sort the selected cell values instead of the file itself

Examples:
- Sort by age ascending: sort -s age
- Sort by age descending (numeric): sort -s age -R -N
