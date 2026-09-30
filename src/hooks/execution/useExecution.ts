import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, SetStateAction } from "react";
import type {
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
  RunContext,
  RunId,
  RunSession,
  RunState,
  TabChartState,
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
import type { RunPipelineDeps } from "@/hooks/execution/runPipelineDeps";

/** How long the progress pill keeps showing a finished run (design 027 parity). */
const RUN_PILL_LINGER_MS = 5000;

/**
 * Fallback parallelism limit (design 028 §7.1) used until settings are loaded.
 * Everything beyond the limit waits in FIFO order and starts as slots free up —
 * one tab is one subprocess chain, so an unbounded number of tabs would spawn an
 * unbounded number of processes.
 */
const DEFAULT_MAX_CONCURRENT_RUNS = 4;

interface UseExecutionProps {
  selectedTabId: string;
  defaultDelimiter: string;
  getCurrentTab: () => PipelineTab | undefined;
  /** Resolve a tab by id — used by "click a menu row to run that tab". */
  getTabById: (tabId: string) => PipelineTab | undefined;
  setSelectedTabId: (tabId: string) => void;
  /** Parallel run limit from settings (design 028 §7.1). */
  maxConcurrentRuns?: number;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  addLog: (type: LogEntry["type"], message: string, tabId?: string) => void;
  setTabs: Dispatch<SetStateAction<PipelineTab[]>>;
  setShowLogPanel: (value: boolean) => void;
  setShowChartPanel: (value: boolean) => void;
  /** Chart of one tab (design 028 §5.4). */
  setTabChart: (tabId: string, chart: TabChartState | null) => void;
  formatDateTime: (date: Date) => string;
  trackLineage?: (
    steps: PipelineStep[],
    edges: PipelineEdge[],
    inputHeaders: string[],
    inputRows: string[][],
    actualOutputRowCount?: number,
  ) => StepLineage[];
  saveVersion: (message?: string, tags?: string[]) => Promise<any>;
  /** Persist one execution record after each run (F6). */
  saveExecutionHistory?: (entry: ExecutionHistoryInput) => Promise<void>;
}

/** A dialog waiting for the user, always tagged with the run it belongs to. */
type ActivePrompt =
  | { kind: "variables"; runId: RunId; data: VariablePrompt }
  | { kind: "overwrite"; runId: RunId; data: OverwriteConfirm };

/**
 * Execution engine assembly.
 *
 * Every run is a `RunSession` keyed by its tab (design 028 §5.1): one tab holds
 * at most one session, different tabs run concurrently, and a cancel only ever
 * touches the run it was issued for. All side effects stay behind
 * `RunPipelineDeps`, so `runPipeline` itself remains framework-free.
 */
export function useExecution({
  selectedTabId,
  defaultDelimiter,
  getCurrentTab,
  getTabById,
  setSelectedTabId,
  maxConcurrentRuns = DEFAULT_MAX_CONCURRENT_RUNS,
  showToast,
  addLog,
  setTabs,
  setShowLogPanel,
  setShowChartPanel,
  setTabChart,
  formatDateTime,
  trackLineage,
  saveVersion,
  saveExecutionHistory,
}: UseExecutionProps) {
  const { t } = useLanguage();

  /**
   * Active runs by tab id — the single source of truth for "who is executing".
   * A finished run is kept here for {@link RUN_PILL_LINGER_MS} so its progress
   * pill and the tab badge can settle before disappearing.
   */
  const [runs, setRuns] = useState<Record<string, RunSession>>({});
  const runsRef = useRef(runs);
  runsRef.current = runs;

  /** Per-run frontend cancel flag (the backend holds the matching one). */
  const runFlagsRef = useRef<Map<RunId, { cancelled: boolean }>>(new Map());
  /** Registry cleanup timers, keyed by runId. */
  const timersRef = useRef<Map<RunId, ReturnType<typeof setTimeout>>>(new Map());
  /** Snapshot of each pending run, keyed by runId (variable prompt / gate). */
  const pendingRunsRef = useRef<Map<RunId, PendingRun>>(new Map());
  /** Values stashed at the S6 overwrite gate for the confirmed re-run. */
  const pendingValuesRef = useRef<Map<RunId, Record<string, string>>>(new Map());

  /** Runs holding a concurrency slot, and the FIFO waiting for one (§7.1). */
  const runLimit = Math.max(1, maxConcurrentRuns);
  const activeRunsRef = useRef<Set<RunId>>(new Set());
  const runQueueRef = useRef<
    Array<{
      session: RunSession;
      values: Record<string, string>;
      opts?: { force?: boolean };
    }>
  >([]);

  /** Result previews per tab: switching tabs switches the previews. */
  const [previewsByTab, setPreviewsByTab] = useState<
    Record<string, ResultPreview[]>
  >({});

  // ── Dialogs: one visible slot, extra requests wait their turn ─────────────
  const [activePrompt, setActivePrompt] = useState<ActivePrompt | null>(null);
  const promptQueueRef = useRef<ActivePrompt[]>([]);
  const promptOccupiedRef = useRef(false);

  const enqueuePrompt = useCallback((request: ActivePrompt) => {
    if (promptOccupiedRef.current) {
      promptQueueRef.current.push(request);
      return;
    }
    promptOccupiedRef.current = true;
    setActivePrompt(request);
  }, []);

  const closePrompt = useCallback(() => {
    const next = promptQueueRef.current.shift() ?? null;
    promptOccupiedRef.current = next !== null;
    setActivePrompt(next);
  }, []);

  // ── Registry helpers ─────────────────────────────────────────────────────
  const updateRun = useCallback((runId: RunId, patch: Partial<RunSession>) => {
    setRuns((prev) => {
      const entry = Object.entries(prev).find(([, s]) => s.runId === runId);
      if (!entry) return prev;
      const [tabId, session] = entry;
      return { ...prev, [tabId]: { ...session, ...patch } };
    });
  }, []);

  const dropRun = useCallback((runId: RunId) => {
    const timer = timersRef.current.get(runId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(runId);
    }
    runFlagsRef.current.delete(runId);
    pendingRunsRef.current.delete(runId);
    pendingValuesRef.current.delete(runId);
    activeRunsRef.current.delete(runId);
    runQueueRef.current = runQueueRef.current.filter(
      (item) => item.session.runId !== runId,
    );
    promptQueueRef.current = promptQueueRef.current.filter(
      (p) => p.runId !== runId,
    );
    setRuns((prev) => {
      const entry = Object.entries(prev).find(([, s]) => s.runId === runId);
      if (!entry) return prev;
      const next = { ...prev };
      delete next[entry[0]];
      return next;
    });
  }, []);

  const finishRun = useCallback(
    (runId: RunId, state: RunState) => {
      // Free the concurrency slot first: the drain effect picks up the next
      // queued run as soon as this render lands (design 028 §7.1).
      activeRunsRef.current.delete(runId);
      updateRun(runId, { state });
      const existing = timersRef.current.get(runId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        timersRef.current.delete(runId);
        dropRun(runId);
      }, RUN_PILL_LINGER_MS);
      timersRef.current.set(runId, timer);
    },
    [dropRun, updateRun],
  );

  /**
   * Give back a run's slot without ending it: the S6 overwrite gate parks a run
   * while the user decides, and a parked run must not occupy the limit.
   */
  const releaseRunSlot = useCallback((runId: RunId) => {
    activeRunsRef.current.delete(runId);
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    },
    [],
  );

  const updateTab = useCallback(
    (tabId: string, updater: (tab: PipelineTab) => PipelineTab) => {
      setTabs((prev) => prev.map((tab) => (tab.id === tabId ? updater(tab) : tab)));
    },
    [setTabs],
  );

  const setTabResultPreview = useCallback(
    (tabId: string, previews: ResultPreview[]) => {
      setPreviewsByTab((prev) => ({ ...prev, [tabId]: previews }));
    },
    [],
  );

  // ── Batch engines (context is passed per call, never captured) ────────────
  const { executeBatchFilterDirect, executeBatchFilterWithData } =
    useBatchFilter();
  const { executeBatchConvert } = useBatchConvert();

  const makeCtx = useCallback(
    (session: RunSession): RunContext => ({
      runId: session.runId,
      tabId: session.tabId,
      inputFile: session.snapshot.inputFile,
      delimiter: session.snapshot.delimiter,
      isCancelled: () =>
        runFlagsRef.current.get(session.runId)?.cancelled ?? false,
      onProgress: (value) => updateRun(session.runId, { branch: value }),
      // Every line this run produces is tagged with its tab (design 028 §5.4).
      log: (type, message) => addLog(type, message, session.tabId),
    }),
    [addLog, updateRun],
  );

  const buildDeps = useCallback(
    (): RunPipelineDeps => ({
      updateRun,
      finishRun,
      releaseRun: releaseRunSlot,
      updateTab,
      showToast,
      labels: { cycleDetected: t.cycleDetected },
      setShowLogPanel,
      requestOverwritePrompt: (runId, data) =>
        enqueuePrompt({ kind: "overwrite", runId, data }),
      stashPendingRunValues: (runId, values) =>
        pendingValuesRef.current.set(runId, values),
      executeBatchConvert,
      executeBatchFilterDirect,
      executeBatchFilterWithData,
      setTabChart,
      setShowChartPanel,
      setTabResultPreview,
      trackLineage,
      saveVersion,
      saveExecutionHistory,
      formatDateTime,
    }),
    [
      enqueuePrompt,
      executeBatchConvert,
      executeBatchFilterDirect,
      executeBatchFilterWithData,
      finishRun,
      formatDateTime,
      releaseRunSlot,
      saveExecutionHistory,
      saveVersion,
      setShowChartPanel,
      setShowLogPanel,
      setTabChart,
      setTabResultPreview,
      showToast,
      t.cycleDetected,
      trackLineage,
      updateRun,
      updateTab,
    ],
  );

  /** Start a run that already holds a concurrency slot. */
  const startNow = useCallback(
    (
      session: RunSession,
      values: Record<string, string>,
      opts?: { force?: boolean },
    ) => {
      activeRunsRef.current.add(session.runId);
      void runPipeline(
        session.snapshot,
        values,
        opts,
        makeCtx(session),
        buildDeps(),
      );
    },
    [buildDeps, makeCtx],
  );

  /**
   * Take a slot or wait in line (design 028 §7.1). Queued runs keep their
   * session so the tab badge / menu row can show 排队中, and are started by the
   * drain effect below as soon as a slot frees up.
   */
  const scheduleRun = useCallback(
    (
      session: RunSession,
      values: Record<string, string>,
      opts?: { force?: boolean },
    ) => {
      if (activeRunsRef.current.size < runLimit) {
        startNow(session, values, opts);
        return;
      }
      updateRun(session.runId, { state: "queued" });
      runQueueRef.current.push({ session, values, opts });
    },
    [runLimit, startNow, updateRun],
  );

  // Drain the FIFO whenever the registry changes, i.e. right after a run ends.
  useEffect(() => {
    while (
      runQueueRef.current.length > 0 &&
      activeRunsRef.current.size < runLimit
    ) {
      const next = runQueueRef.current.shift()!;
      startNow(next.session, next.values, next.opts);
    }
  }, [runs, runLimit, startNow]);

  /**
   * Last gate before a run takes a slot: if another live tab is already writing
   * the same output file, ask first (design 028 §7.3).
   */
  const proceedToSchedule = useCallback(
    (
      session: RunSession,
      values: Record<string, string>,
      opts?: { force?: boolean },
    ) => {
      const { outputPath } = session.snapshot;
      if (outputPath && !opts?.force) {
        const conflict = Object.values(runsRef.current).find(
          (other) =>
            other.tabId !== session.tabId &&
            other.snapshot.outputPath === outputPath &&
            (other.state === "running" ||
              other.state === "queued" ||
              other.state === "preparing"),
        );
        if (conflict) {
          pendingValuesRef.current.set(session.runId, values);
          enqueuePrompt({
            kind: "overwrite",
            runId: session.runId,
            data: {
              branchCount: 1,
              outputPath,
              reason: "crossTab",
              otherTabName: getTabById(conflict.tabId)?.name,
            },
          });
          return;
        }
      }
      scheduleRun(session, values, opts);
    },
    [enqueuePrompt, getTabById, scheduleRun],
  );

  /** Validation + snapshot + session creation for one tab (current or not). */
  const executeForTab = useCallback(
    async (tab: PipelineTab | undefined) => {
      if (!tab) return;
      const running = runsRef.current[tab.id];
      if (
        running &&
        (running.state === "running" ||
          running.state === "queued" ||
          running.state === "preparing")
      ) {
        showToast("This tab is already executing", "warning");
        return;
      }

      const currentPipeline = tab.pipeline || [];
      const edges = tab.edges || [];
      const inputFile = tab.inputFile || "";

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

      const pending: PendingRun = {
        executableSteps,
        outputPath,
        edges,
        currentPipeline,
        currentTab: tab,
        inputFile,
      };

      const runId: RunId = `${tab.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const session: RunSession = {
        runId,
        tabId: tab.id,
        state: "preparing",
        branch: null,
        showProgress: false,
        startedAt: Date.now(),
        // Snapshot the delimiter now: a tab switch mid-run must not change it.
        snapshot: {
          ...pending,
          delimiter: tab.defaultDelimiter || defaultDelimiter,
        },
      };

      runFlagsRef.current.set(runId, { cancelled: false });
      pendingRunsRef.current.set(runId, pending);
      setRuns((prev) => ({ ...prev, [tab.id]: session }));

      // F3: collect referenced variables and detect any that are unassigned.
      const declared = new Map((tab.variables || []).map((v) => [v.name, v]));
      const resolved = collectVariablesFromPipeline(
        executableSteps,
        tab.variables,
      );
      const values: Record<string, string> = {};
      for (const v of resolved) {
        values[v.name] = declared.get(v.name)?.defaultValue ?? "";
      }
      const needInput = resolved.filter((v) => !String(values[v.name]).trim());

      if (needInput.length > 0) {
        enqueuePrompt({
          kind: "variables",
          runId,
          data: {
            variables: needInput.map((v) => ({
              name: v.name,
              type: v.type,
              value: values[v.name],
            })),
          },
        });
        return;
      }
      proceedToSchedule(session, values);
    },
    [defaultDelimiter, enqueuePrompt, proceedToSchedule, showToast],
  );

  /** Run the currently selected tab (toolbar / Ctrl+R / command palette). */
  const handleExecute = useCallback(async () => {
    await executeForTab(getCurrentTab());
  }, [executeForTab, getCurrentTab]);

  /** Click a row in the execute menu: switch to that tab, then run it. */
  const runTab = useCallback(
    async (tabId: string) => {
      setSelectedTabId(tabId);
      await executeForTab(getTabById(tabId));
    },
    [executeForTab, getTabById, setSelectedTabId],
  );

  /** Cancel exactly one tab's run (backend flag + frontend batch loops). */
  const cancelRun = useCallback(
    async (tabId: string) => {
      const session = runsRef.current[tabId];
      if (!session) return;

      // A queued run has not started yet — just drop it from the queue.
      if (session.state === "queued") {
        addLog("warning", "Cancelled a queued run", tabId);
        dropRun(session.runId);
        return;
      }

      const flag = runFlagsRef.current.get(session.runId);
      if (flag) flag.cancelled = true;
      try {
        await invoke("cancel_pipeline", { runId: session.runId });
        addLog("warning", "Cancelling execution...", tabId);
      } catch (error) {
        addLog("error", `Failed to cancel execution: ${error}`, tabId);
      }
    },
    [addLog, dropRun],
  );

  const handleCancelExecution = useCallback(async () => {
    await cancelRun(selectedTabId);
  }, [cancelRun, selectedTabId]);

  /**
   * Called when a tab is closed: stop its run (if any) and drop everything the
   * tab owned, so nothing is left executing invisibly (design 028 §6.2).
   */
  const handleTabClosed = useCallback(
    (tabId: string) => {
      const session = runsRef.current[tabId];
      if (session) {
        void cancelRun(tabId);
        dropRun(session.runId);
        addLog("warning", `Cancelled execution of a closed tab`, tabId);
      }
      setPreviewsByTab((prev) => {
        if (!(tabId in prev)) return prev;
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
      setTabChart(tabId, null);
    },
    [addLog, cancelRun, dropRun, setTabChart],
  );

  // ── Dialog handlers ──────────────────────────────────────────────────────
  const confirmVariables = useCallback(
    (items: { name: string; value: string }[]) => {
      const active = activePrompt;
      if (!active || active.kind !== "variables") return;
      const runId = active.runId;
      const pending = pendingRunsRef.current.get(runId);
      const session = Object.values(runsRef.current).find(
        (s) => s.runId === runId,
      );
      closePrompt();
      if (!pending || !session) return;

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
      updateTab(pending.currentTab.id, (tab) => ({
        ...tab,
        variables: Array.from(nextVars.values()),
        updatedAt: formatDateTime(new Date()),
      }));
      void proceedToSchedule(session, values);
    },
    [activePrompt, closePrompt, formatDateTime, proceedToSchedule, updateTab],
  );

  const cancelVariables = useCallback(() => {
    const active = activePrompt;
    closePrompt();
    if (active) dropRun(active.runId);
  }, [activePrompt, closePrompt, dropRun]);

  const confirmOverwriteExecution = useCallback(async () => {
    const active = activePrompt;
    if (!active || active.kind !== "overwrite") return;
    const runId = active.runId;
    const session = Object.values(runsRef.current).find(
      (s) => s.runId === runId,
    );
    const values = pendingValuesRef.current.get(runId) ?? {};
    closePrompt();
    if (session) scheduleRun(session, values, { force: true });
  }, [activePrompt, closePrompt, scheduleRun]);

  const cancelOverwriteExecution = useCallback(() => {
    const active = activePrompt;
    closePrompt();
    if (active) dropRun(active.runId);
  }, [activePrompt, closePrompt, dropRun]);

  // ── Derived views ────────────────────────────────────────────────────────
  /** Only the owning tab renders its results. */
  const resultPreview = useMemo(
    () => previewsByTab[selectedTabId] ?? [],
    [previewsByTab, selectedTabId],
  );

  const isTabExecuting = useCallback(
    (tabId: string) => {
      const session = runs[tabId];
      if (!session) return false;
      return (
        session.state === "running" ||
        session.state === "queued" ||
        session.state === "preparing"
      );
    },
    [runs],
  );

  const variablePrompt = useMemo(
    () => (activePrompt?.kind === "variables" ? activePrompt.data : null),
    [activePrompt],
  );
  const overwriteConfirm = useMemo(
    () => (activePrompt?.kind === "overwrite" ? activePrompt.data : null),
    [activePrompt],
  );

  return {
    handleExecute,
    runTab,
    cancelRun,
    handleCancelExecution,
    handleTabClosed,
    runs,
    isTabExecuting,
    resultPreview,
    overwriteConfirm,
    confirmOverwriteExecution,
    cancelOverwriteExecution,
    variablePrompt,
    confirmVariables,
    cancelVariables,
  };
}