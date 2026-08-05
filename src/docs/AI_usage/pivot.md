# pivot

Purpose: Split distinct values into their own columns

Parameters:
- columns: Columns to pivot
- expr: Aggregation expression
- groupby: Group results by given selection of columns
- column-sep: Separator used to join column names when pivoting on multiple columns

Examples:
- Pivot product column into columns, grouped by category, value = sum of sales: pivot product 'sales.sum()' -g category
