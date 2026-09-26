import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  ChartConfig,
  ChartSeries,
  ExecutionHistoryInput,
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  StepLineage,
} from "@/types/xan";
import type { BatchFilterConfig } from "@/types/xan";
import type { OverwriteConfirm, ResultPreview } from "@/types/execution";

/** Cap execution stdout returned to the UI (bytes) to protect the WebView. */
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export interface BranchProgressState {
  current: number;
  total: number;
  name: string;
  status: "executing" | "completed" | "error";
}

/**
 * Explicit dependency bag for runPipeline. No React state is closed over —
 * every side effect enters through this object, keeping the function
 * framework-free and testable.
 */
export interface RunPipelineDeps {
  selectedTabId: string;
  setTabs: Dispatch<SetStateAction<PipelineTab[]>>;
  addLog: (
    type: "info" | "success" | "warning" | "error",
    message: string,
  ) => void;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  /** i18n labels needed inside the runner. */
  labels: { cycleDetected: string };
  resolveRunDelimiter: () => string;
  setIsExecuting: (value: boolean) => void;
  setShowLogPanel: (value: boolean) => void;
  setShowProgressBar: (value: boolean) => void;
  setBranchProgress: (value: BranchProgressState | null) => void;
  progressHideTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  /** Frontend-only cancel flag shared with the batch loops (S7-1). */
  resetCancelRequested: () => void;
  setOverwriteConfirm: (value: OverwriteConfirm | null) => void;
  /** Persist values at the S6 overwrite gate for the confirmed re-run. */
  stashPendingRunValues: (values: Record<string, string>) => void;
  executeBatchConvert: (
    fromParams: Record<string, any>,
    toParams: Record<string, any>,
  ) => Promise<void>;
  executeBatchFilterDirect: (
    config: BatchFilterConfig,
    inputFile: string,
  ) => Promise<void>;
  executeBatchFilterWithData: (
    config: BatchFilterConfig,
    data: string,
  ) => Promise<void>;
  setChartConfig: Dispatch<SetStateAction<ChartConfig | null>>;
  setChartSeries: Dispatch<SetStateAction<ChartSeries[]>>;
  setChartHeaders: Dispatch<SetStateAction<string[]>>;
  setShowChartPanel: (value: boolean) => void;
  setResultPreview: (value: ResultPreview[]) => void;
  trackLineage?: (
    steps: PipelineStep[],
    edges: PipelineEdge[],
    inputHeaders: string[],
    inputRows: string[][],
    actualOutputRowCount?: number,
  ) => StepLineage[];
  saveVersion: (message?: string, tags?: string[]) => Promise<any>;
  saveExecutionHistory?: (entry: ExecutionHistoryInput) => Promise<void>;
  formatDateTime: (date: Date) => string;
}
