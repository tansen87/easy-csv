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
  return commandId === "map" && paramName === "expression";
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
