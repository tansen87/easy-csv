# transform

Purpose: Transform a column by evaluating an expression

Parameters:
- column: Column to transform (required)
- expression: Expression to evaluate (required)

Examples:
- Uppercase the price column: transform price 'upper(_)'
- Lowercase the name column: transform name 'lower(_)'
- Trim whitespace from text column: transform text 'trim(_)'
- Transform and rename: transform price 'upper(_)' -r upper_price
