# agg

Purpose: Aggregate data from CSV file

Parameters:
- expression: Aggregation expression (required)
- along-rows: Aggregate a selection of columns for each row instead of the whole file
- along-cols: Aggregate a selection of columns the same way and return an aggregated column with same name in the output
- along-matrix: Aggregate all values found in the given selection of columns

Examples:
- Sum all sales with alias: agg 'sum(sales) as sales'
- Multiple aggregations: agg 'sum(sales) as sales, mean(sales) as sales_avg, max(sales) as sales_max'
- Aggregate with expression: agg 'sum(price * quantity) as revenue'
