# frequency

Purpose: Show frequency tables

Parameters:
- select: Select a subset of columns to compute frequencies for
- groupby: If given, will compute frequency tables per group as defined by the given columns
- all: Remove the limit
- limit: Limit the frequency table to the N most common items
- no-extra: Don't include empty cells & remaining counts

Examples:
- Frequency table of name column values: frequency -s name
