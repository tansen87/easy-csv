/**
 * Display layer for `commandCategories`.
 *
 * The raw English strings stay the data key - grouping, the Ctrl+K palette and
 * the existing tests all read `XanCommand.category` - so nothing here touches
 * the data. Two things live here instead:
 *
 * 1. **Order.** The catalog is read by someone adding a step, so it starts at
 *    "look at the data" and ends at "write it out". xan's own docs put `Output`
 *    first, which is the order of a reference manual, not of a workbench.
 * 2. **Short labels.** `Add, transform, drop and move columns` is 41 characters
 *    and will not fit a 140px rail or a sticky header.
 *
 * Keep this list in sync with `commandCategories`; `commandSearch.test.ts`
 * asserts both cover the same keys.
 */
export interface CommandCategoryView {
  /** Raw `XanCommand.category` value. */
  key: string;
  /** Ledger index `01`–`14`, the same numbering the settings groups use (040). */
  index: string;
  label: { zh: string; en: string };
}

export const COMMAND_CATEGORY_VIEW: readonly CommandCategoryView[] = [
  { key: "Explore & visualize", index: "01", label: { zh: "探查", en: "Explore" } },
  { key: "Search & filter", index: "02", label: { zh: "筛选", en: "Filter" } },
  { key: "Sort & deduplicate", index: "03", label: { zh: "排序去重", en: "Sort" } },
  {
    key: "Add, transform, drop and move columns",
    index: "04",
    label: { zh: "列操作", en: "Columns" },
  },
  { key: "Aggregate", index: "05", label: { zh: "聚合", en: "Aggregate" } },
  { key: "Transpose & pivot", index: "06", label: { zh: "转置透视", en: "Pivot" } },
  { key: "Combine multiple CSV files", index: "07", label: { zh: "合并文件", en: "Combine" } },
  {
    key: "Format, convert & recombobulate",
    index: "08",
    label: { zh: "格式转换", en: "Format" },
  },
  { key: "Split a CSV file into multiple", index: "09", label: { zh: "拆分", en: "Split" } },
  { key: "Generate CSV files", index: "10", label: { zh: "生成", en: "Generate" } },
  { key: "Output", index: "11", label: { zh: "输出", en: "Output" } },
  { key: "Scripting", index: "12", label: { zh: "脚本", en: "Scripting" } },
  { key: "Batch method", index: "13", label: { zh: "批量", en: "Batch" } },
  { key: "Plugins", index: "14", label: { zh: "插件", en: "Plugins" } },
];

/** Short label for a raw category key; falls back to the key itself. */
export function categoryLabel(key: string, language: "zh" | "en"): string {
  const view = COMMAND_CATEGORY_VIEW.find((entry) => entry.key === key);
  return view ? view.label[language] : key;
}
