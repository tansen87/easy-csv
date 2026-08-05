# join

Purpose: Join CSV files

Parameters:
- columns: Columns to join on (for single column set) or left columns (for two column sets)
- input1: First input file path (required)
- input2: Second input file path (required)
- join-type: Join type [inner|left|right|full|semi|anti|cross|fuzzy]
- contains: Join by matching substrings (fuzzy join)
- regex: Join by regex patterns (fuzzy join)
- nulls: When set, joins will work on empty fields
- drop-key: Indicate whether to drop columns representing the join key [left|right|none|both]
- prefix-left: Add a prefix to the names of the columns in the first dataset
- prefix-right: Add a prefix to the names of the columns in the second dataset
- reverse: Reverse sort order for sorted inputs, i.e. descending order
- numeric: Compare keys according to their numerical values instead of the default lexicographic order

Examples:
- Inner join two files on id: join id a.csv b.csv
- Left join: join --left id a.csv b.csv
