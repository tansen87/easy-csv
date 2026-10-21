/** Window expressions carried over from the v0.5.0 window dialog. */
export interface WindowFunction {
  value: string;
  hasWindowSize: boolean;
}

export const WINDOW_EXPRS: WindowFunction[] = [
  { value: "cume_dist", hasWindowSize: false },
  { value: "cummax", hasWindowSize: false },
  { value: "cummin", hasWindowSize: false },
  { value: "cumsum", hasWindowSize: false },
  { value: "dense_rank", hasWindowSize: false },
  { value: "frac", hasWindowSize: false },
  { value: "front_coding", hasWindowSize: false },
  { value: "lag", hasWindowSize: false },
  { value: "lead", hasWindowSize: false },
  { value: "ntile", hasWindowSize: true },
  { value: "percent_rank", hasWindowSize: false },
  { value: "rank", hasWindowSize: false },
  { value: "rolling_avg", hasWindowSize: true },
  { value: "rolling_mean", hasWindowSize: true },
  { value: "rolling_stddev", hasWindowSize: true },
  { value: "rolling_sum", hasWindowSize: true },
  { value: "rolling_var", hasWindowSize: true },
  { value: "row_index", hasWindowSize: false },
  { value: "row_number", hasWindowSize: false },
];

export const DEFAULT_WINDOW_SIZE = "10";

export function buildWindowExpression(
  column: string,
  funcName: string,
  alias: string,
  windowSize: string,
): string {
  const func =
    WINDOW_EXPRS.find((f) => f.value === funcName) || WINDOW_EXPRS[0];
  let expr: string;

  if (func.value === "ntile" || func.hasWindowSize) {
    expr = `${func.value}(${windowSize || DEFAULT_WINDOW_SIZE}, col("${column}"))`;
  } else if (func.value === "lag" || func.value === "lead") {
    expr = `${func.value}(col("${column}"))`;
  } else if (func.value === "row_index" || func.value === "row_number") {
    expr = `${func.value}()`;
  } else {
    expr = `${func.value}(col("${column}"))`;
  }

  if (alias.trim()) {
    expr += ` as "${alias.trim()}"`;
  }
  return expr;
}
