export interface XanCommand {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: XanParameter[];
}

export interface XanParameter {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "file" | "flag";
  description: string;
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
  createdAt: string;
  updatedAt: string;
  data?: string[][];
  headers?: string[];
  inputFile?: string;
  defaultDelimiter?: string;
  edges?: PipelineEdge[];
  inputPosition?: { x: number; y: number };
}

export interface HistoricalPipeline {
  id: string;
  name: string;
  pipeline: PipelineStep[];
  inputFile: string;
  defaultDelimiter: string;
  executedAt: string;
  success: boolean;
  output?: string;
  edges?: PipelineEdge[];
  inputPosition?: { x: number; y: number };
}

export interface Workspace {
  version: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  pipeline: PipelineStep[];
  inputFile: string;
  defaultDelimiter: string;
  noQuoting: boolean;
}
