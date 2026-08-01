# bins

Purpose: Dispatch numeric columns into bins

Parameters:
- column: Column to bin (required)
- select: Select a subset of columns to compute bins for
- bins: Number of bins to generate
- heuristic: Heuristic to use to automatically find an adequate number of bins [freedman-diaconis|sqrt|sturges]
- max-bins: Maximum number of bins to generate
- exact: Whether to make sure to return the exact number of bins provided to -b/--bins
- label: Label to choose for the bins [full|lower|upper]
- min: Override min value
- max: Override max value
- no-extra: Don't include, empty cells, nans and out of bounds counts
