# partition

Purpose: Partition CSV data based on a column value

Parameters:
- column: Column to partition by (required)
- out-dir: Where to write the chunks
- filename: A filename template to use when constructing the names of the output files
- drop: Drop the partition column from results

Examples:
- Partition file by region column values: partition region
