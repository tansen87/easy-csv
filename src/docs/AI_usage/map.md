# map

Purpose: Create new columns by evaluating expressions

Parameters:
- expression: Expression to evaluate (required)
- overwrite: If set, expressions named with a column already existing in the file will be overwritten with the result of the expression instead of adding a new column at the end
- filter: If given, will not write rows in the output if all results of evaluated expression are falsey

Examples:
- Add column full_name = first_name + " " + last_name: map 'first_name ++ " " ++ last_name as full_name'
- Add column with calculation: map 'price * quantity as total'
- Add multiple columns: map 'first_name ++ " " ++ last_name as full_name, price * quantity as total'
- Add column with string operation: map 'name.upper() as name'
