import { useLanguage } from "@/i18n";
import type { QuickAliasLabels } from "@/modules/dialogs/quick/types";

/**
 * Resolves the alias texts and operator labels used by the quick-action forms.
 * Aliases are snapshotted into the step when applied, like v0.5.0 did.
 */
export function useQuickAliasLabels(): QuickAliasLabels {
  const { t } = useLanguage();
  return {
    filterOperator: {
      equals: t.opEquals,
      not_equals: t.opNotEquals,
      starts_with: t.opStartsWith,
      not_starts_with: t.opNotStartsWith,
      ends_with: t.opEndsWith,
      not_ends_with: t.opNotEndsWith,
      contains: t.opContains,
      not_contains: t.opNotContains,
      regex: t.opRegex,
      is_null: t.opIsNull,
      is_not_null: t.opIsNotNull,
      greater_than: ">",
      greater_or_equal: ">=",
      less_than: "<",
      less_or_equal: "<=",
    },
    sort: t.sortAlias,
    replace: t.replaceAlias,
    date: t.dateTransformAliasName,
    textTransform: t.textTransformAction,
    numberTransform: t.numTransformAction,
    slice: {
      left: t.sliceLeft,
      right: t.sliceRight,
      slice: t.sliceSlice,
      split: t.sliceSplit,
    },
    pad: {
      pad: t.padTypePad,
      lpad: t.padTypeLpad,
      rpad: t.padTypeRpad,
    },
    window: t.windowAliasName,
    batchFilter: t.batchFilter,
    pivotAgg: t.pivotAliasAgg,
    pivotGroupby: t.pivotAliasGroupby,
    pivot: t.pivotAliasPivot,
  };
}
