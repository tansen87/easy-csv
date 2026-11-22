/**
 * Run grouping and filtering for the log drawer (pure logic).
 *
 * One execution run = one group (`runId`); tab lines without a run and
 * app-level lines fall back to per-tab / app groups so nothing is lost.
 * Groups render newest-first; the status dot shows the worst severity.
 */
import { LogEntry } from "@/types/xan";
import { TextSegment, highlightSegments } from "@/utils/settingsSearch";

export type LogLevel = LogEntry["type"];
export type LevelFilter = LogLevel | "all";
export type TabScope = "all" | "current";

/** Key of the group that collects lines with no tab (app lifecycle, updates). */
export const APP_GROUP_KEY = "app";

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 3,
  warning: 2,
  success: 1,
  info: 0,
};

export interface LogRunGroup {
  /** `run:<id>` / `tab:<id>` / the app group key. */
  key: string;
  /** Owning tab, absent for the app group. */
  tabId?: string;
  /** Display label, pre-resolved (tab name → raw tab id → ""). */
  label: string;
  entries: LogEntry[];
  /** First/last line timestamps (ms), newest-last inside the group. */
  startedAt: number;
  lastAt: number;
  counts: Record<LogLevel, number>;
  /** Worst severity across the group — drives the status dot. */
  status: "error" | "warning" | "success" | "info";
  /** True when any line came from the disk backfill (read-only). */
  hasDisk: boolean;
}

export function buildLogGroups(
  logs: LogEntry[],
  tabNameById: Map<string, string>,
  appLabel: string,
): LogRunGroup[] {
  const groups = new Map<string, LogRunGroup>();

  for (const log of logs) {
    const key = log.runId
      ? `run:${log.runId}`
      : log.tabId
        ? `tab:${log.tabId}`
        : APP_GROUP_KEY;
    let group = groups.get(key);
    if (!group) {
      const label =
        key === APP_GROUP_KEY
          ? appLabel
          : (log.tabId && tabNameById.get(log.tabId)) || log.tabId || "";
      group = {
        key,
        tabId: log.tabId,
        label,
        entries: [],
        startedAt: log.timestamp.getTime(),
        lastAt: log.timestamp.getTime(),
        counts: { info: 0, success: 0, warning: 0, error: 0 },
        status: "info",
        hasDisk: false,
      };
      groups.set(key, group);
    }
    group.entries.push(log);
    group.lastAt = Math.max(group.lastAt, log.timestamp.getTime());
    group.startedAt = Math.min(group.startedAt, log.timestamp.getTime());
    group.counts[log.type] += 1;
    if (log.fromDisk) group.hasDisk = true;
    if (LEVEL_RANK[log.type] > LEVEL_RANK[group.status]) {
      group.status = log.type;
    }
  }

  return [...groups.values()].sort((a, b) => b.lastAt - a.lastAt);
}

/** Totals across every line — the numbers shown in the level chips. */
export function levelTotals(logs: LogEntry[]): Record<LogLevel, number> {
  const counts: Record<LogLevel, number> = {
    info: 0,
    success: 0,
    warning: 0,
    error: 0,
  };
  for (const log of logs) counts[log.type] += 1;
  return counts;
}

/**
 * Level × tab-scope × free-text filter, all AND-combined. The query is split
 * on whitespace and every term must hit the message (same AND semantics as
 * settings search); matching is literal and case-insensitive.
 */
export function filterLogs(
  logs: LogEntry[],
  level: LevelFilter,
  tabScope: TabScope,
  selectedTabId: string | undefined,
  query: string,
): LogEntry[] {
  let result = logs;
  if (level !== "all") result = result.filter((log) => log.type === level);
  if (tabScope === "current" && selectedTabId) {
    result = result.filter((log) => log.tabId === selectedTabId);
  }
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  if (terms.length > 0) {
    result = result.filter((log) => {
      const message = log.message.toLowerCase();
      return terms.every((term) => message.includes(term));
    });
  }
  return result;
}

/** Highlight segments for one log message under the active query. */
export function highlightMessage(text: string, query: string): TextSegment[] {
  return highlightSegments(text, query.trim());
}
