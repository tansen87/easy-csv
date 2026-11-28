import type {
  ChartConfig,
  ChartSeries,
  LogEntry,
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  PipelineVariableType,
} from "@/types/xan";
import type { ChartDataIssue } from "@/hooks/charts/processChartData";

/** Progress of the branch being executed (one pill in the canvas). */
export interface BranchProgressState {
  current: number;
  total: number;
  name: string;
  status: "executing" | "completed" | "error";
}

/** One step's state inside the current run (design 086). */
export type StepExecutionStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped";

export interface BranchStepState {
  id: string;
  name: string;
  status: StepExecutionStatus;
}

export type BranchRunStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "cancelled"
  | "skipped";

/**
 * One branch of the current run, shown in the bottom run panel and projected
 * onto the canvas nodes. Only selected branches get an entry.
 */
export interface BranchRunState {
  /** Original index in the execution plan (stable across re-runs). */
  index: number;
  steps: BranchStepState[];
  status: BranchRunStatus;
  currentStepId?: string;
  startedAt?: number;
  durationMs?: number;
  output?: string;
  error?: string;
}

/** Lightweight branch list handed to the Execute menu (design 086). */
export interface BranchSummary {
  index: number;
  stepIds: string[];
  stepNames: string[];
}

export interface TabBranches {
  branches: BranchSummary[];
  /** The tab's output step path, when it has one. */
  outputPath?: string;
}

/** Shared state for the S6 "several writers target one output file" gate. */
export interface OverwriteConfirm {
  branchCount: number;
  outputPath: string;
  /**
   * `"branches"` = two branches of this run write the same file;
   * `"crossTab"` = another tab is already writing it.
   */
  reason?: "branches" | "crossTab";
  /** Name of the other tab already writing the file (only for `crossTab`). */
  otherTabName?: string;
}

/** Parsed execution result shown in the bottom results dock (design 084). */
export interface ResultPreview {
  id: string;
  /** Legacy single-line label (`Result: a → b`). The dock renders `steps`. */
  label: string;
  /** Step names along the branch, in execution order. */
  steps: string[];
  headers: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
  /** Original plan index of the branch that produced this result (design 086). */
  branchIndex?: number;
  /** Wall time of that branch. */
  durationMs?: number;
  /** Failure text when the branch did not produce a table. */
  error?: string;
}

/** One variable awaiting a runtime value before execution. */
export interface VariablePromptItem {
  name: string;
  type: PipelineVariableType;
  value: string;
}

/** Dialog state opened when the pipeline references unassigned variables. */
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
  /**
   * Branches the user picked in the Execute menu (design 086). `undefined`
   * means "all branches" and keeps the legacy overwrite gate for callers such
   * as Ctrl+R; an explicit array means the picker already showed the risk.
   */
  selectedBranchIndexes?: number[];
}

/**
 * Identity of one execution session: "clicked execute → everything finished"
 * (design 028 §2.1). Generated on the frontend and threaded to the backend so
 * a cancel only ever stops its own run.
 */
export type RunId = string;

export type RunState =
  /** Waiting on the variable prompt / overwrite gate. */
  | "preparing"
  /** Waiting for a concurrency slot. */
  | "queued"
  | "running"
  | "done"
  | "error"
  | "cancelled";

/**
 * Per-tab execution session. One tab holds at most one session, several tabs
 * may hold one each — that is what makes concurrent tabs interfere-free.
 */
export interface RunSession {
  runId: RunId;
  tabId: string;
  state: RunState;
  /** Current branch progress, shown by the canvas pill only for this tab. */
  branch: BranchProgressState | null;
  /** Branches selected for this run, in plan order (design 086). */
  branches?: BranchRunState[];
  /** Branches the user did not select; enables the "run remaining" hint. */
  unselectedBranchCount?: number;
  /** Their original plan indexes, so "run remaining" can re-select them. */
  unselectedBranchIndexes?: number[];
  /** The pill stays visible for a few seconds after the run ends. */
  showProgress: boolean;
  startedAt: number;
  /**
   * Epoch ms when the run actually entered "running" (after prompts and
   * queueing). The canvas pill counts from here so its readout matches the
   * duration stored in the execution history.
   */
  executingStartedAt?: number;
  /** Final wall time in ms; the canvas pill freezes it while lingering. */
  durationMs?: number;
  /** Everything the runner needs, resolved at start (never "the current tab"). */
  snapshot: PendingRun & { delimiter: string };
}

/**
 * Everything a running branch needs, resolved once at start so that neither the
 * batch loops nor the delimiter resolution can drift to another tab when the
 * user switches tabs mid-run (design 028 §5.2).
 */
export interface RunContext {
  runId: RunId;
  tabId: string;
  inputFile: string;
  delimiter: string;
  /** Per-run frontend cancel flag (the backend holds the matching one). */
  isCancelled: () => boolean;
  onProgress: (value: BranchProgressState | null) => void;
  /** Patch one selected branch's run state (design 086). */
  onBranchState: (index: number, patch: Partial<BranchRunState>) => void;
  /** Patch one step inside a selected branch. */
  onStepState: (
    branchIndex: number,
    stepId: string,
    status: StepExecutionStatus,
  ) => void;
  /** Append a log line already tagged with this run's tab. */
  log: (type: LogEntry["type"], message: string) => void;
}

/** Chart produced by a `chart` branch, kept per tab. */
export interface TabChartState {
  config: ChartConfig;
  series: ChartSeries[];
  headers: string[];
  /** Raw parsed rows, so the panel can offer a data-table view. */
  rows?: string[][];
  /** Rows whose value could not be parsed as a number. */
  droppedRows?: number;
  /** Column/emptiness diagnosis when nothing could be drawn. */
  issue?: ChartDataIssue;
  /** Data was cut short before shaping, so aggregates are incomplete. */
  truncated?: boolean;
  /** Data rows available in full (before truncation). */
  totalRows?: number;
}
