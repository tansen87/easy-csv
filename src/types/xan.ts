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
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: "info" | "success" | "error" | "warning";
  message: string;
}
