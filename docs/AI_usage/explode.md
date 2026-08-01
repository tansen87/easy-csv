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
