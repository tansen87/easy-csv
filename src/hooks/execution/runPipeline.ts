import type {
  ExecutionHistoryInput,
  ExecutionHistoryStatus,
  PipelineStep,
} from "@/types/xan";
import type { PendingRun, ResultPreview, RunContext } from "@/types/execution";
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
 * (stored placeholders and the tab pipeline stay untouched), split the
 * graph into branches, run each branch (normal pipeline / batch / chart),
 * then finish with previews, lineage, history and progress teardown.
 *
 * Everything that used to be addressed by `selectedTabId` / a global
 * `isExecuting` now goes through `ctx` (runId + tabId), so concurrent tabs
 * never write into each other.
 */
export async function runPipeline(
  pending: PendingRun,
  resolveValues: Record<string, string>,
  opts: { force?: boolean } | undefined,
  ctx: RunContext,
  deps: RunPipelineDeps,
): Promise<void> {
  const { currentPipeline, currentTab, edges, outputPath, executableSteps } =
    pending;
  const { showToast, labels, setShowLogPanel } = deps;

  // Resolve `{{var}}` placeholders on a deep clone; stored placeholders and
  // the tab pipeline stay untouched.
  const steps = resolveStepPlaceholders(executableSteps, resolveValues);

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
    ctx.log("error", `${labels.cycleDetected}: ${chain}`);
    showToast(
      cycleErr.cycleNodeIds ? `${labels.cycleDetected}: ${chain}` : `${error}`,
      "error",
    );
    if (cycleErr.cycleNodeIds?.length) {
      const cycleIds = cycleErr.cycleNodeIds;
      deps.updateTab(ctx.tabId, (tab) => ({
        ...tab,
        pipeline: tab.pipeline.map((step) =>
          cycleIds.includes(step.id)
            ? { ...step, error: labels.cycleDetected }
            : step,
        ),
      }));
    }
    deps.finishRun(ctx.runId, "error");
    return;
  }

  if (branches.length > 1 && outputPath && !opts?.force) {
    // Parked until the user answers: give the slot back meanwhile.
    deps.releaseRun(ctx.runId);
    deps.stashPendingRunValues(ctx.runId, resolveValues);
    deps.requestOverwritePrompt(ctx.runId, {
      branchCount: branches.length,
      outputPath,
    });
    // Stays "preparing": the confirmed re-run resumes this same session.
    return;
  }

  deps.updateRun(ctx.runId, { state: "running", showProgress: true });
  setShowLogPanel(true);

  const runStartedAt = Date.now();
  // Hoisted so the finally block can determine the final status.
  let pipelineFailed = false;
  let wasCancelled = false;
  let executionError: string | null = null;
  // Accumulated branch results, read by the finally block.
  const allResults: {
    success: boolean;
    output?: string;
    error?: string;
    branchSteps: string[];
  }[] = [];

  try {
    deps.setTabResultPreview(ctx.tabId, []);

    // Clear any previous step execution errors so stale errors don't remain
    deps.updateTab(ctx.tabId, (tab) => ({
      ...tab,
      pipeline: tab.pipeline.map((step) =>
        step.error ? { ...step, error: undefined } : step,
      ),
    }));

    // Accumulate per-step execution errors to display on the nodes
    const accumulatedErrors: Record<string, string> = {};

    for (let i = 0; i < branches.length; i++) {
      const branchSteps = branches[i];
      if (branchSteps.length === 0) continue;

      const result = await executeSingleBranch({
        ctx,
        branchSteps,
        index: i,
        total: branches.length,
        outputPath,
        currentTab,
        deps,
        markFailed: () => {
          pipelineFailed = true;
        },
      });

      if (result.cancelled) {
        ctx.log("warning", "Execution cancelled by user");
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

    // Build canvas result previews from successful branch outputs
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
    deps.setTabResultPreview(ctx.tabId, previews);

    if (deps.trackLineage && !wasCancelled) {
      const headers = currentTab.headers || [];
      const rows = currentTab.data || [];
      deps.trackLineage(currentPipeline, edges, headers, rows);
    }

    // Apply per-step execution errors so they render on the nodes
    if (Object.keys(accumulatedErrors).length > 0) {
      const errors = accumulatedErrors;
      deps.updateTab(ctx.tabId, (tab) => ({
        ...tab,
        pipeline: tab.pipeline.map((step) => {
          const err = errors[step.id];
          return err !== undefined ? { ...step, error: err } : step;
        }),
      }));
    }

    const successCount = allResults.filter((r) => r.success).length;
    if (successCount === branches.length) {
      ctx.log(
        "success",
        `All ${branches.length} branch(es) executed successfully`,
      );
      // Auto-save version on successful execution
      try {
        await deps.saveVersion(`auto-generated`);
      } catch (versionError) {
        ctx.log("warning", `Failed to auto-save version: ${versionError}`);
      }
    }
  } catch (error) {
    executionError = String(error);
    ctx.log("error", `${error}`);
  } finally {
    const status: ExecutionHistoryStatus = wasCancelled
      ? "cancelled"
      : pipelineFailed || executionError
        ? "error"
        : "success";

    // Completion feedback is the *system* notification only (see
    // useAppBootstrap): an in-app toast duplicated it, so the design-027
    // completion toast — with its "查看结果" action — was removed at the
    // user's request (2026-09-30). The log panel still opens when a run
    // starts, and `status` above still feeds the execution history.

    // Persist a compact execution record (summary only, no stdout).
    if (deps.saveExecutionHistory) {
      const summary = buildOutputSummary(allResults);
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
          ctx.log("warning", `Failed to save execution history: ${err}`),
        );
    }

    deps.finishRun(
      ctx.runId,
      wasCancelled ? "cancelled" : pipelineFailed || executionError ? "error" : "done",
    );
  }
}