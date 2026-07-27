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
  isConditional?: boolean;
  conditionalExpression?: ConditionalExpression;
  trueBranchStepIds?: string[];
  falseBranchStepIds?: string[];
}

export interface StoredPipelineStep {
  id: string;
  commandId: string;
  parameters: Record<string, any>;
  alias?: string;
  position?: { x: number; y: number };
  isConditional?: boolean;
  conditionalExpression?: ConditionalExpression;
  trueBranchStepIds?: string[];
  falseBranchStepIds?: string[];
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  condition?: "true" | "false";
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

export interface ConditionalExpression {
  column: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=" | "contains" | "not_contains" | "starts_with" | "ends_with" | "matches";
  value: string;
}

export interface ConditionalStep {
  id: string;
  expression: ConditionalExpression;
  trueBranch: string[];
  falseBranch: string[];
  position?: { x: number; y: number };
  alias?: string;
}

export interface ColumnSchema {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  source?: { stepId: string; columnName: string };
}

export interface Transformation {
  type: "filter" | "rename" | "add" | "remove" | "cast" | "aggregate" | "sort" | "group" | "pivot" | "flatten" | "other";
  description: string;
  affectedColumns: string[];
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
