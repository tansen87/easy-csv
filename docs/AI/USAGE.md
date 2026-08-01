# AI 命令使用指南

> 本文件由 docs/AI_usage/ 目录下 58 个命令文档合并生成。

---

# agg

Purpose: Aggregate data from CSV file

Parameters:
- expression: Aggregation expression (required)
- along-rows: Aggregate a selection of columns for each row instead of the whole file
- along-cols: Aggregate a selection of columns the same way and return an aggregated column with same name in the output
- along-matrix: Aggregate all values found in the given selection of columns

Examples:
- Sum all sales: agg 'sales.sum()'

---

# batch-filter

Purpose: search for multiple values and output separate files

Parameters:
- column: Column to filter on (required)
- filter-type: Filter type: text or number [text|number] (required)
- text-operator: Text filter operator [equals|not_equals|starts_with|not_starts_with|ends_with|not_ends_with|contains|not_contains|regex|is_null|is_not_null]
- number-operator: Number filter operator [equals|not_equals|greater_than|less_than|greater_or_equal|less_or_equal]
- value-mode: Value source: manual input or extract from column [manual|column] (required)
- manual-values: Newline-separated values for manual mode
- extract-column: Column to extract unique values from (column mode)
- case-insensitive: Case insensitive matching
- output-dir: Custom output directory (empty = same as source file)

Examples:
- Split file into multiple files by city column values: batch-filter --column city

---

# batch-from

Purpose: select multiple source files or folders and input format

Parameters:
- source-path: Source folder or file path (required)
- format: Input format (auto-inferred if not given) [csv|ods|xls|xlsb|xlsx|json|jsonl|ndjson|txt|npy|tar|md|markdown]
- pattern: File pattern filter (e.g. *.xlsx)
- recursive: Search subdirectories
- sheet-name: Name of the sheet to convert (Excel/OpenOffice)
- column: Name of the column to create (text lines)

---

# batch-to

Purpose: select output format and output directory

Parameters:
- format: Output format [csv|html|json|jsonl|md|ndjson|npy|txt|xlsx] (required)
- output-dir: Output directory (empty = same as source file)
- nulls: Convert empty string to null value (JSON)
- omit: Ignore empty values (JSON)
- strings: Force selected columns as raw strings (JSON)
- select: Column to emit as text (txt) or numerical columns for NPY
- limit: Maximum number of rows to emit (Markdown)

---

# behead

Purpose: Drop the header row

Parameters:
- append: Only drop headers if output already exists and is not empty

Examples:
- Drop the header row: behead

---

# bins

Purpose: Dispatch numeric columns into bins

Parameters:
- column: Column to bin (required)
- select: Select a subset of columns to compute bins for
- bins: Number of bins to generate
- heuristic: Heuristic to use to automatically find an adequate number of bins [freedman-diaconis|sqrt|sturges]
- max-bins: Maximum number of bins to generate
- exact: Whether to make sure to return the exact number of bins provided to -b/--bins
- label: Label to choose for the bins [full|lower|upper]
- min: Override min value
- max: Override max value
- no-extra: Don't include, empty cells, nans and out of bounds counts

---

# bisect

Purpose: Binary search on sorted CSV data

Parameters:
- column: Column to search on (required)
- value: Value to search for (required)
- search: Perform an exact search and only emit rows matching the query
- reverse: Indicate that the file is sorted in descending order
- numeric: Indicate that searched values are numbers and order is numerical
- exclude: Rows matching query exactly will be filtered out

---

# blank

Purpose: Blank down selected columns of a CSV file

Parameters:
- select: Selection of columns to blank down (required)
- redact: Redact the blanked down values using the provided replacement string

---

# cat

Purpose: Concatenate by row or column

Parameters:
- mode: Concatenation mode [rows|columns] (required)
- inputs: Input CSV file(s) to concatenate
- pad: When concatenating columns, this flag will cause all records to appear. It will pad each row if other CSV data isn't long enough.
- intersection: Compute the intersection of headers of all concatenated files and reorder columns accordingly. Incompatible with --union, preprocessing and --no-headers.
- union: Compute the union of headers of all concatenated files and reorder columns accordingly. Incompatible with --intersection, preprocessing and --no-headers.
- paths: When concatenating rows, give a text file (use "-" for stdin) containing one path of CSV file to concatenate per line
- glob: Use given glob pattern to collect files to concatenate
- source-column: Name of a column to prepend in the output of 'cat rows' indicating the path to source file

Examples:
- Concatenate files by rows: cat a.csv b.csv

---

# complete

Purpose: Complete missing values in a range

Parameters:
- column: Column to complete (required)
- min: Minimum value of range to complete
- max: Maximum value of range to complete
- reverse: Whether to consider the data in reverse order
- groupby: Select columns to group by

---

# count

Purpose: Count rows in file

Parameters:
- human-readable: Format the count so it is easier to read
- check-alignment: Use a slower parser validating that given CSV stream yields rows having the same number of columns

Examples:
- Count ALL rows in the file: count

Warning: count only counts ALL rows in the file, it has NO filtering capability. If the user asks to filter/search first and then count, output a two-step array [search or filter, count]. NEVER output count alone when the request contains filtering intent.

---

# dedup

Purpose: Deduplicate a CSV file

Parameters:
- select: Select a subset of columns to on which to deduplicate
- keep-last: Keep the last row having a specific identity, rather than the first one
- keep-duplicates: Emit only the duplicated rows
- choose: Evaluate an expression to decide whether to keep a newly seen row. Column names are prefixed with current_ and new_

Examples:
- Deduplicate on email column: dedup -s email

---

# drop

Purpose: Drop columns from a CSV file

Parameters:
- selection: Columns to drop (comma-separated) (required)

Examples:
- Drop the remark column: drop remark

---

# enum

Purpose: Enumerate CSV file by prepending an index column

Parameters:
- column-name: Name of the column to prepend. Will default to 'index', or 'byte_offset' when -B, --byte-offset is given
- start: Number to count from

Examples:
- Add index column: enum

---

# eval

Purpose: Evaluate/debug a single expression

Parameters:
- expr: Expression to evaluate (required)
- explain: Print concrete expression plan
- headers: Pretend headers, separated by commas, to consider
- row: Pretend row with comma-separated cells

---

# explode

Purpose: Explode rows based on some column separator

Parameters:
- columns: Columns to explode (required)
- evaluate: Evaluate an expression to split cells instead of using a simple separator
- rename: New names for the exploded columns. Must be written in CSV format if exploding multiple columns
- keep: Keep the exploded columns alongside each split
- drop-empty: Drop rows when selected cells are empty
- pad: When exploding multiple columns at once, pad shorter splits to align them with the longest one instead of erroring

Examples:
- Explode tags column by | separator: explode tags

---

# fill

Purpose: Fill empty cells

Parameters:
- select: Selection of columns to fill
- value: Fill empty cells using provided value instead of using last non-empty value

Examples:
- Fill empty cells in col with 0: fill -s col -v 0

---

# filter

Purpose: Only keep some CSV rows based on an evaluated expression

Parameters:
- expression: Filter expression (col1 > 1) (required)
- invert-match: If set, will invert the evaluated value
- limit: Number of rows to return

Examples:
- Filter rows with age > 30: filter 'age > 30'
- Filter rows where name contains "Zhang" and score >= 90: filter 'name.contains("Zhang") && score >= 90'

---

# fixlengths

Purpose: Fix record lengths

Parameters:
- length: Forcefully set the length of each record
- trust-header: Trust that the first row indicates the correct number of columns of the file

---

# flatten

Purpose: Display a flattened version of each row

Parameters:
- select: Select the columns to visualize
- limit: Maximum number of rows to read
- csv: Write the result as a CSV file with the row,field,value columns instead
- non-empty: For each row, only show non-empty values

---

# fmt

Purpose: Format CSV output

Parameters:
- out-delimiter: The field delimiter for writing CSV data [,|\t|;|||^]
- tabs: Shorthand for --out-delimiter '\t'
- quote: The quote character to use

---

# frequency

Purpose: Show frequency tables

Parameters:
- select: Select a subset of columns to compute frequencies for
- groupby: If given, will compute frequency tables per group as defined by the given columns
- all: Remove the limit
- limit: Limit the frequency table to the N most common items
- no-extra: Don't include empty cells & remaining counts

Examples:
- Frequency table of name column values: frequency -s name

---

# from

Purpose: Convert from other formats to CSV

Parameters:
- format: Input format (will be inferred from file extension if not given) [ods|xls|xlsb|xlsx|json|jsonl|ndjson|txt|npy|tar|md|markdown]
- sheet-name: Name of the sheet to convert
- column: Name of the column to create (text lines)

Examples:
- Convert from Excel to CSV: from xlsx

---

# groupby

Purpose: Aggregate data by groups

Parameters:
- columns: Columns to group by (required)
- expression: Aggregation expression (required)
- keep: Keep this selection of columns, in addition to the ones representing groups, in the output
- along-cols: Perform a single aggregation over all of selected columns and create a column per group with the result in the output
- along-matrix: Aggregate all values found in the given selection of columns
- total: Run an aggregation over the whole file in the same pass over the data and add the resulting columns at the end of each group's result

Examples:
- Group by region, sum sales: groupby region 'sales.sum()'

---

# head

Purpose: First rows of CSV file

Parameters:
- limit: Number of rows to return

Examples:
- View first 10 rows: head
- View first 20 rows: head -l 20

---

# headers

Purpose: Show header names

Parameters:
- just-names: Only show the header names
- csv: Return headers as a CSV file, with file path as column names

---

# hist

Purpose: Print a histogram with rows as bars

Parameters:
- name: Name of the represented field when no field column is present
- field: Name of the field column
- label: Name of the label column
- value: Name of the count column

---

# implode

Purpose: Collapse consecutive identical rows based on a diverging column

Parameters:
- columns: Columns to implode (required)
- rename: New name for the diverging column. Does not work with -P, --pluralize.

Examples:
- Implode consecutive rows by id, join tags with |: implode id

---

# input

Purpose: Read unusually formatted CSV data

Parameters:
- tabs: Use tabulations as delimiter
- quote: The quote character to use
- no-quoting: Disable quoting completely
- trim: Whether to trim cell values
- tolerant: Use a slower but more tolerant CSV parser

---

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

---

# map

Purpose: Create new columns by evaluating expressions

Parameters:
- expression: Expression to evaluate (required)
- overwrite: If set, expressions named with a column already existing in the file will be overwritten with the result of the expression instead of adding a new column at the end
- filter: If given, will not write rows in the output if all results of evaluated expression are falsey

Examples:
- Add column full_name = first_name + " " + last_name: map 'first_name ++ " " ++ last_name'

---

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

---

# output

Purpose: Write output to file instead of stdout

Parameters:
- path: Output file path (required)

---

# partition

Purpose: Partition CSV data based on a column value

Parameters:
- column: Column to partition by (required)
- out-dir: Where to write the chunks
- filename: A filename template to use when constructing the names of the output files
- drop: Drop the partition column from results

Examples:
- Partition file by region column values: partition region

---

# pivot

Purpose: Split distinct values into their own columns

Parameters:
- columns: Columns to pivot
- expr: Aggregation expression
- groupby: Group results by given selection of columns
- column-sep: Separator used to join column names when pivoting on multiple columns

Examples:
- Pivot product column into columns, grouped by category, value = sum of sales: pivot product 'sales.sum()' -g category

---

# plot

Purpose: Plot data from a CSV file

Parameters:
- x: X axis column (required)
- y: Y axis column (optional if --count is used)
- line: Draw a line plot instead of the default scatter plot
- count: Omit the y column and count rows instead

---

# range

Purpose: Create a CSV file from a numerical range

Parameters:
- end: End of the range (required)
- start: Start of the range
- step: Step of the range
- column-name: Name of the column containing the range

Examples:
- Generate numeric column 1 to 100: range 100

---

# rename

Purpose: Rename columns of a CSV file

Parameters:
- select: Select the columns to rename
- columns: Column mappings or pattern and replacement when using --replace
- prefix: Prefix to add to all column names
- suffix: Suffix to add to all column names

Examples:
- Rename column a to b: rename a b

---

# reverse

Purpose: Reverse rows of CSV data

Examples:
- Reverse row order: reverse

---

# run

Purpose: Run a xan pipeline or script

Parameters:
- pipeline: Pipeline to run (required)
- file: Run pipeline from a script file instead
- tee: Interleave a call to `xan view -T` between each step of given pipeline

---

# sample

Purpose: Randomly sample CSV data

Parameters:
- seed: Random seed for reproducibility
- groupby: Return a sample per group

Examples:
- Randomly sample 100 rows: sample 100

---

# scrape

Purpose: Scrape HTML into CSV data

Parameters:
- evaluate: Evaluate the given scraping expression
- paths: Read input and consider it as containing one document path per line
- docs: Read input as CSV file with a column containing inline documents
- doc-column: Selects column containing inline documents given through --docs
- stdin-doc: Read the content of stdin as a single document
- glob: Collect document paths to process by applying the given glob pattern
- encoding: Encoding to read on disk. Will default to utf-8
- keep: Selection of columns from the input to keep in the output
- input-dir: Processed paths will be read relative to the given base path
- url-column: Column containing the base url for given HTML
- foreach: Return one row per element matching the CSS selector

Examples:
- Scrape web page with CSS selector: scrape -e '.title'

---

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

---

# select

Purpose: Select columns from a CSV file

Parameters:
- selection: Selection expression (required)
- evaluate: Toggle expression evaluation rather than using the shorthand selection notation

Examples:
- Keep only name and age columns: select name,age

---

# separate

Purpose: Split a single column into multiple ones

Parameters:
- column: Column to split (required)
- separator: Separator to use (required)

Examples:
- Split full_name into multiple columns by space: separate full_name ' '

---

# shuffle

Purpose: Shuffle CSV data

Parameters:
- seed: RNG seed

---

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

---

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

---

# split

Purpose: Split CSV data into chunks

Parameters:
- out-dir: Where to write the chunks. Defaults to current working directory
- size: The number of records to write into each chunk
- chunks: Divide the file into at most <n> chunks having roughly the same number of records
- filename: A filename template to use when constructing the names of the output files

---

# stats

Purpose: Compute basic statistics

Parameters:
- select: Select a subset of columns to compute stats for
- groupby: If given, will compute stats per group as defined by the given column selection
- all: Shorthand for -cq
- cardinality: Show cardinality and modes
- quartiles: Show quartiles
- nulls: Include empty values in the population size for computing mean and standard deviation

Examples:
- Compute stats of numeric columns: stats

---

# tail

Purpose: Last rows of CSV file

Parameters:
- limit: Number of rows to return

Examples:
- View last 10 rows: tail
- View last 20 rows: tail -l 20

---

# to

Purpose: Convert a CSV file to other formats

Parameters:
- format: Output format [html|json|jsonl|md|ndjson|npy|txt|xlsx] (required)
- nulls: Convert empty string to null value
- omit: Ignore empty values
- strings: Force selected columns as raw strings
- select: Column to emit as text (txt) or numerical columns for NPY
- limit: Maximum number of rows to emit

Examples:
- Convert to Excel: to xlsx

---

# top

Purpose: Find top rows according to some column

Parameters:
- column: Column to sort by (required)
- limit: Number of rows to return
- reverse: Reverse order
- lexicographic: Rank values lexicographically instead of considering them as numbers
- groupby: Return top n values per group, represented by the values in given columns

---

# transform

Purpose: Transform a column by evaluating an expression

Parameters:
- column: Column to transform (required)
- expression: Expression to evaluate (required)

Examples:
- Uppercase the price column: transform price 'price.uppercase()'

---

# transpose

Purpose: Transpose CSV file

Examples:
- Transpose rows and columns: transpose

---

# unpivot

Purpose: Stack multiple columns into fewer columns

Parameters:
- columns: Columns to unpivot (required)

Examples:
- Stack v1,v2,v3 columns into key/value: unpivot v1,v2,v3

---

# view

Purpose: Preview a CSV file in a human-friendly way

Parameters:
- select: Select the columns to visualize
- all: Remove the row limit and display everything
- limit: Number of rows to display

Examples:
- View first 10 rows: view
- View first 50 rows: view -l 50

---

# window

Purpose: Compute window functions

Parameters:
- expression: Window expression (required)
- groupby: If given, runs the aggregation per group symbolized by given column selection.
- overwrite: Overwrite existing columns
- along-columns: Repeat same expression over a selection of columns at once

Examples:
- Add rank column, ranked by score descending: window 'score.rank()'

---

