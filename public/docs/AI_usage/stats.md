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
