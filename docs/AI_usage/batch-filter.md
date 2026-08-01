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
