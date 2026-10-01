import type {
  ExecutionHistoryInput,
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  StepLineage,
} from "@/types/xan";
import type { BatchFilterConfig } from "@/types/xan";
import type {
  OverwriteConfirm,
  ResultPreview,
  RunContext,
  RunId,
  RunSession,
  RunState,
  TabChartState,
} from "@/types/execution";

/** Cap execution stdout returned to the UI (bytes) to protect the WebView. */
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export type { BranchProgressState } from "@/types/execution";

/**
 * Explicit dependency bag for runPipeline. No React state is closed over —
 * every side effect enters through this object, keeping the function
 * framework-free and testable.
 *
 * Everything that used to read "the current tab" / "the global isExecuting" is
 * now addressed by `RunContext` (tabId + runId) or by an explicit patch, so two
 * concurrent runs can never write into each other.
 */
export interface RunPipelineDeps {
  /** Patch one run session in the registry (state, branch progress). */
  updateRun: (runId: RunId, patch: Partial<RunSession>) => void;
  /**
   * Mark a run finished and schedule its registry entry to be dropped once the
   * progress pill has been shown for a few seconds.
   */
  finishRun: (runId: RunId, state: RunState) => void;
  /**
   * Hand back the run's concurrency slot while a prompt keeps it parked, so it
   * does not occupy one of the limited parallel runs.
   */
  releaseRun: (runId: RunId) => void;
  /** Functional update of a single tab (step errors, variables, timestamps). */
  updateTab: (tabId: string, updater: (tab: PipelineTab) => PipelineTab) => void;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
    options?: { action?: { label: string; onClick: () => void }; duration?: number },
  ) => void;
  /** i18n labels needed inside the runner. */
  labels: {
    cycleDetected: string;
  };
  setShowLogPanel: (value: boolean) => void;
  /** Ask for the S6 overwrite confirmation on behalf of one run. */
  requestOverwritePrompt: (runId: RunId, data: OverwriteConfirm) => void;
  /** Persist values at the S6 overwrite gate for the confirmed re-run. */
  stashPendingRunValues: (runId: RunId, values: Record<string, string>) => void;
  executeBatchConvert: (
    ctx: RunContext,
    fromParams: Record<string, any>,
    toParams: Record<string, any>,
  ) => Promise<void>;
  executeBatchFilterDirect: (
    ctx: RunContext,
    config: BatchFilterConfig,
    inputFile: string,
  ) => Promise<void>;
  executeBatchFilterWithData: (
    ctx: RunContext,
    config: BatchFilterConfig,
    data: string,
  ) => Promise<void>;
  /** Chart of one tab; `null` clears it. */
  setTabChart: (tabId: string, chart: TabChartState | null) => void;
  setShowChartPanel: (value: boolean) => void;
  /** Result previews of one tab. */
  setTabResultPreview: (tabId: string, previews: ResultPreview[]) => void;
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