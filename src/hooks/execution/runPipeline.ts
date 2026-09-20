import { invoke } from "@tauri-apps/api/core";
import type {
  ExecutionHistoryInput,
  ExecutionHistoryStatus,
  PipelineStep,
} from "@/types/xan";
import type { PendingRun, ResultPreview } from "@/types/execution";
import type { RunPipelineDeps } from "@/hooks/execution/runPipelineDeps";
import { buildExecutionBranches } from "@/hooks/execution/buildBranches";
import { executeSingleBranch } from "@/hooks/execution/executeBranch";
import { parseCsvString } from "@/utils/csv";
import { stripStepCommand } from "@/utils/session";
import { resolveStepPlaceholders } from "@/utils/params";
import {
  computePipelineSnapshotHash,
  buildOutputSummary,
} from "@/utils/executionHistory";

/**
 * Execute the stashed run: resolve `{{var}}` placeholders on a deep clone
 * (stored placeholders and the tab pipeline stay untouched, F3), split the
 * graph into branches, run each branch (normal pipeline / batch / chart),
 * then finish with previews, lineage, history and progress teardown.
 */
export async function runPipeline(
  pending: PendingRun,
  resolveValues: Record<string, string>,
  opts: { force?: boolean } | undefined,
  deps: RunPipelineDeps,
): Promise<void> {
  const {
    currentPipeline,
    currentTab,
    edges,
    inputFile,
    outputPath,
    executableSteps,
  } = pending;
  const {
    setTabs,
    selectedTabId,
    addLog,
    showToast,
    labels,
    setIsExecuting,
    setShowLogPanel,
    setShowProgressBar,
    setBranchProgress,
    progressHideTimerRef,
    setOverwriteConfirm,
  } = deps;

  // Resolve `{{var}}` placeholders on a deep clone; stored placeholders and
  // the tab pipeline stay untouched (F3).
  const steps = resolveStepPlaceholders(executableSteps, resolveValues);

  // A fresh run starts with no pending frontend cancel request.
  deps.resetCancelRequested();

  // Guard before any executing side effects:
  //  - An existing cycle in the graph must surface as a readable
  //    error (and mark the involved nodes red) instead of a stack overflow.
  //  - Multiple branches writing one output file need an explicit
  //    overwrite confirmation.
  let branches: PipelineStep[][] = [];
  try {
    branches = buildExecutionBranches(steps, edges);
  } catch (error) {
    const cycleErr = error as Error & { cycleNodeIds?: string[] };
    const chain = cycleErr.message.replace(/^cycle: /, "");
    addLog("error", `${labels.cycleDetected}: ${chain}`);
    showToast(
      cycleErr.cycleNodeIds ? `${labels.cycleDetected}: ${chain}` : `${error}`,
      "error",
    );
    if (cycleErr.cycleNodeIds?.length) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                pipeline: tab.pipeline.map((step) =>
                  cycleErr.cycleNodeIds!.includes(step.id)
                    ? { ...step, error: labels.cycleDetected }
                    : step,
                ),
              }
            : tab,
        ),
      );
    }
    return;
  }

  if (branches.length > 1 && outputPath && !opts?.force) {
    deps.stashPendingRunValues(resolveValues);
    setOverwriteConfirm({ branchCount: branches.length, outputPath });
    return;
  }

  setIsExecuting(true);
  setShowLogPanel(true);
  setShowProgressBar(true);

  if (progressHideTimerRef.current) {
    clearTimeout(progressHideTimerRef.current);
    progressHideTimerRef.current = null;
  }

  const runStartedAt = Date.now();
  // Hoisted so the finally block can determine the final status.
  let pipelineFailed = false;
  let wasCancelled = false;
  let executionError: string | null = null;
  // Accumulated branch results, read by the finally block (F6).
  const allResults: {
    success: boolean;
    output?: string;
    error?: string;
    branchSteps: string[];
  }[] = [];

  try {
    await invoke("set_pipeline_cancelled", { cancel: false });
    deps.setResultPreview([]);

    // Clear any previous step execution errors so stale errors don't remain
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: tab.pipeline.map((step) =>
                step.error ? { ...step, error: undefined } : step,
              ),
            }
          : tab,
      ),
    );

    // Accumulate per-step execution errors to display on the nodes
    const accumulatedErrors: Record<string, string> = {};

    for (let i = 0; i < branches.length; i++) {
      const branchSteps = branches[i];
      if (branchSteps.length === 0) continue;

      const result = await executeSingleBranch({
        branchSteps,
        index: i,
        total: branches.length,
        inputFile,
        outputPath,
        currentTab,
        deps,
        onBranchProgress: setBranchProgress,
        markFailed: () => {
          pipelineFailed = true;
        },
      });

      if (result.cancelled) {
        addLog("warning", "Execution cancelled by user");
        pipelineFailed = true;
        wasCancelled = true;
        break;
      }

      allResults.push({
        success: result.success,
        output: result.output,
        error: result.error,
        branchSteps: result.branchStepNames,
      });

      // Merge per-step errors from this branch
      const stepErrors = result.stepErrors;
      if (stepErrors) {
        for (const stepId in stepErrors) {
          const err = stepErrors[stepId];
          if (err) accumulatedErrors[stepId] = err;
        }
      }

      if (!result.success) {
        pipelineFailed = true;
      }
    }

    // Build canvas result previews from successful branch outputs (F1)
    const runTs = Date.now();
    const previews: ResultPreview[] = [];
    allResults.forEach((r, i) => {
      if (r.success && r.output?.trim()) {
        const parsed = parseCsvString(r.output, 500);
        if (parsed.headers.length > 0) {
          previews.push({
            id: `result-${runTs}-${i}`,
            label:
              r.branchSteps.length > 0
                ? `Result: ${r.branchSteps.join(" → ")}`
                : `Branch ${i + 1}`,
            headers: parsed.headers,
            rows: parsed.rows,
            totalRows: parsed.rows.length,
            truncated: parsed.truncated,
          });
        }
      }
    });
    deps.setResultPreview(previews);

    if (deps.trackLineage && !wasCancelled) {
      const headers = currentTab.headers || [];
      const rows = currentTab.data || [];
      deps.trackLineage(currentPipeline, edges, headers, rows);
    }

    // Apply per-step execution errors so they render on the nodes
    if (Object.keys(accumulatedErrors).length > 0) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                pipeline: tab.pipeline.map((step) => {
                  const err = accumulatedErrors[step.id];
                  if (err !== undefined) {
                    return { ...step, error: err };
                  }
                  return step;
                }),
              }
            : tab,
        ),
      );
    }

    const successCount = allResults.filter((r) => r.success).length;
    if (successCount === branches.length) {
      addLog(
        "success",
        `All ${branches.length} branch(es) executed successfully`,
      );
      // Auto-save version on successful execution
      try {
        await deps.saveVersion(`auto-generated`);
      } catch (versionError) {
        addLog("warning", `Failed to auto-save version: ${versionError}`);
      }
    }
  } catch (error) {
    executionError = String(error);
    addLog("error", `${error}`);
  } finally {
    setIsExecuting(false);

    // F6: persist a compact execution record (summary only, no stdout).
    if (deps.saveExecutionHistory) {
      const summary = buildOutputSummary(allResults);
      const status: ExecutionHistoryStatus = wasCancelled
        ? "cancelled"
        : pipelineFailed || executionError
          ? "error"
          : "success";
      const entry: ExecutionHistoryInput = {
        tabId: currentTab.id,
        tabName: currentTab.name,
        pipelineSnapshotHash: computePipelineSnapshotHash(
          currentPipeline.map(stripStepCommand),
          edges,
        ),
        versionId: currentTab.currentVersionId ?? null,
        status,
        durationMs: Date.now() - runStartedAt,
        rows: summary.rows,
        outputSummary: JSON.stringify(summary),
        startedAt: deps.formatDateTime(new Date()),
      };
      deps
        .saveExecutionHistory(entry)
        .catch((err) =>
          addLog("warning", `Failed to save execution history: ${err}`),
        );
    }

    progressHideTimerRef.current = setTimeout(() => {
      setShowProgressBar(false);
      setBranchProgress(null);
    }, 5000);
  }
}
