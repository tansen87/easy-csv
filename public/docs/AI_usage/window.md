# window

Purpose: Compute window functions

Parameters:
- expression: Window expression (required)
- groupby: If given, runs the aggregation per group symbolized by given column selection.
- overwrite: Overwrite existing columns
- along-columns: Repeat same expression over a selection of columns at once

Examples:
- Add rank column, ranked by score descending: window 'score.rank()'
