import { useCallback, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type {
  ChartConfig,
  ChartSeries,
  ExecutionHistoryInput,
  LogEntry,
  PipelineEdge,
  PipelineStep,
  PipelineTab,
  StepLineage,
} from "@/types/xan";
import type {
  OverwriteConfirm,
  PendingRun,
  ResultPreview,
  VariablePrompt,
} from "@/types/execution";
import { useBatchFilter } from "@/hooks/useBatchFilter";
import { useBatchConvert } from "@/hooks/useBatchConvert";
import {
  collectVariablesFromPipeline,
  inferVariableType,
} from "@/utils/params";
import { useLanguage } from "@/i18n";
import { runPipeline } from "@/hooks/execution/runPipeline";
import type { BranchProgressState } from "@/hooks/execution/runPipelineDeps";

interface UseExecutionProps {
  selectedTabId: string;
  defaultDelimiter: string;
  getCurrentTab: () => PipelineTab;
  getCurrentPipeline: () => PipelineStep[];
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  addLog: (type: LogEntry["type"], message: string) => void;
  setTabs: Dispatch<SetStateAction<PipelineTab[]>>;
  setIsExecuting: Dispatch<SetStateAction<boolean>>;
  setShowLogPanel: (value: boolean) => void;
  setShowProgressBar: (value: boolean) => void;
  setBranchProgress: Dispatch<SetStateAction<BranchProgressState | null>>;
  progressHideTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  formatDateTime: (date: Date) => string;
  trackLineage?: (
    steps: PipelineStep[],
    edges: PipelineEdge[],
    inputHeaders: string[],
    inputRows: string[][],
    actualOutputRowCount?: number,
  ) => StepLineage[];
  setShowChartPanel: (value: boolean) => void;
  setChartConfig: Dispatch<SetStateAction<ChartConfig | null>>;
  setChartSeries: Dispatch<SetStateAction<ChartSeries[]>>;
  setChartHeaders: Dispatch<SetStateAction<string[]>>;
  saveVersion: (message?: string, tags?: string[]) => Promise<any>;
  /** Persist one execution record after each run (F6). */
  saveExecutionHistory?: (entry: ExecutionHistoryInput) => Promise<void>;
}

/**
 * Execution engine assembly: run/cancel, the F3 variable prompt, the S6
 * overwrite gate and the canvas result previews. The heavy lifting lives in
 * the framework-free `runPipeline`; this hook only wires state and callbacks.
 */
export function useExecution({
  selectedTabId,
  defaultDelimiter,
  getCurrentTab,
  getCurrentPipeline,
  showToast,
  addLog,
  setTabs,
  setIsExecuting,
  setShowLogPanel,
  setShowProgressBar,
  setBranchProgress,
  progressHideTimerRef,
  formatDateTime,
  trackLineage,
  setShowChartPanel,
  setChartConfig,
  setChartSeries,
  setChartHeaders,
  saveVersion,
  saveExecutionHistory,
}: UseExecutionProps) {
  const { t } = useLanguage();

  // Backend cancel is global; this frontend-only flag lets the batch loops
  // (batch-filter / batch-from:batch-to) stop promptly, because they never hit
  // the shared backend flag on their own (S7-1).
  const cancelRequestedRef = useRef(false);
  // Values persisted at the S6 overwrite gate so the confirmed re-run resolves
  // `{{var}}` placeholders identically to the first attempt.
  const pendingRunValuesRef = useRef<Record<string, string>>({});

  const resolveRunDelimiter = useCallback(
    () => getCurrentTab()?.defaultDelimiter || defaultDelimiter,
    [getCurrentTab, defaultDelimiter],
  );

  const { executeBatchFilterDirect, executeBatchFilterWithData } =
    useBatchFilter({
      defaultDelimiter: resolveRunDelimiter(),
      addLog,
      setBranchProgress,
      getCurrentTab,
      isCancelRequested: () => cancelRequestedRef.current,
    });

  const { executeBatchConvert } = useBatchConvert({
    defaultDelimiter: resolveRunDelimiter(),
    addLog,
    setBranchProgress,
    getCurrentTab,
    isCancelRequested: () => cancelRequestedRef.current,
  });

  const [resultPreview, setResultPreview] = useState<ResultPreview[]>([]);
  const [variablePrompt, setVariablePrompt] = useState<VariablePrompt | null>(
    null,
  );
  // S6: "several branches will write the same output file" confirmation gate.
  const [overwriteConfirm, setOverwriteConfirm] =
    useState<OverwriteConfirm | null>(null);
  // Stash the prepared run while the variable prompt is open, so the confirmed
  // execution reuses the exact pipeline/outputPath/edges snapshot.
  const pendingRunRef = useRef<PendingRun | null>(null);

  const runPending = useCallback(
    async (values: Record<string, string>, opts?: { force?: boolean }) => {
      const pending = pendingRunRef.current;
      if (!pending) return;
      await runPipeline(pending, values, opts, {
        selectedTabId,
        setTabs,
        addLog,
        showToast,
        labels: { cycleDetected: t.cycleDetected },
        resolveRunDelimiter,
        setIsExecuting: (v) => setIsExecuting(v),
        setShowLogPanel,
        setShowProgressBar,
        setBranchProgress,
        progressHideTimerRef,
        resetCancelRequested: () => {
          cancelRequestedRef.current = false;
        },
        setOverwriteConfirm,
        stashPendingRunValues: (v) => {
          pendingRunValuesRef.current = v;
        },
        executeBatchConvert,
        executeBatchFilterDirect,
        executeBatchFilterWithData,
        setChartConfig,
        setChartSeries,
        setChartHeaders,
        setShowChartPanel,
        setResultPreview,
        trackLineage,
        saveVersion,
        saveExecutionHistory,
        formatDateTime,
      });
    },
    [
      selectedTabId,
      setTabs,
      addLog,
      showToast,
      t.cycleDetected,
      resolveRunDelimiter,
      setIsExecuting,
      setShowLogPanel,
      setShowProgressBar,
      setBranchProgress,
      progressHideTimerRef,
      executeBatchConvert,
      executeBatchFilterDirect,
      executeBatchFilterWithData,
      setChartConfig,
      setChartSeries,
      setChartHeaders,
      setShowChartPanel,
      trackLineage,
      saveVersion,
      saveExecutionHistory,
      formatDateTime,
    ],
  );

  const handleExecute = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    if (!currentTab) return;
    const edges = currentTab.edges || [];
    const inputFile = currentTab.inputFile || "";

    if (currentPipeline.length === 0) {
      showToast("No steps in pipeline to execute", "warning");
      return;
    }

    const outputStep = currentPipeline.find(
      (step) => step.command.id === "output",
    );
    const outputPath = outputStep?.parameters.path || "";

    const executableSteps = currentPipeline.filter(
      (step) => step.command.id !== "output",
    );

    if (executableSteps.length === 0) {
      showToast(
        "No executable steps found in pipeline - add other commands before output",
        "warning",
      );
      return;
    }

    // Validate required parameters before execution
    const missingParams: string[] = [];
    for (const step of executableSteps) {
      for (const param of step.command.parameters) {
        if (
          param.required &&
          (step.parameters[param.name] === undefined ||
            step.parameters[param.name] === "")
        ) {
          missingParams.push(
            `${step.alias || step.command.name} → ${param.name}`,
          );
        }
      }
    }
    if (missingParams.length > 0) {
      showToast(
        `Missing required parameters: ${missingParams.join(", ")}`,
        "warning",
      );
      return;
    }

    // F3: collect referenced variables and detect any that are unassigned
    // (no default yet). The declared `variables` defaults are the single
    // source of truth; the runtime dialog writes back into them. Unassigned
    // ones open a one-shot collection dialog; assigned ones execute directly.
    const declared = new Map(
      (currentTab.variables || []).map((v) => [v.name, v]),
    );
    const resolved = collectVariablesFromPipeline(
      executableSteps,
      currentTab.variables,
    );
    const values: Record<string, string> = {};
    for (const v of resolved) {
      values[v.name] = declared.get(v.name)?.defaultValue ?? "";
    }
    const needInput = resolved.filter((v) => !String(values[v.name]).trim());

    // Stash the run snapshot so confirmVariables can resume it exactly.
    pendingRunRef.current = {
      executableSteps,
      outputPath,
      edges,
      currentPipeline,
      currentTab,
      inputFile,
    };

    if (needInput.length > 0) {
      setVariablePrompt({
        variables: needInput.map((v) => ({
          name: v.name,
          type: v.type,
          value: values[v.name],
        })),
      });
      return;
    }
    await runPending(values);
  }, [getCurrentPipeline, getCurrentTab, showToast, runPending]);

  const confirmVariables = useCallback(
    (items: { name: string; value: string }[]) => {
      const pending = pendingRunRef.current;
      if (!pending) return;
      const values: Record<string, string> = {};
      const nextVars = new Map(
        (pending.currentTab.variables || []).map((v) => [v.name, v]),
      );
      items.forEach((it) => {
        values[it.name] = it.value;
        const existing = nextVars.get(it.name);
        nextVars.set(it.name, {
          name: it.name,
          defaultValue: it.value,
          type: existing?.type ?? inferVariableType(it.value),
        });
      });
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                variables: Array.from(nextVars.values()),
                updatedAt: formatDateTime(new Date()),
              }
            : tab,
        ),
      );
      setVariablePrompt(null);
      void runPending(values);
    },
    [runPending, setTabs, selectedTabId, formatDateTime],
  );

  const cancelVariables = useCallback(() => {
    pendingRunRef.current = null;
    setVariablePrompt(null);
  }, []);

  const handleCancelExecution = useCallback(async () => {
    // S7-1: signal the frontend batch loops (batch-filter / batch-from:batch-to)
    // to stop at the next iteration boundary, in addition to the backend flag.
    cancelRequestedRef.current = true;
    try {
      await invoke("set_pipeline_cancelled", { cancel: true });
      addLog("warning", "Cancelling execution...");
    } catch (error) {
      addLog("error", `Failed to cancel execution: ${error}`);
    }
  }, [addLog]);

  // S6: confirmed → proceed with the pending run while accepting the overwrite.
  const confirmOverwriteExecution = useCallback(async () => {
    setOverwriteConfirm(null);
    const pending = pendingRunRef.current;
    if (pending) {
      await runPending(pendingRunValuesRef.current, { force: true });
    }
  }, [runPending]);

  const cancelOverwriteExecution = useCallback(() => {
    setOverwriteConfirm(null);
  }, []);

  return {
    handleExecute,
    handleCancelExecution,
    resultPreview,
    overwriteConfirm,
    confirmOverwriteExecution,
    cancelOverwriteExecution,
    variablePrompt,
    confirmVariables,
    cancelVariables,
  };
}
