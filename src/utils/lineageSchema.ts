import { ColumnSchema } from "@/types/xan";

/** 聚合表达式在结果里产生的列 */
export interface ParsedAggregation {
  name: string;
  fn: string;
  args: string;
}

const STRING_AGGREGATIONS = new Set([
  "first",
  "last",
  "concat",
  "join",
  "argmin",
  "argmax",
]);

/**
 * 解析聚合表达式里的别名：`sum(col("金额")) as 金额合计, count() as 单数`。
 *
 * xan 的聚合表达式是自由文本，这里只做保守解析：拿不到任何 `as 别名` 就
 * 返回空数组，让调用方退回原来的「输出列 = 输入列」行为，避免把 schema 猜错。
 */
export function parseAggregations(expression: string): ParsedAggregation[] {
  const parts: string[] = [];
  let depth = 0;
  let buffer = "";

  for (const char of expression) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(buffer);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer.trim()) parts.push(buffer);

  const result: ParsedAggregation[] = [];
  parts.forEach((part) => {
    const match = part.match(
      /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*(?:as\s+(?:"([^"]*)"|'([^']*)'|(\S+)))?\s*$/,
    );
    if (!match) return;
    const alias = match[3] || match[4] || match[5];
    if (!alias) return;
    result.push({ name: alias.trim(), fn: match[1].toLowerCase(), args: match[2] });
  });
  return result;
}

/** 聚合表达式的参数里，找到第一个真实存在的输入列 */
export function pickSourceColumn(
  args: string,
  inputSchema: ColumnSchema[],
): string | undefined {
  const tokens = args.match(/"[^"]+"|'[^']+'|[^\s(),+\-*/]+/g) || [];
  for (const raw of tokens) {
    const token = raw.replace(/^["']|["']$/g, "");
    if (inputSchema.some((column) => column.name === token)) return token;
  }
  return undefined;
}

/** groupby / agg 的聚合列，带来源列与表达式（血缘面板据此显示「生成」） */
export function aggregationColumns(
  stepId: string,
  expression: string,
  inputSchema: ColumnSchema[],
): ColumnSchema[] {
  return parseAggregations(expression).map((agg) => {
    const source = pickSourceColumn(agg.args, inputSchema);
    return {
      name: agg.name,
      type: STRING_AGGREGATIONS.has(agg.fn) ? ("string" as const) : ("number" as const),
      sourceStepId: stepId,
      sourceColumnName: source,
      expression: agg.args.trim() ? `${agg.fn}(${agg.args.trim()})` : `${agg.fn}()`,
    };
  });
}
