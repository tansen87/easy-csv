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
