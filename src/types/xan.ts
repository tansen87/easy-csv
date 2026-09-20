export interface XanCommand {
  id: string;
  name: string;
  description: string;
  descriptionCn: string;
  category: string;
  /** Marks a command that runs through an external CLI plugin instead of xan */
  plugin?: boolean;
  parameters: XanParameter[];
}

export interface PluginInfo {
  name: string;
  executable: string;
  found: boolean;
  version?: string;
}

export interface XanParameter {
  name: string;
  type: "string" | "number" | "flag" | "select";
  description: string;
  descriptionCn?: string;
  required: boolean;
  default?: string | number | boolean;
  options?: string[];
  flag?: string;
  isPositional?: boolean;
}

export interface PipelineStep {
  id: string;
  command: XanCommand;
  parameters: Record<string, any>;
  alias?: string;
  position?: { x: number; y: number };
  /** Execution error message, displayed on the node when set */
  error?: string;
}

export interface StoredPipelineStep {
  id: string;
  commandId: string;
  parameters: Record<string, any>;
  alias?: string;
  position?: { x: number; y: number };
}

export type PipelineVariableType = "string" | "number" | "path";

/** Docked position / collapse state of one floating panel. */
export interface PanelDockState {
  x?: number;
  y?: number;
  collapsed?: boolean;
}

/** Per-panel docking states persisted across sessions. */
export type PanelStates = Record<string, PanelDockState>;

/** A pipeline variable referenced via `{{name}}` placeholders. */
export interface PipelineVariable {
  /** Placeholder name, e.g. `limit` for `{{limit}}`. */
  name: string;
  defaultValue?: string;
  type: PipelineVariableType;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
  message: string;
}

export type ExecutionHistoryStatus = "success" | "error" | "cancelled";

/** A persisted pipeline execution record. `outputSummary` is a JSON
 *  string with `{ columns, rows, bytes, preview }` — never full stdout. */
export interface ExecutionHistoryEntry {
  id: number;
  tabId: string;
  tabName: string;
  pipelineSnapshotHash: string;
  versionId: string | null;
  status: ExecutionHistoryStatus;
  durationMs: number;
  rows: number;
  outputSummary: string;
  startedAt: string;
}

/** Input payload for `save_execution_history` (backend assigns the id). */
export interface ExecutionHistoryInput {
  tabId: string;
  tabName: string;
  pipelineSnapshotHash: string;
  versionId: string | null;
  status: ExecutionHistoryStatus;
  durationMs: number;
  rows: number;
  outputSummary: string;
  startedAt: string;
}

/** Where a tab's delimiter came from. */
export type DelimiterSource = "detected" | "forced" | "fallback" | "global";

// --- batch filter -----------------------------------------------------------
//
// Moved here from the deleted `BatchFilterDialog` (design 019 §1.7). It is the
// runtime configuration of the `batch-filter` command — built by
// MainMenuHooks from the command's parameters and consumed by
// useBatchFilter — so it belongs with the command types, not with a dialog.

export type BatchFilterType = "text" | "number";

export type BatchFilterTextOperator =
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

export type BatchFilterNumberOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal";

export interface BatchFilterConfig {
  column: string;
  filterType: BatchFilterType;
  textOperator?: BatchFilterTextOperator;
  numberOperator?: BatchFilterNumberOperator;
  valueMode: "manual" | "column";
  manualValues?: string;
  extractColumn?: string;
  caseInsensitive?: boolean;
  outputDir?: string;
}

/** `"auto"` = re-detect on every read; any other value is a locked delimiter. */
export type DelimiterMode = "auto" | string;

/** Delimiter resolution reported by the `read_csv_file` command. */
export interface CsvReadResult {
  headers: string[];
  rows: string[][];
  /** Delimiter the file was actually parsed with. */
  delimiter: string;
  delimiter_source: DelimiterSource;
  delimiter_confidence: "high" | "low" | "none";
  /** Field count of the header row. */
  columns: number;
}

export interface PipelineTab {
  id: string;
  name: string;
  pipeline: PipelineStep[];
  created: string;
  updated: string;
  data?: string[][];
  headers?: string[];
  inputFile?: string;
  defaultDelimiter?: string;
  /** How the delimiter was resolved when the file was last read. */
  delimiterSource?: DelimiterSource;
  /** Detection confidence: `"none"` means the fallback delimiter was used. */
  delimiterConfidence?: "high" | "low" | "none";
  /**
   * `"auto"` = re-detect on every read (the default when a file is opened);
   * a concrete delimiter = locked, never re-detected.
   */
  delimiterMode?: DelimiterMode;
  edges?: PipelineEdge[];
  inputPosition?: { x: number; y: number };
  isSettings?: boolean;
  versions?: PipelineVersion[];
  currentVersionId?: string;
  lineage?: StepLineage[];
  /** Declared pipeline variables (defaults/type), persisted. */
  variables?: PipelineVariable[];
  /** Last-run values for variables, session-only. */
  runVariableValues?: Record<string, string>;
}

export interface PipelineVersion {
  id: string;
  pipelineId: string;
  parentId?: string;
  steps: StoredPipelineStep[];
  edges: PipelineEdge[];
  inputPosition?: { x: number; y: number };
  message?: string;
  createdAt: string;
  tags?: string[];
  /** Declared variables snapshot at version time. */
  variables?: PipelineVariable[];
}

/** A saved pipeline template. `snapshot` reuses `utils/session.ts`'s
 *  `TabSnapshot` shape so pipelines roundtrip losslessly. */
export interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  created: string;
  updated: string;
  snapshot: {
    id: string;
    name: string;
    created: string;
    updated: string;
    inputFile?: string;
    defaultDelimiter?: string;
    headers?: string[];
    data?: string[][];
    inputPosition?: { x: number; y: number };
    isSettings?: boolean;
    currentVersionId?: string;
    variables?: PipelineVariable[];
    runVariableValues?: Record<string, string>;
    pipeline: StoredPipelineStep[];
    edges: PipelineEdge[];
  };
}

export interface ColumnSchema {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  sourceStepId?: string;
  sourceColumnName?: string;
}

export interface Transformation {
  type:
    | "filter"
    | "rename"
    | "add"
    | "remove"
    | "cast"
    | "aggregate"
    | "sort"
    | "group"
    | "pivot"
    | "flatten"
    | "other";
  description: string;
  affectedColumns: string[];
}

export interface ColumnLineagePath {
  columnName: string;
  path: Array<{
    stepId: string;
    stepName: string;
    inputColumnName?: string;
    outputColumnName: string;
    transformation?: string;
  }>;
}

export interface StepLineage {
  stepId: string;
  commandName: string;
  inputSchema: ColumnSchema[];
  outputSchema: ColumnSchema[];
  inputRowCount: number;
  outputRowCount: number;
  transformations: Transformation[];
}

export type ChartType =
  | "line"
  | "scatter"
  | "bar"
  | "histogram"
  | "pie"
  | "wordcloud"
  | "heatmap";

export interface ChartConfig {
  chartType: ChartType;
  x: string;
  y?: string;
  category?: string;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  bins?: number;
  color?: string;
  width?: number;
  height?: number;
}

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
  color: string;
}
