/**
 * DuckDB SQL vocabulary for the dedicated SQL editor (keyword highlighting,
 * autocomplete and quick templates). The piped pipeline CSV is exposed as the
 * virtual relation `input`.
 */

/** SQL keywords rendered in the keyword color. */
export const duckdbKeywords = new Set([
  // Statements
  "select",
  "from",
  "where",
  "group",
  "by",
  "having",
  "order",
  "limit",
  "offset",
  "as",
  "alias",
  "with",
  "recursive",
  "create",
  "table",
  "view",
  "or",
  "replace",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "drop",
  "alter",
  "rename",
  "copy",
  "export",
  "import",
  "attach",
  "detach",
  "refresh",
  "pragma",
  "set",
  "use",
  "describe",
  "show",
  "explain",
  "analyze",
  "extensions",
  "load",
  "install",
  // Clauses / combinators
  "join",
  "inner",
  "left",
  "right",
  "full",
  "outer",
  "cross",
  "semi",
  "anti",
  "on",
  "using",
  "union",
  "all",
  "distinct",
  "except",
  "intersect",
  "pivot",
  "unpivot",
  "on",
  "query",
  "qualify",
  "over",
  "partition",
  "rows",
  "range",
  "groups",
  "within",
  "filter",
  // Operators
  "and",
  "or",
  "not",
  "in",
  "is",
  "null",
  "exists",
  "between",
  "like",
  "ilike",
  "any",
  "case",
  "when",
  "then",
  "else",
  "end",
  "cast",
  "try_cast",
  // Ordering
  "asc",
  "desc",
  "nulls",
  "first",
  "last",
  // Aggregation modifiers
  "rollup",
  "cube",
  "grouping",
  "sets",
  // Misc
  "temporary",
  "temp",
  "root",
  "database",
  "schema",
  "if",
]);

/** Built-in scalar / aggregate / table functions suggested in the editor. */
export interface DuckdbFunction {
  name: string;
  signature: string;
  description: string;
}

export const duckdbFunctions: DuckdbFunction[] = [
  {
    name: "count",
    signature: "(* | expr)",
    description: "Row / value count (aggregate)",
  },
  { name: "sum", signature: "(expr)", description: "Sum (aggregate)" },
  { name: "avg", signature: "(expr)", description: "Average (aggregate)" },
  { name: "min", signature: "(expr)", description: "Minimum" },
  { name: "max", signature: "(expr)", description: "Maximum" },
  { name: "median", signature: "(expr)", description: "Median (aggregate)" },
  {
    name: "quantile_cont",
    signature: "(expr, q)",
    description: "Continuous quantile",
  },
  {
    name: "quantile_disc",
    signature: "(expr, q)",
    description: "Discrete quantile",
  },
  {
    name: "stddev",
    signature: "(expr)",
    description: "Sample standard deviation",
  },
  { name: "var_pop", signature: "(expr)", description: "Population variance" },
  {
    name: "string_agg",
    signature: "(expr, sep)",
    description: "Concatenate values",
  },
  {
    name: "list",
    signature: "(expr)",
    description: "Collect values into a list",
  },
  {
    name: "first",
    signature: "(expr)",
    description: "First value (aggregate)",
  },
  { name: "last", signature: "(expr)", description: "Last value (aggregate)" },
  {
    name: "unnest",
    signature: "(list)",
    description: "Expand a list into rows / columns",
  },
  {
    name: "generate_series",
    signature: "(start, stop[, step])",
    description: "Generate a row series",
  },
  {
    name: "range",
    signature: "(n | start, stop[, step])",
    description: "Integer list range",
  },
  { name: "len", signature: "(str)", description: "String / list length" },
  { name: "length", signature: "(str)", description: "String length" },
  { name: "upper", signature: "(str)", description: "Uppercase" },
  { name: "lower", signature: "(str)", description: "Lowercase" },
  { name: "trim", signature: "(str)", description: "Trim whitespace" },
  { name: "ltrim", signature: "(str)", description: "Trim leading whitespace" },
  {
    name: "rtrim",
    signature: "(str)",
    description: "Trim trailing whitespace",
  },
  {
    name: "substring",
    signature: "(str, start[, len])",
    description: "Substring",
  },
  {
    name: "substr",
    signature: "(str, start[, len])",
    description: "Substring (alias)",
  },
  {
    name: "split_part",
    signature: "(str, sep, idx)",
    description: "Split by separator, take part",
  },
  {
    name: "str_split",
    signature: "(str, sep)",
    description: "Split into a list",
  },
  { name: "array_length", signature: "(list)", description: "List length" },
  {
    name: "coalesce",
    signature: "(a, b, ...)",
    description: "First non-NULL value",
  },
  {
    name: "ifnull",
    signature: "(a, b)",
    description: "Replace NULL with default",
  },
  { name: "nullif", signature: "(a, b)", description: "NULL if a = b" },
  { name: "least", signature: "(a, ...)", description: "Smallest value" },
  { name: "greatest", signature: "(a, ...)", description: "Largest value" },
  {
    name: "contains",
    signature: "(str, sub)",
    description: "Substring membership",
  },
  { name: "startswith", signature: "(str, pre)", description: "Prefix check" },
  { name: "endswith", signature: "(str, suf)", description: "Suffix check" },
  { name: "round", signature: "(num[, prec])", description: "Round a number" },
  { name: "floor", signature: "(num)", description: "Round down" },
  { name: "ceil", signature: "(num)", description: "Round up" },
  { name: "abs", signature: "(num)", description: "Absolute value" },
  {
    name: "regexp_matches",
    signature: "(str, pattern)",
    description: "Regex match predicate",
  },
  {
    name: "regexp_extract",
    signature: "(str, pattern[, idx])",
    description: "Regex capture",
  },
  {
    name: "regexp_replace",
    signature: "(str, pattern, repl)",
    description: "Regex replace",
  },
  {
    name: "date_trunc",
    signature: "(part, date)",
    description: "Truncate to date part",
  },
  {
    name: "date_part",
    signature: "(part, date)",
    description: "Extract date part",
  },
  { name: "year", signature: "(date)", description: "Extract year" },
  { name: "month", signature: "(date)", description: "Extract month" },
  { name: "day", signature: "(date)", description: "Extract day" },
  { name: "strftime", signature: "(date, format)", description: "Format date" },
  { name: "now", signature: "()", description: "Current timestamp" },
  { name: "current_date", signature: "", description: "Current date" },
  {
    name: "json_extract",
    signature: "(json, path)",
    description: "Extract JSON value",
  },
  {
    name: "json_extract_string",
    signature: "(json, path)",
    description: "Extract JSON as string",
  },
];

/** Table functions used to read external / pipeline data. */
export const duckdbTableFunctions = [
  {
    name: "read_csv_auto",
    signature: "(path[, ...])",
    description: "Auto-detect CSV (pipeline source)",
  },
  {
    name: "read_csv",
    signature: "(path[, options])",
    description: "CSV with explicit options",
  },
  {
    name: "read_parquet",
    signature: "(path)",
    description: "Read Parquet file(s)",
  },
  {
    name: "read_json_auto",
    signature: "(path)",
    description: "Read JSON file(s)",
  },
  {
    name: "read_json",
    signature: "(path[, options])",
    description: "Read JSON with options",
  },
];

/** Quick-insert template snippets shown above the editor. */
export interface DuckdbTemplate {
  key: string;
  label: string;
  sql: string;
}

export const duckdbTemplates: DuckdbTemplate[] = [
  {
    key: "select-all",
    label: "SELECT *",
    sql: "SELECT * FROM input LIMIT 100;",
  },
  {
    key: "groupby",
    label: "GROUP BY",
    sql: "SELECT\n  column1,\n  count(*) AS n\nFROM input\nGROUP BY column1\nORDER BY n DESC;",
  },
  {
    key: "filter",
    label: "WHERE",
    sql: "SELECT *\nFROM input\nWHERE column1 IS NOT NULL AND column2 > 0;",
  },
  {
    key: "join",
    label: "JOIN",
    sql: "SELECT input.*, lookup.*\nFROM input\nJOIN read_csv_auto('C:/path/to/other.csv', header = true)\n  AS lookup ON input.key = lookup.key;",
  },
  {
    key: "window",
    label: "WINDOW",
    sql: "SELECT\n  column1,\n  row_number() OVER (PARTITION BY column2 ORDER BY column3) AS rn\nFROM input;",
  },
  {
    key: "pivot",
    label: "PIVOT",
    sql: "PIVOT input\nON category\nUSING sum(value)\nGROUP BY grouping_column;",
  },
  {
    key: "cte",
    label: "CTE",
    sql: "WITH filtered AS (\n  SELECT * FROM input WHERE column1 IS NOT NULL\n)\nSELECT column1, count(*) AS n FROM filtered\nGROUP BY column1;",
  },
];

/** Number of keywords/comments etc. exported for the editor. */
export const duckdbRelationHint = "input";
