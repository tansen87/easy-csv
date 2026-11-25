/**
 * Usage ledger (design 079).
 *
 * A thin, local-only record of real output: rows produced, runs finished,
 * files written, commands used, plus twelve "marks" unlocked once when a
 * threshold is crossed. Deliberately not a game layer — no points, levels,
 * streaks or rank; the numbers only describe work that already happened.
 *
 * Everything lives in one localStorage key. File names and paths are never
 * stored, so the stat counts files written instead of deduplicating paths.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const LEDGER_STORAGE_KEY = "easy-csv:ledger:v1";
/** Only the recent tail is needed for the 8-week chart and week dots. */
const DAYS_KEPT = 90;

export type LedgerMilestoneId =
  | "first-run"
  | "rows-10k"
  | "rows-100k"
  | "rows-1m"
  | "rows-10m"
  | "runs-10"
  | "runs-100"
  | "pipeline-1"
  | "pipeline-10"
  | "commands-10"
  | "template-first"
  | "step-run-first";

export type LedgerMilestoneKind = "rows" | "runs" | "pipelines" | "commands" | "flag";

export interface LedgerMilestoneDef {
  id: LedgerMilestoneId;
  kind: LedgerMilestoneKind;
  /** Ignored by `flag` marks, which are unlocked by their own event. */
  threshold: number;
}

/** Display / evaluation order: the panel and the toast queue both follow it. */
export const LEDGER_MILESTONES: readonly LedgerMilestoneDef[] = [
  { id: "first-run", kind: "runs", threshold: 1 },
  { id: "rows-10k", kind: "rows", threshold: 10_000 },
  { id: "rows-100k", kind: "rows", threshold: 100_000 },
  { id: "rows-1m", kind: "rows", threshold: 1_000_000 },
  { id: "rows-10m", kind: "rows", threshold: 10_000_000 },
  { id: "runs-10", kind: "runs", threshold: 10 },
  { id: "runs-100", kind: "runs", threshold: 100 },
  { id: "pipeline-1", kind: "pipelines", threshold: 1 },
  { id: "pipeline-10", kind: "pipelines", threshold: 10 },
  { id: "commands-10", kind: "commands", threshold: 10 },
  { id: "template-first", kind: "flag", threshold: 1 },
  { id: "step-run-first", kind: "flag", threshold: 1 },
];

/** The very first run only opens the ledger; the settlement line says it. */
const SILENT_MILESTONES = new Set<LedgerMilestoneId>(["first-run"]);

export interface LedgerRunRecord {
  runId: string;
  tabId: string;
  /** Rows in this run's final output (0 when it produced none). */
  rows: number;
  /** Wall time of the execution. */
  ms: number;
  /** Executable steps in this run. */
  steps: number;
  /** Command names used by this run. */
  commands: string[];
  /** Output files written by this run (paths are not persisted). */
  files?: string[];
  /** `step-run` is 078's "run from this step". */
  via?: "run" | "step-run";
}

export interface LedgerState {
  v: 1;
  enabled: boolean;
  totals: {
    rows: number;
    runs: number;
    files: number;
    ms: number;
    pipelines: number;
  };
  /** Distinct command names used by successful runs. */
  commands: string[];
  /** Milestone id → first unlocked time (ISO). */
  milestones: Partial<Record<LedgerMilestoneId, string>>;
  /** Recent local days, `YYYY-MM-DD` → rows / runs. */
  days: Record<string, { rows: number; runs: number }>;
  /** Last recorded run, so a replayed record is never counted twice. */
  lastRunId: string | null;
}

export function createEmptyLedger(): LedgerState {
  return {
    v: 1,
    enabled: true,
    totals: { rows: 0, runs: 0, files: 0, ms: 0, pipelines: 0 },
    commands: [],
    milestones: {},
    days: {},
    lastRunId: null,
  };
}

/** Local (not UTC) day key, so "today" matches the calendar the user sees. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Keep the newest {@link DAYS_KEPT} days only. */
function pruneDays(
  days: Record<string, { rows: number; runs: number }>,
): Record<string, { rows: number; runs: number }> {
  const keys = Object.keys(days).sort();
  if (keys.length <= DAYS_KEPT) return days;
  const kept: Record<string, { rows: number; runs: number }> = {};
  for (const key of keys.slice(keys.length - DAYS_KEPT)) {
    kept[key] = days[key];
  }
  return kept;
}

/** Defensive load: a half-written or older payload degrades to defaults. */
export function loadLedger(): LedgerState {
  try {
    const raw = localStorage.getItem(LEDGER_STORAGE_KEY);
    if (!raw) return createEmptyLedger();
    const parsed = JSON.parse(raw) as Partial<LedgerState>;
    const empty = createEmptyLedger();
    const totals = { ...empty.totals, ...(parsed.totals ?? {}) };
    return {
      v: 1,
      enabled: parsed.enabled !== false,
      totals: {
        rows: Number(totals.rows) || 0,
        runs: Number(totals.runs) || 0,
        files: Number(totals.files) || 0,
        ms: Number(totals.ms) || 0,
        pipelines: Number(totals.pipelines) || 0,
      },
      commands: Array.isArray(parsed.commands)
        ? parsed.commands.filter((c): c is string => typeof c === "string")
        : [],
      milestones:
        parsed.milestones && typeof parsed.milestones === "object"
          ? (parsed.milestones as LedgerState["milestones"])
          : {},
      days:
        parsed.days && typeof parsed.days === "object"
          ? (parsed.days as LedgerState["days"])
          : {},
      lastRunId: typeof parsed.lastRunId === "string" ? parsed.lastRunId : null,
    };
  } catch {
    return createEmptyLedger();
  }
}

function saveLedger(state: LedgerState): void {
  try {
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota: keep working, just without persistence.
  }
}

function unlock(
  milestones: LedgerState["milestones"],
  unlocked: LedgerMilestoneId[],
  id: LedgerMilestoneId,
  condition: boolean,
): void {
  if (!condition || milestones[id]) return;
  milestones[id] = new Date().toISOString();
  unlocked.push(id);
}

/**
 * Fold one successful run into the ledger.
 *
 * Returns the same object when nothing changes (disabled, or a runId already
 * recorded), so callers can skip a re-render and a storage write.
 */
export function applyRun(
  prev: LedgerState,
  record: LedgerRunRecord,
): { state: LedgerState; unlocked: LedgerMilestoneId[] } {
  if (!prev.enabled) return { state: prev, unlocked: [] };
  if (prev.lastRunId === record.runId) return { state: prev, unlocked: [] };

  const rows = Math.max(0, Math.round(record.rows || 0));
  const ms = Math.max(0, Math.round(record.ms || 0));
  const files = Math.max(0, record.files?.length ?? 0);

  const totals = {
    ...prev.totals,
    rows: prev.totals.rows + rows,
    runs: prev.totals.runs + 1,
    files: prev.totals.files + files,
    ms: prev.totals.ms + ms,
  };

  const commands = Array.from(
    new Set([...prev.commands, ...record.commands.filter(Boolean)]),
  );

  const today = localDateKey(new Date());
  const bucket = prev.days[today] ?? { rows: 0, runs: 0 };
  const days = pruneDays({
    ...prev.days,
    [today]: { rows: bucket.rows + rows, runs: bucket.runs + 1 },
  });

  const milestones = { ...prev.milestones };
  const unlocked: LedgerMilestoneId[] = [];
  for (const def of LEDGER_MILESTONES) {
    switch (def.kind) {
      case "rows":
        unlock(milestones, unlocked, def.id, totals.rows >= def.threshold);
        break;
      case "runs":
        unlock(milestones, unlocked, def.id, totals.runs >= def.threshold);
        break;
      case "commands":
        unlock(milestones, unlocked, def.id, commands.length >= def.threshold);
        break;
      // Pipelines and flags unlock on their own events.
      case "pipelines":
      case "flag":
        break;
    }
  }
  if (record.via === "step-run") {
    unlock(milestones, unlocked, "step-run-first", true);
  }

  return {
    state: {
      ...prev,
      totals,
      commands,
      days,
      milestones,
      lastRunId: record.runId,
    },
    unlocked,
  };
}

/** Saving the pipeline as a script counts toward the two pipeline marks. */
export function applyPipelineSaved(prev: LedgerState): {
  state: LedgerState;
  unlocked: LedgerMilestoneId[];
} {
  if (!prev.enabled) return { state: prev, unlocked: [] };
  const totals = { ...prev.totals, pipelines: prev.totals.pipelines + 1 };
  const milestones = { ...prev.milestones };
  const unlocked: LedgerMilestoneId[] = [];
  for (const def of LEDGER_MILESTONES) {
    if (def.kind !== "pipelines") continue;
    unlock(milestones, unlocked, def.id, totals.pipelines >= def.threshold);
  }
  return { state: { ...prev, totals, milestones }, unlocked };
}

/** Applying any template unlocks the one "discovery" mark. */
export function applyTemplateApplied(prev: LedgerState): {
  state: LedgerState;
  unlocked: LedgerMilestoneId[];
} {
  if (!prev.enabled) return { state: prev, unlocked: [] };
  const milestones = { ...prev.milestones };
  const unlocked: LedgerMilestoneId[] = [];
  unlock(milestones, unlocked, "template-first", true);
  if (unlocked.length === 0) return { state: prev, unlocked };
  return { state: { ...prev, milestones }, unlocked };
}

/** Sum the last `weeks` seven-day buckets, oldest first (panel bar chart). */
export function weeklyRows(days: LedgerState["days"], weeks = 8): number[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: number[] = [];
  for (let week = weeks - 1; week >= 0; week -= 1) {
    const keys: string[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - (week * 7 + day));
      keys.push(localDateKey(date));
    }
    buckets.push(sum(keys.map((key) => days[key]?.rows ?? 0)));
  }
  return buckets;
}

/** The last seven local days, oldest first: did anything run that day? */
export function lastWeekActivity(days: LedgerState["days"]): boolean[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return (days[localDateKey(date)]?.rows ?? 0) > 0;
  });
}

/**
 * The ledger itself. `queue` holds marks unlocked but not yet shown; the app
 * renders the head as one toast, so several crossings never stack.
 */
export function useLedger() {
  const [state, setState] = useState<LedgerState>(loadLedger);
  const stateRef = useRef(state);
  stateRef.current = state;

  const [lastRun, setLastRun] = useState<LedgerRunRecord | null>(null);
  const [queue, setQueue] = useState<LedgerMilestoneId[]>([]);

  useEffect(() => {
    saveLedger(state);
  }, [state]);

  const commit = useCallback(
    (next: LedgerState, unlocked: LedgerMilestoneId[]) => {
      stateRef.current = next;
      setState(next);
      const audible = unlocked.filter((id) => !SILENT_MILESTONES.has(id));
      if (audible.length > 0) {
        setQueue((current) => [...current, ...audible]);
      }
    },
    [],
  );

  const recordRun = useCallback(
    (record: LedgerRunRecord) => {
      const prev = stateRef.current;
      if (!prev.enabled) return;
      setLastRun({ ...record });
      const { state: next, unlocked } = applyRun(prev, record);
      if (next !== prev) commit(next, unlocked);
    },
    [commit],
  );

  const recordPipelineSaved = useCallback(() => {
    const prev = stateRef.current;
    const { state: next, unlocked } = applyPipelineSaved(prev);
    if (next !== prev) commit(next, unlocked);
  }, [commit]);

  const recordTemplateApplied = useCallback(() => {
    const prev = stateRef.current;
    const { state: next, unlocked } = applyTemplateApplied(prev);
    if (next !== prev) commit(next, unlocked);
  }, [commit]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const prev = stateRef.current;
      if (prev.enabled === enabled) return;
      const next = { ...prev, enabled };
      stateRef.current = next;
      setState(next);
      if (!enabled) setQueue([]);
    },
    [],
  );

  /** Wipe the numbers but keep the user's enabled/disabled choice. */
  const reset = useCallback(() => {
    const next = { ...createEmptyLedger(), enabled: stateRef.current.enabled };
    stateRef.current = next;
    setState(next);
    setLastRun(null);
    setQueue([]);
  }, []);

  const dismissMilestone = useCallback(() => {
    setQueue((current) => current.slice(1));
  }, []);

  return {
    state,
    lastRun,
    queue,
    recordRun,
    recordPipelineSaved,
    recordTemplateApplied,
    setEnabled,
    reset,
    dismissMilestone,
  };
}

export type LedgerHook = ReturnType<typeof useLedger>;
