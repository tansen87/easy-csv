# batch-filter

```txt
Batch filter: search for multiple values and output separate files.

This command splits a CSV file into multiple output files based on column values.
For each unique value (or manually specified value), it creates a separate CSV file
containing only the rows that match that value.

batch-filter options:
    --column <column>          Column to filter on (required).
    --filter-type <type>       Filter type: "text" or "number" (required).
                               [default: text]
    --text-operator <op>       Text filter operator. One of: equals, not_equals,
                               starts_with, not_starts_with, ends_with, not_ends_with,
                               contains, not_contains, regex, is_null, is_not_null.
                               [default: equals]
    --number-operator <op>     Number filter operator. One of: equals, not_equals,
                               greater_than, less_than, greater_or_equal, less_or_equal.
                               [default: equals]
    --value-mode <mode>        Value source: "manual" or "column" (required).
                               [default: manual]
    --manual-values <values>   Newline-separated values for manual mode.
    --extract-column <col>     Column to extract unique values from (column mode).
    --case-insensitive         Case insensitive matching.
    --output-dir <dir>         Custom output directory. Defaults to the same directory
                               as the source file.

Output files are named as: {source_basename}_{sanitized_value}.csv
```
