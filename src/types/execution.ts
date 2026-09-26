import type {
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  PipelineVariableType,
} from "@/types/xan";

/** Shared state for the S6 "multiple branches overwrite one output file" gate. */
export interface OverwriteConfirm {
  branchCount: number;
  outputPath: string;
}

/** Parsed execution result shown as a canvas table node (F1). */
export interface ResultPreview {
  id: string;
  label: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
}

/** One variable awaiting a runtime value before execution (F3). */
export interface VariablePromptItem {
  name: string;
  type: PipelineVariableType;
  value: string;
}

/** Dialog state opened when the pipeline references unassigned variables (F3). */
export interface VariablePrompt {
  variables: VariablePromptItem[];
}

/**
 * Snapshot stashed while the variable prompt / overwrite gate is open, so the
 * confirmed execution reuses the exact pipeline/outputPath/edges state.
 */
export interface PendingRun {
  executableSteps: PipelineStep[];
  outputPath: string;
  edges: PipelineEdge[];
  currentPipeline: PipelineStep[];
  currentTab: PipelineTab;
  inputFile: string;
}
