import { ComponentType } from "react";
import { CommandFormProps } from "@/components/dialog/commands/types";
import { CommandDialogType } from "@/components/dialog/CommandDialog";
import {
  CountForm,
  HeadersForm,
  ViewForm,
  FlattenForm,
  HistForm,
  PlotForm,
} from "@/components/dialog/commands/ExploreForms";
import {
  SearchForm,
  FilterForm,
  HeadForm,
  TailForm,
  SliceForm,
  TopForm,
  SampleForm,
  BisectForm,
} from "@/components/dialog/commands/SearchFilterForms";
import {
  SortForm,
  DedupForm,
  ShuffleForm,
} from "@/components/dialog/commands/SortDedupForms";
import {
  FrequencyForm,
  GroupbyForm,
  StatsForm,
  AggForm,
  BinsForm,
  WindowForm,
} from "@/components/dialog/commands/AggregateForms";
import {
  CatForm,
  JoinForm,
  MergeForm,
} from "@/components/dialog/commands/CombineForms";
import {
  SelectForm,
  DropForm,
  MapForm,
  TransformForm,
  EnumForm,
  FillForm,
  CompleteForm,
  BlankForm,
  SeparateForm,
} from "@/components/dialog/commands/TransformForms";
import {
  BeheadForm,
  RenameForm,
  InputForm,
  FixlengthsForm,
  FmtForm,
  ExplodeForm,
  ImplodeForm,
  FromForm,
  ToForm,
  ScrapeForm,
  ReverseForm,
} from "@/components/dialog/commands/FormatForms";
import {
  TransposeForm,
  PivotForm,
  UnpivotForm,
} from "@/components/dialog/commands/TransposePivotForms";
import {
  SplitForm,
  PartitionForm,
} from "@/components/dialog/commands/PartitionForms";
import { RangeForm } from "@/components/dialog/commands/GenerateForms";
import { RunForm, EvalForm } from "@/components/dialog/commands/ScriptingForms";
import {
  OutputForm,
  BatchFilterForm,
  BatchFromForm,
  BatchToForm,
} from "@/components/dialog/commands/CustomForms";

export const COMMAND_FORMS: Record<
  CommandDialogType,
  ComponentType<CommandFormProps>
> = {
  // Explore & visualize
  count: CountForm,
  headers: HeadersForm,
  view: ViewForm,
  flatten: FlattenForm,
  hist: HistForm,
  plot: PlotForm,

  // Search & filter
  search: SearchForm,
  filter: FilterForm,
  head: HeadForm,
  tail: TailForm,
  slice: SliceForm,
  top: TopForm,
  sample: SampleForm,
  bisect: BisectForm,

  // Sort & deduplicate
  sort: SortForm,
  dedup: DedupForm,
  shuffle: ShuffleForm,

  // Aggregate
  frequency: FrequencyForm,
  groupby: GroupbyForm,
  stats: StatsForm,
  agg: AggForm,
  bins: BinsForm,
  window: WindowForm,

  // Combine multiple CSV files
  cat: CatForm,
  join: JoinForm,
  merge: MergeForm,

  // Add, transform, drop and move columns
  select: SelectForm,
  drop: DropForm,
  map: MapForm,
  transform: TransformForm,
  enum: EnumForm,
  fill: FillForm,
  complete: CompleteForm,
  blank: BlankForm,
  separate: SeparateForm,

  // Format, convert & recombobulate
  behead: BeheadForm,
  rename: RenameForm,
  input: InputForm,
  fixlengths: FixlengthsForm,
  fmt: FmtForm,
  explode: ExplodeForm,
  implode: ImplodeForm,
  from: FromForm,
  to: ToForm,
  scrape: ScrapeForm,
  reverse: ReverseForm,

  // Transpose & pivot
  transpose: TransposeForm,
  pivot: PivotForm,
  unpivot: UnpivotForm,

  // Split a CSV file into multiple
  split: SplitForm,
  partition: PartitionForm,

  // Generate CSV files
  range: RangeForm,

  // Scripting
  run: RunForm,
  eval: EvalForm,

  // Custom method
  output: OutputForm,
  "batch-filter": BatchFilterForm,
  "batch-from": BatchFromForm,
  "batch-to": BatchToForm,
};

export { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
export { COMMAND_LABELS } from "@/components/dialog/commands/types";
export type { CommandFormProps } from "@/components/dialog/commands/types";
