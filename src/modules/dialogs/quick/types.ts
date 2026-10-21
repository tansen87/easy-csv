/**
 * Types for the right-click quick-action dialogs.
 *
 * These are intentionally separate from `CommandDialogState`: a quick action is
 * a guided draft (column selects, operator dropdowns, replace pairs...) that is
 * translated into xan parameters by `buildQuickCommand`. The unified
 * `CommandDialog` remains the advanced editor.
 */
import type {
  CommandDialogType,
  NumberTransformKind,
  QuickActionKind,
  QuickActionRequest,
  SliceKind,
  TextTransformKind,
} from "@/types/dialog";

export type { QuickActionKind, QuickActionRequest };

export type TextFilterOperator =
  | "equals"
  | "not_equals"
  | "starts_with"
  | "not_starts_with"
  | "ends_with"
  | "not_ends_with"
  | "contains"
  | "not_contains"
  | "regex"
  | "is_null"
  | "is_not_null";

export type NumberFilterOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_or_equal"
  | "less_than"
  | "less_or_equal";

export interface ReplacePairDraft {
  pattern: string;
  replace: string;
  regex: boolean;
  ignoreCase: boolean;
}

/** `PadDialog` in v0.5.0 offered three padding functions. */
export type PadDraftKind = "pad" | "lpad" | "rpad";

export interface PivotValueDraft {
  column: string;
  aggregation: string;
}

export interface WindowEntryDraft {
  column: string;
  func: string;
  alias: string;
  windowSize: string;
}

export interface FilterDraft {
  kind: "filter";
  mode: "text" | "number";
  column: string;
  textOperator: TextFilterOperator;
  numberOperator: NumberFilterOperator;
  values: string[];
  numberValue: string;
  ignoreCase: boolean;
}

export interface SortDraft {
  kind: "sort";
  columns: string[];
  order: "asc" | "desc";
  numeric: boolean;
}

export interface ReplaceDraft {
  kind: "replace";
  column: string;
  pairs: ReplacePairDraft[];
}

export interface PivotDraft {
  kind: "pivot";
  columns: string[];
  groupBy: string[];
  values: PivotValueDraft[];
  columnSep: string;
}

export interface DateDraft {
  kind: "date";
  column: string;
  inputFormat: string;
  outputFormat: string;
  outputColumn: string;
}

export interface TextTransformDraft {
  kind: "text-transform";
  columns: string[];
  transform: TextTransformKind;
}

export interface NumberTransformDraft {
  kind: "number-transform";
  columns: string[];
  transform: NumberTransformKind;
}

export interface SliceDraft {
  kind: "slice";
  column: string;
  sliceType: SliceKind;
  leftLength: string;
  rightLength: string;
  sliceStart: string;
  sliceEnd: string;
  separator: string;
  customSeparator: string;
  indices: string[];
  joinWith: string;
  outputColumn: string;
}

export interface PadDraft {
  kind: "pad";
  column: string;
  padType: PadDraftKind;
  width: string;
  char: string;
}

export interface WindowDraft {
  kind: "window";
  groupBy: string;
  entries: WindowEntryDraft[];
}

export interface BatchFilterDraft {
  kind: "batch-filter";
  params: Record<string, any>;
}

export type QuickDraft =
  | FilterDraft
  | SortDraft
  | ReplaceDraft
  | PivotDraft
  | DateDraft
  | TextTransformDraft
  | NumberTransformDraft
  | SliceDraft
  | PadDraft
  | WindowDraft
  | BatchFilterDraft;

export interface QuickBuildResult {
  type: CommandDialogType;
  params: Record<string, any>;
  alias: string;
}

/** Alias texts resolved from i18n by `useQuickAliasLabels()`. */
export interface QuickAliasLabels {
  filterOperator: Record<string, string>;
  sort: string;
  replace: string;
  date: string;
  textTransform: string;
  numberTransform: string;
  slice: Record<SliceKind, string>;
  pad: Record<PadDraftKind, string>;
  window: string;
  batchFilter: string;
  pivotAgg: string;
  pivotGroupby: string;
  pivot: string;
}

/** Props shared by every quick form. */
export interface QuickFormProps {
  request: QuickActionRequest;
  onApply: (result: QuickBuildResult) => void;
  onAdvanced: (result: QuickBuildResult) => void;
  onClose: () => void;
}
