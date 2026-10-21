/**
 * Shared dialog types.
 *
 * Sunk here from `components/dialog/CommandDialog.tsx` and
 * `components/dialog/commands/types.ts` to break the
 * `CommandDialog` ⇄ `commands/` dependency cycle.
 *
 * Dependency direction after the move:
 *
 *   CommandDialog.tsx ─┐
 *                      ├─→ types/dialog.ts
 *   commands/index.ts ─┘
 *
 * This module must stay free of component imports.
 */
import type { XanCommand } from "@/types/xan";

/** Union of every command id that has a parameter form. */
export type CommandDialogType =
  | "search"
  | "bisect"
  | "filter"
  | "sort"
  | "select"
  | "view"
  | "count"
  | "slice"
  | "head"
  | "tail"
  | "sample"
  | "dedup"
  | "shuffle"
  | "frequency"
  | "groupby"
  | "stats"
  | "agg"
  | "bins"
  | "window"
  | "headers"
  | "flatten"
  | "hist"
  | "plot"
  | "chart"
  | "drop"
  | "map"
  | "transform"
  | "enum"
  | "fill"
  | "complete"
  | "blank"
  | "separate"
  | "top"
  | "cat"
  | "join"
  | "merge"
  | "rename"
  | "behead"
  | "fixlengths"
  | "explode"
  | "implode"
  | "input"
  | "scrape"
  | "fmt"
  | "to"
  | "from"
  | "reverse"
  | "transpose"
  | "pivot"
  | "unpivot"
  | "split"
  | "partition"
  | "range"
  | "run"
  | "eval"
  | "output"
  | "batch-filter"
  | "batch-from"
  | "batch-to"
  | "pinyin"
  | "duckdb";

/** Single state object describing the currently open command dialog. */
export interface CommandDialogState {
  type: CommandDialogType;
  params: Record<string, any>;
  isUpdate?: boolean;
  stepId?: string;
}

/** Props every command parameter form receives. */
export interface CommandFormProps {
  commandDialog: CommandDialogState;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
}

/** Human-readable title for each command dialog. */
export const COMMAND_LABELS: Record<CommandDialogType, string> = {
  search: "Search",
  bisect: "Bisect",
  filter: "Filter",
  sort: "Sort",
  select: "Select",
  view: "View",
  count: "Count",
  slice: "Slice",
  head: "Head",
  tail: "Tail",
  sample: "Sample",
  dedup: "Dedup",
  shuffle: "Shuffle",
  frequency: "Frequency",
  groupby: "Group By",
  stats: "Stats",
  agg: "Agg",
  bins: "Bins",
  window: "Window",
  headers: "Headers",
  flatten: "Flatten",
  hist: "Hist",
  plot: "Plot",
  chart: "Chart",
  drop: "Drop",
  map: "Map",
  transform: "Transform",
  enum: "Enum",
  fill: "Fill",
  complete: "Complete",
  blank: "Blank",
  separate: "Separate",
  top: "Top",
  cat: "Cat",
  join: "Join",
  merge: "Merge",
  rename: "Rename",
  behead: "Behead",
  fixlengths: "Fix Lengths",
  explode: "Explode",
  implode: "Implode",
  input: "Input",
  scrape: "Scrape",
  fmt: "Format",
  to: "To",
  from: "From",
  reverse: "Reverse",
  transpose: "Transpose",
  pivot: "Pivot",
  unpivot: "Unpivot",
  split: "Split",
  partition: "Partition",
  range: "Range",
  run: "Run",
  eval: "Eval",
  output: "Output",
  "batch-filter": "Batch Filter",
  "batch-from": "Batch From",
  "batch-to": "Batch To",
  pinyin: "Pinyin",
  duckdb: "DuckDB SQL",
};

// --- canvas entry kinds -----------------------------------------------------
//
// The table context menu knows *which* transform sub-entry the user picked.
// `QuickActionRequest` (modules/dialogs/quick/types.ts) carries these kinds to
// the guided dialog, whose pure builder turns them into xan parameters.

export type TextTransformKind =
  | "len"
  | "lower"
  | "upper"
  | "trim"
  | "ltrim"
  | "rtrim"
  | "strip";

export type NumberTransformKind =
  | "abs"
  | "neg"
  | "floor"
  | "ceil"
  | "int"
  | "float"
  | "round";

/** `splitLeft`/`splitRight` in the menu are normalised to `left`/`right`. */
export type SliceKind = "left" | "right" | "slice" | "split";

export type PadKind = "pad" | "lpad";

export type QuickActionKind =
  | "filter"
  | "sort"
  | "replace"
  | "pivot"
  | "date"
  | "text-transform"
  | "number-transform"
  | "slice"
  | "pad"
  | "window"
  | "batch-filter";

/** Everything the table context menu knows when a quick action is opened. */
export interface QuickActionRequest {
  kind: QuickActionKind;
  /** Right-click coordinates, used to anchor the floating dialog. */
  x: number;
  y: number;
  /** Index of the right-clicked column (absent for pivot / batch filter). */
  col?: number;
  headers: string[];
  /** Sub-kind preselected by the menu sub-item. */
  textTransform?: TextTransformKind;
  numberTransform?: NumberTransformKind;
  slice?: SliceKind;
  pad?: PadKind;
}
