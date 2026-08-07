export interface XanCommand {
  id: string;
  name: string;
  description: string;
  descriptionCn: string;
  category: string;
  parameters: XanParameter[];
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
}

export interface StoredPipelineStep {
  id: string;
  commandId: string;
  parameters: Record<string, any>;
  alias?: string;
  position?: { x: number; y: number };
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
  edges?: PipelineEdge[];
  inputPosition?: { x: number; y: number };
  isSettings?: boolean;
  versions?: PipelineVersion[];
  currentVersionId?: string;
  lineage?: StepLineage[];
}

export interface HistoricalPipeline {
  id: string;
  name: string;
  pipeline: PipelineStep[];
  inputFile: string;
  defaultDelimiter: string;
  executedAt: string;
  success: boolean;
  edges?: PipelineEdge[];
  inputPosition?: { x: number; y: number };
  lineage?: StepLineage[];
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

export type ChartType = "line" | "scatter" | "bar" | "histogram";

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
