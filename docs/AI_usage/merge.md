# merge

Purpose: Merge and sort CSV files

Parameters:
- inputs: Input files to merge
- select: Select a subset of columns to sort
- numeric: Compare according to string numerical value
- reverse: Reverse order
- uniq: When set, identical consecutive lines will be dropped to keep only one line per sorted value
- source-column: Name of a column to prepend in the output of the command indicating the path to source file
- paths: Give a text file containing one path of CSV file to concatenate per line

Examples:
- Merge sorted files and sort: merge a.csv b.csv -s id
