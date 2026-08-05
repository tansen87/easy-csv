# implode

Purpose: Collapse consecutive identical rows based on a diverging column

Parameters:
- columns: Columns to implode (required)
- rename: New name for the diverging column. Does not work with -P, --pluralize.

Examples:
- Implode consecutive rows by id, join tags with |: implode id
