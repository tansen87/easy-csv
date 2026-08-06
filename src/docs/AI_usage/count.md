# count

Purpose: Count rows in file

Parameters:
- check-alignment: Use a slower parser validating that given CSV stream yields rows having the same number of columns

Examples:
- Count ALL rows in the file: count

Warning: count only counts ALL rows in the file, it has NO filtering capability. If the user asks to filter/search first and then count, output a two-step array [search or filter, count]. NEVER output count alone when the request contains filtering intent.
