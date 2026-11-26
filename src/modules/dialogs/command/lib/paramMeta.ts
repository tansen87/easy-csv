import type { EffectiveLanguage } from "@/i18n/translations/types";
import type { XanCommand, XanParameter } from "@/types/xan";

/**
 * Where a parameter sits in the sheet (design 080).
 *
 * The rule is deliberately derivable: no per-command metadata to maintain, and
 * a command that ships a new flag lands in a sensible block on its own.
 */
export type ParamGroup = "required" | "common" | "advanced";

/**
 * Free-text params that still carry the point of the command, so they stay in
 * 常用 instead of falling to 高级 with the rest of the optional strings.
 */
const PRIMARY_PARAMS = new Set([
  "select",
  "selection",
  "columns",
  "columns2",
  "x",
  "y",
  "key",
  "keys",
  "sort",
  "pattern",
  "by",
  "groupby",
]);

/** Display order of the blocks, in the sheet and in the "can add" list. */
export const PARAM_GROUP_ORDER: readonly ParamGroup[] = [
  "required",
  "common",
  "advanced",
];

export function paramGroup(param: XanParameter): ParamGroup {
  if (param.required) return "required";
  if (param.type === "flag" || param.type === "select") return "common";
  if (param.default !== undefined && param.default !== "") return "common";
  if (PRIMARY_PARAMS.has(param.name)) return "common";
  return "advanced";
}

/**
 * Whether the parameter would actually reach the command line.
 *
 * Mirrors `src-tauri/src/pipeline.rs`: a flag is `--name` only when its value is
 * `true`, everything else needs a non-empty value. Defaults count — the submit
 * handler merges them into `params`, so `join-type: "inner"` is on the command.
 */
export function paramHasValue(param: XanParameter, value: unknown): boolean {
  if (param.type === "flag") return value === true || value === "true";
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * Params whose value is a column (or a comma-separated list of them): the field
 * offers the open tab's headers as chips. Kept as a name list rather than a
 * per-command flag so the 62 existing command definitions stay untouched.
 */
const COLUMN_PARAMS = new Set([
  "select",
  "selection",
  "columns",
  "columns2",
  "x",
  "y",
  "key",
  "keys",
  "by",
  "sort",
  "col",
  "column",
  "fields",
  "groupby",
  "category",
]);

export function isColumnParam(param: XanParameter): boolean {
  return param.type !== "flag" && COLUMN_PARAMS.has(param.name);
}

/** Field kinds the sheet knows beyond the four `XanParameter.type` values. */
export type ParamFieldKind =
  | "path"
  | "path-list"
  | "code"
  | "sql"
  | "lines";

/**
 * Which parameter wants a richer control than its `type` implies.
 *
 * Kept as an explicit table instead of another data field: only a handful of
 * parameters take a filesystem path, and the mapping is what documents that
 * `cat --inputs` is a list of files while `cat --glob` is only a pattern.
 */
export interface ParamField {
  kind: ParamFieldKind;
  /**
   * How a list is written back. Omitted means an array (what `cat --inputs`
   * already stores); a string means join with it — `batch-from` keeps its
   * sources in one `;`-separated string and the batch runner splits on that.
   */
  join?: string;
  /** Offer a folder picker next to the file picker (batch-from). */
  folders?: boolean;
}

const FIELD_KINDS: Record<string, ParamField> = {
  "map.expression": { kind: "code" },
  "duckdb.sql": { kind: "sql" },
  "cat.inputs": { kind: "path-list" },
  "batch-from.source-path": { kind: "path-list", join: ";", folders: true },
  "batch-to.output-dir": { kind: "path" },
  "scrape.evaluate-file": { kind: "path" },
  "batch-search.manual-values": { kind: "lines" },
  "batch-search.output-dir": { kind: "path" },
};

/**
 * Whether a parameter applies to the current values.
 *
 * Only `visibleWhen` hides a field; everything else is always shown. The sheet
 * drops hidden parameters from the command line, the required count and the
 * submit payload, so switching `filter-type` cannot leave a stale operator on
 * the command.
 */
export function isParamVisible(
  param: XanParameter,
  values: Record<string, unknown>,
): boolean {
  const condition = param.visibleWhen;
  if (!condition) return true;
  return condition.equals.includes(String(values[condition.param] ?? ""));
}

export function paramField(
  commandId: string,
  paramName: string,
): ParamField | undefined {
  return FIELD_KINDS[`${commandId}.${paramName}`];
}

export function paramFieldKind(
  commandId: string,
  paramName: string,
): ParamFieldKind | undefined {
  return paramField(commandId, paramName)?.kind;
}

/**
 * Parameters that open the real xan expression editor (design 056) instead of a
 * one-line input.
 *
 * Only `map --expression` had that editor before the sheet arrived; the other
 * expression parameters (`filter`, `agg`, `window`, `transform`, `pivot`, `eval`)
 * never did, so they keep the plain field rather than inventing a change.
 */
export function isExpressionEditorParam(
  commandId: string,
  paramName: string,
): boolean {
  return paramFieldKind(commandId, paramName) === "code";
}

/** The SQL editor is the duckdb command's whole interface. */
export function isSqlEditorParam(
  commandId: string,
  paramName: string,
): boolean {
  return paramFieldKind(commandId, paramName) === "sql";
}

interface Label {
  zh: string;
  en: string;
}

/**
 * Field labels. The xan definitions only carry a sentence, not a name, so a
 * curated label per command is the smallest honest source of "人话名"; anything
 * not covered falls back to the global name, and finally to the flag itself.
 */
const COMMAND_LABELS: Record<string, Label> = {
  "join.columns": { zh: "连接列", en: "Join columns" },
  "join.columns2": { zh: "右表键列", en: "Right key columns" },
  "join.input1": { zh: "左表文件", en: "Left file" },
  "join.input2": { zh: "右表文件", en: "Right file" },
  "join.join-type": { zh: "连接类型", en: "Join type" },
  "join.contains": { zh: "按子串模糊匹配", en: "Match by substring" },
  "join.regex": { zh: "按正则匹配", en: "Match by regex" },
  "join.url-prefix": { zh: "按网址前缀匹配", en: "Match by URL prefix" },
  "join.ignore-case": { zh: "忽略大小写", en: "Ignore case" },
  "join.nulls": { zh: "空值也算匹配", en: "Nulls match" },
  "join.drop-key": { zh: "丢掉重复的键列", en: "Drop duplicate key" },
  "join.prefix-left": { zh: "左表列前缀", en: "Left prefix" },
  "join.prefix-right": { zh: "右表列前缀", en: "Right prefix" },
  "dedup.select": { zh: "去重的列", en: "Columns" },
  "dedup.check": { zh: "只验证不输出", en: "Validate only" },
  "dedup.sorted": { zh: "文件已按这些列排序", en: "File already sorted" },
  "dedup.keep-last": { zh: "保留最后一行", en: "Keep last row" },
  "dedup.keep-duplicates": { zh: "只输出重复的行", en: "Only duplicated rows" },
  "dedup.external": { zh: "索引放磁盘", en: "Index on disk" },
  "dedup.choose": { zh: "用表达式决定留哪行", en: "Choose by expression" },
  "dedup.boolean": { zh: "加一列标记", en: "Add a flag column" },
  "batch-search.column": { zh: "过滤列", en: "Filter column" },
  "batch-search.filter-type": { zh: "值类型", en: "Filter type" },
  "batch-search.text-operator": { zh: "文本条件", en: "Text operator" },
  "batch-search.number-operator": { zh: "数字条件", en: "Number operator" },
  "batch-search.value-mode": { zh: "值来源", en: "Value source" },
  "batch-search.manual-values": { zh: "值（一行一个）", en: "Values, one per line" },
  "batch-search.extract-column": { zh: "取值列", en: "Extract column" },
  "batch-search.output-dir": { zh: "输出目录", en: "Output folder" },
  "batch-search.case-insensitive": { zh: "忽略大小写", en: "Ignore case" },
  "chart.chart-type": { zh: "图表类型", en: "Chart type" },
  "plot.aggregate": { zh: "聚合方式", en: "Aggregate" },
  "plot.marker": { zh: "点样式", en: "Marker" },
  "plot.granularity": { zh: "时间粒度", en: "Granularity" },
  "plot.x-scale": { zh: "横轴刻度", en: "X scale" },
  "plot.y-scale": { zh: "纵轴刻度", en: "Y scale" },
  "plot.density-scale": { zh: "密度刻度", en: "Density scale" },
  "select.selection": { zh: "选出的列", en: "Selected columns" },
  "select.evaluate": { zh: "按表达式计算", en: "Evaluate expression" },
  "select.evaluate-file": { zh: "表达式文件", en: "Expression file" },
};

const NAME_LABELS: Record<string, Label> = {
  select: { zh: "列", en: "Columns" },
  selection: { zh: "列", en: "Columns" },
  columns: { zh: "列", en: "Columns" },
  columns2: { zh: "右表列", en: "Right columns" },
  x: { zh: "横轴列", en: "X axis" },
  y: { zh: "纵轴列", en: "Y axis" },
  key: { zh: "键列", en: "Key" },
  keys: { zh: "键列", en: "Keys" },
  sort: { zh: "排序列", en: "Sort by" },
  category: { zh: "分组列", en: "Group" },
  by: { zh: "分组列", en: "Group" },
  pattern: { zh: "匹配模式", en: "Pattern" },
  input1: { zh: "左表文件", en: "Left file" },
  input2: { zh: "右表文件", en: "Right file" },
  "join-type": { zh: "连接类型", en: "Join type" },
};

/**
 * The plain-language name of a parameter.
 *
 * Curated labels win where they exist (the three commands the sheet shipped
 * with). Everything else falls back to the parameter's own description, which
 * every command already carries in both languages — so a newly enabled command
 * reads like the curated ones without a 200-entry label table.
 */
/**
 * Human labels for enum values that are too cryptic to show raw in a picker.
 * Keyed by `command.param.value`, so `bar` means 柱状图 for a chart type and
 * 竖条 for a plot marker — the same word, two different meanings.
 */
const OPTION_LABELS: Record<string, Label> = {
  "chart.chart-type.line": { zh: "折线图", en: "Line" },
  "chart.chart-type.scatter": { zh: "散点图", en: "Scatter" },
  "chart.chart-type.bar": { zh: "柱状图", en: "Bar" },
  "chart.chart-type.histogram": { zh: "直方图", en: "Histogram" },
  "chart.chart-type.pie": { zh: "饼图", en: "Pie" },
  "chart.chart-type.wordcloud": { zh: "词云", en: "Word cloud" },
  "chart.chart-type.heatmap": { zh: "热力图", en: "Heatmap" },
  "plot.aggregate.sum": { zh: "求和", en: "Sum" },
  "plot.aggregate.mean": { zh: "平均", en: "Mean" },
  "plot.marker.braille": { zh: "盲文点", en: "Braille" },
  "plot.marker.dot": { zh: "点", en: "Dot" },
  "plot.marker.halfblock": { zh: "半块", en: "Half block" },
  "plot.marker.bar": { zh: "竖条", en: "Bar" },
  "plot.marker.block": { zh: "实心块", en: "Block" },
  "plot.granularity.years": { zh: "按年", en: "Years" },
  "plot.granularity.months": { zh: "按月", en: "Months" },
  "plot.granularity.days": { zh: "按天", en: "Days" },
  "plot.granularity.hours": { zh: "按小时", en: "Hours" },
  "plot.granularity.minutes": { zh: "按分钟", en: "Minutes" },
  "plot.granularity.seconds": { zh: "按秒", en: "Seconds" },
  "batch-search.filter-type.text": { zh: "文本", en: "Text" },
  "batch-search.filter-type.number": { zh: "数字", en: "Number" },
  "batch-search.value-mode.manual": { zh: "手动输入", en: "Manual" },
  "batch-search.value-mode.column": { zh: "从列读取", en: "From a column" },
  "batch-search.text-operator.equals": { zh: "等于", en: "Equals" },
  "batch-search.text-operator.not_equals": { zh: "不等于", en: "Not equals" },
  "batch-search.text-operator.starts_with": { zh: "开头是", en: "Starts with" },
  "batch-search.text-operator.not_starts_with": { zh: "开头不是", en: "Not starts with" },
  "batch-search.text-operator.ends_with": { zh: "结尾是", en: "Ends with" },
  "batch-search.text-operator.not_ends_with": { zh: "结尾不是", en: "Not ends with" },
  "batch-search.text-operator.contains": { zh: "包含", en: "Contains" },
  "batch-search.text-operator.not_contains": { zh: "不包含", en: "Not contains" },
  "batch-search.text-operator.regex": { zh: "正则匹配", en: "Regex" },
  "batch-search.text-operator.is_null": { zh: "为空", en: "Is empty" },
  "batch-search.text-operator.is_not_null": { zh: "不为空", en: "Is not empty" },
  "batch-search.number-operator.equals": { zh: "==", en: "==" },
  "batch-search.number-operator.not_equals": { zh: "!=", en: "!=" },
  "batch-search.number-operator.greater_than": { zh: ">", en: ">" },
  "batch-search.number-operator.greater_or_equal": { zh: ">=", en: ">=" },
  "batch-search.number-operator.less_than": { zh: "<", en: "<" },
  "batch-search.number-operator.less_or_equal": { zh: "<=", en: "<=" },
};

/** Display label for one enum value; falls back to the value itself. */
export function optionLabel(
  commandId: string,
  paramName: string,
  value: string,
  language: EffectiveLanguage = "zh",
): string {
  const label = OPTION_LABELS[`${commandId}.${paramName}.${value}`];
  if (!label) return value;
  return language === "zh" ? label.zh : label.en;
}

export function paramLabel(
  command: XanCommand,
  param: XanParameter,
  language: EffectiveLanguage = "zh",
): string {
  const curated = COMMAND_LABELS[`${command.id}.${param.name}`];
  if (curated) return language === "zh" ? curated.zh : curated.en;

  // The description beats the global name map: `sort --columns` means "sort the
  // columns alphabetically", and a bare "列" would be actively misleading.
  const described =
    language === "zh"
      ? param.descriptionCn?.trim() || param.description?.trim()
      : param.description?.trim() || param.descriptionCn?.trim();
  if (described) return described;

  const generic = NAME_LABELS[param.name];
  if (generic) return language === "zh" ? generic.zh : generic.en;
  return param.name;
}
