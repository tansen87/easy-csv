import { ComponentType } from "react";
import type { CommandDialogType } from "@/types/dialog";
import type { CommandFormProps } from "@/types/dialog";

import { AggForm } from "./forms/agg";
import { BatchFilterForm } from "./forms/batch-filter";
import { BatchFromForm } from "./forms/batch-from";
import { BatchToForm } from "./forms/batch-to";
import { BeheadForm } from "./forms/behead";
import { BinsForm } from "./forms/bins";
import { BisectForm } from "./forms/bisect";
import { BlankForm } from "./forms/blank";
import { CatForm } from "./forms/cat";
import { ChartForm } from "./forms/chart";
import { CompleteForm } from "./forms/complete";
import { CountForm } from "./forms/count";
import { DedupForm } from "./forms/dedup";
import { DropForm } from "./forms/drop";
import { DuckDBForm } from "./forms/duckdb";
import { EnumForm } from "./forms/enum";
import { EvalForm } from "./forms/eval";
import { ExplodeForm } from "./forms/explode";
import { FillForm } from "./forms/fill";
import { FilterForm } from "./forms/filter";
import { FixlengthsForm } from "./forms/fixlengths";
import { FlattenForm } from "./forms/flatten";
import { FmtForm } from "./forms/fmt";
import { FrequencyForm } from "./forms/frequency";
import { FromForm } from "./forms/from";
import { GroupbyForm } from "./forms/groupby";
import { HeadForm } from "./forms/head";
import { HeadersForm } from "./forms/headers";
import { HistForm } from "./forms/hist";
import { ImplodeForm } from "./forms/implode";
import { InputForm } from "./forms/input";
import { JoinForm } from "./forms/join";
import { MapForm } from "./forms/map";
import { MergeForm } from "./forms/merge";
import { OutputForm } from "./forms/output";
import { PartitionForm } from "./forms/partition";
import { PinyinForm } from "./forms/pinyin";
import { PivotForm } from "./forms/pivot";
import { PlotForm } from "./forms/plot";
import { RangeForm } from "./forms/range";
import { RenameForm } from "./forms/rename";
import { ReverseForm } from "./forms/reverse";
import { RunForm } from "./forms/run";
import { SampleForm } from "./forms/sample";
import { ScrapeForm } from "./forms/scrape";
import { SearchForm } from "./forms/search";
import { SelectForm } from "./forms/select";
import { SeparateForm } from "./forms/separate";
import { ShuffleForm } from "./forms/shuffle";
import { SliceForm } from "./forms/slice";
import { SortForm } from "./forms/sort";
import { SplitForm } from "./forms/split";
import { StatsForm } from "./forms/stats";
import { TailForm } from "./forms/tail";
import { ToForm } from "./forms/to";
import { TopForm } from "./forms/top";
import { TransformForm } from "./forms/transform";
import { TransposeForm } from "./forms/transpose";
import { UnpivotForm } from "./forms/unpivot";
import { ViewForm } from "./forms/view";
import { WindowForm } from "./forms/window";

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
  chart: ChartForm,

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

  // Plugins
  pinyin: PinyinForm,
  duckdb: DuckDBForm,
};

export { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
export { COMMAND_LABELS } from "@/types/dialog";
export type { CommandFormProps } from "@/types/dialog";
