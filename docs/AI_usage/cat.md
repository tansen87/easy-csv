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
