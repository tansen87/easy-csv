import { XanCommand } from "@/types/xan";
import {
  CommandDialogState,
  CommandDialogType,
} from "@/components/dialog/CommandDialog";

export interface CommandFormProps {
  commandDialog: CommandDialogState;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
}

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
  drop: "Drop",
  map: "Map",
  transform: "Transform",
  enum: "Enum",
  fill: "Fill",
  complete: "Complete",
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
};
