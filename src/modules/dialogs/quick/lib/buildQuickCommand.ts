/**
 * Pure translation from a guided quick-action draft to xan command parameters.
 *
 * This is the single place where the v0.5.0 dialogs' "friendly fields -> xan
 * arguments" rules live. It mirrors their Apply handlers exactly, so the
 * restored dialogs produce the same pipeline steps as they used to.
 */
import type { NumberTransformKind, TextTransformKind } from "@/types/dialog";
import type {
  FilterDraft,
  NumberFilterOperator,
  QuickAliasLabels,
  QuickBuildResult,
  QuickDraft,
  TextFilterOperator,
} from "@/modules/dialogs/quick/types";
import { buildWindowExpression } from "@/modules/dialogs/quick/lib/windowFunctions";

const TEXT_TRANSFORMS: Record<TextTransformKind, (col: string) => string> = {
  len: (col) => `col("${col}").len() as "${col}"`,
  lower: (col) => `col("${col}").lower() as "${col}"`,
  upper: (col) => `col("${col}").upper() as "${col}"`,
  trim: (col) => `col("${col}").trim() as "${col}"`,
  ltrim: (col) => `col("${col}").ltrim() as "${col}"`,
  rtrim: (col) => `col("${col}").rtrim() as "${col}"`,
  strip: (col) => `replace(col("${col}"), /[\\r\\t\\n]/, "") as "${col}"`,
};

const NUMBER_TRANSFORMS: Record<NumberTransformKind, (col: string) => string> =
  {
    abs: (col) => `abs(col("${col}")) as "${col}"`,
    neg: (col) => `neg(col("${col}")) as "${col}"`,
    floor: (col) => `floor(col("${col}")) as "${col}"`,
    ceil: (col) => `ceil(col("${col}")) as "${col}"`,
    int: (col) => `trunc(col("${col}")) as "${col}"`,
    float: (col) => `float(col("${col}")) as "${col}"`,
    round: (col) => `to_fixed(round(col("${col}"), 0.01), 2) as "${col}"`,
  };

const NUMBER_SYMBOLS: Record<NumberFilterOperator, string> = {
  equals: "==",
  not_equals: "!=",
  greater_than: ">",
  greater_or_equal: ">=",
  less_than: "<",
  less_or_equal: "<=",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textPattern(operator: TextFilterOperator, value: string): string {
  const escaped = escapeRegex(value);
  switch (operator) {
    case "starts_with":
    case "not_starts_with":
      return `^${escaped}`;
    case "ends_with":
    case "not_ends_with":
      return `${escaped}$`;
    case "contains":
    case "not_contains":
      return escaped;
    case "regex":
      return value;
    default:
      return escaped;
  }
}

function escapeLeadingDash(operator: TextFilterOperator, value: string) {
  const isContains = operator === "contains" || operator === "not_contains";
  return isContains && value.startsWith("-") ? `\\${value}` : value;
}

function buildFilter(
  draft: FilterDraft,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (!draft.column) return null;
  const alias = labels.filterOperator[draft.textOperator] ?? draft.textOperator;

  if (draft.mode === "number") {
    if (!draft.numberValue.trim()) return null;
    const symbol = NUMBER_SYMBOLS[draft.numberOperator];
    return {
      type: "filter",
      params: {
        expression: `col("${draft.column}") ${symbol} ${draft.numberValue.trim()}`,
        parallel: false,
        threads: undefined,
      },
      alias: labels.filterOperator[draft.numberOperator] ?? symbol,
    };
  }

  if (draft.textOperator === "is_null") {
    return { type: "search", params: { select: draft.column, empty: true }, alias };
  }
  if (draft.textOperator === "is_not_null") {
    return {
      type: "search",
      params: { select: draft.column, "non-empty": true },
      alias,
    };
  }

  const values = draft.values.map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return null;

  if (draft.textOperator === "equals" || draft.textOperator === "not_equals") {
    return {
      type: "search",
      params: {
        select: draft.column,
        exact: true,
        pattern: values[0],
        "add-pattern": values.slice(1),
        "ignore-case": draft.ignoreCase,
        "invert-match": draft.textOperator === "not_equals",
      },
      alias,
    };
  }

  return {
    type: "search",
    params: {
      select: draft.column,
      pattern: escapeLeadingDash(
        draft.textOperator,
        textPattern(draft.textOperator, values[0]),
      ),
      "add-pattern": values
        .slice(1)
        .map((v) =>
          escapeLeadingDash(draft.textOperator, textPattern(draft.textOperator, v)),
        ),
      regex: true,
      "ignore-case": draft.ignoreCase,
      "invert-match":
        draft.textOperator === "not_starts_with" ||
        draft.textOperator === "not_ends_with" ||
        draft.textOperator === "not_contains",
    },
    alias,
  };
}

function buildReplace(
  draft: Extract<QuickDraft, { kind: "replace" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (!draft.column) return null;
  const pairs = draft.pairs.filter((p) => p.pattern.trim());
  if (pairs.length === 0) return null;

  const expression =
    pairs.reduce((acc, pair) => {
      const patternExpr = pair.regex
        ? `/${pair.pattern}/${pair.ignoreCase ? "i" : ""}`
        : `"${pair.pattern}"`;
      return `replace(${acc}, ${patternExpr}, "${pair.replace}")`;
    }, `col("${draft.column}")`) + ` as "${draft.column}"`;

  return {
    type: "map",
    params: { expression, overwrite: true, output: "" },
    alias: labels.replace,
  };
}

function buildDate(
  draft: Extract<QuickDraft, { kind: "date" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (!draft.column || !draft.inputFormat || !draft.outputFormat) return null;
  const outputName = draft.outputColumn.trim();
  const expression = `strftime(datetime(col("${draft.column}"), "${draft.inputFormat}"), "${draft.outputFormat}")`;
  return {
    type: "map",
    params: {
      expression: outputName ? `${expression} as "${outputName}"` : expression,
      output: "",
      overwrite: outputName === draft.column,
    },
    alias: labels.date,
  };
}

function buildTextTransform(
  draft: Extract<QuickDraft, { kind: "text-transform" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (draft.columns.length === 0) return null;
  return {
    type: "map",
    params: {
      expression: draft.columns
        .map((col) => TEXT_TRANSFORMS[draft.transform](col))
        .join(", "),
      overwrite: true,
      output: "",
    },
    alias: labels.textTransform,
  };
}

function buildNumberTransform(
  draft: Extract<QuickDraft, { kind: "number-transform" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (draft.columns.length === 0) return null;
  return {
    type: "map",
    params: {
      expression: draft.columns
        .map((col) => NUMBER_TRANSFORMS[draft.transform](col))
        .join(", "),
      overwrite: true,
      output: "",
    },
    alias: labels.numberTransform,
  };
}

function buildSlice(
  draft: Extract<QuickDraft, { kind: "slice" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (!draft.column) return null;
  const ref = `col("${draft.column}")`;
  let expression: string;

  switch (draft.sliceType) {
    case "left":
      expression = `${ref}[:${draft.leftLength}]`;
      break;
    case "right":
      expression = `${ref}[-${draft.rightLength}:]`;
      break;
    case "slice":
      expression = `${ref}[${draft.sliceStart}:${draft.sliceEnd}]`;
      break;
    case "split": {
      if (draft.separator === "custom" && !draft.customSeparator) return null;
      const actualSeparator =
        draft.separator === "custom" ? draft.customSeparator : draft.separator;
      const indices = draft.indices.filter((i) => i.trim() !== "");
      const splitExpr = `split(${ref}, "${actualSeparator}")`;

      if (indices.length === 0) {
        expression = splitExpr;
      } else if (indices.length === 1) {
        expression = `${splitExpr}[${indices[0]}]`;
      } else {
        const join = draft.joinWith || "";
        expression = indices
          .map((i) => `${splitExpr}[${i}]`)
          .join(` ++ "${join}" ++ `);
      }
      break;
    }
  }

  const outputName = draft.outputColumn.trim();
  return {
    type: "map",
    params: {
      expression: outputName ? `${expression} as "${outputName}"` : expression,
      output: "",
      overwrite: outputName === draft.column,
    },
    alias: labels.slice[draft.sliceType],
  };
}

function buildPad(
  draft: Extract<QuickDraft, { kind: "pad" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  const width = parseInt(draft.width, 10);
  if (!draft.column || !width || width <= 0) return null;
  const char = draft.char.trim();
  const expression = char
    ? `${draft.padType}(col("${draft.column}"), ${width}, "${char}") as "${draft.column}"`
    : `${draft.padType}(col("${draft.column}"), ${width}) as "${draft.column}"`;
  return {
    type: "map",
    params: { expression, overwrite: true, output: "" },
    alias: labels.pad[draft.padType],
  };
}

function buildPivot(
  draft: Extract<QuickDraft, { kind: "pivot" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  if (draft.values.length === 0) return null;

  const columnsExpr = draft.values
    .map((vc) => {
      const col = `"${vc.column}"`;
      if (vc.aggregation === "count") {
        return `count(col(${col})) as ${col}`;
      }
      return `${vc.aggregation}(col(${col})) as ${col}`;
    })
    .join(",");

  if (draft.columns.length === 0 && draft.groupBy.length === 0) {
    return {
      type: "agg",
      params: { expression: columnsExpr, output: "" },
      alias: labels.pivotAgg,
    };
  }

  const groupByExpr = draft.groupBy.map((col) => `"${col}"`).join(",");

  if (draft.columns.length === 0) {
    return {
      type: "groupby",
      params: { columns: groupByExpr, expression: columnsExpr, output: "" },
      alias: labels.pivotGroupby,
    };
  }

  return {
    type: "pivot",
    params: {
      columns: draft.columns.map((col) => `"${col}"`).join(","),
      expr: columnsExpr,
      groupby: groupByExpr || undefined,
      "column-sep": draft.columnSep || "_",
      output: "",
    },
    alias: labels.pivot,
  };
}

function buildWindow(
  draft: Extract<QuickDraft, { kind: "window" }>,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  const entries = draft.entries.filter((e) => e.column.trim());
  if (entries.length === 0) return null;

  return {
    type: "window",
    params: {
      expression: entries
        .map((e) =>
          buildWindowExpression(e.column, e.func, e.alias, e.windowSize),
        )
        .join(", "),
      groupby: draft.groupBy.trim() || undefined,
      output: "",
    },
    alias: labels.window,
  };
}

export function buildQuickCommand(
  draft: QuickDraft,
  labels: QuickAliasLabels,
): QuickBuildResult | null {
  switch (draft.kind) {
    case "filter":
      return buildFilter(draft, labels);
    case "sort":
      if (draft.columns.length === 0) return null;
      return {
        type: "sort",
        params: {
          select: draft.columns.join(","),
          output: "",
          reverse: draft.order === "desc",
          numeric: draft.numeric,
        },
        alias: labels.sort,
      };
    case "replace":
      return buildReplace(draft, labels);
    case "pivot":
      return buildPivot(draft, labels);
    case "date":
      return buildDate(draft, labels);
    case "text-transform":
      return buildTextTransform(draft, labels);
    case "number-transform":
      return buildNumberTransform(draft, labels);
    case "slice":
      return buildSlice(draft, labels);
    case "pad":
      return buildPad(draft, labels);
    case "window":
      return buildWindow(draft, labels);
    case "batch-filter":
      return {
        type: "batch-filter",
        params: draft.params,
        alias: labels.batchFilter,
      };
    default:
      return null;
  }
}
