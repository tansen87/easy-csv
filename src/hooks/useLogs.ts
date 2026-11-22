import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogEntry } from "@/types/xan";

/**
 * Execution logs.
 *
 * Memory keeps the newest `MEMORY_LOG_MAX` lines; every line is also appended
 * to the on-disk JSONL files via `append_log` unless retention is 0. On
 * startup the last two days are read back and marked `fromDisk` (read-only).
 * Persistence failures are swallowed — logging must never interrupt the
 * business flow it is describing.
 */
const MEMORY_LOG_MAX = 500;
/** Backfill window: today + yesterday, per the design doc. */
const BACKFILL_DAYS = 2;
/** Used when the backend has no saved value yet. */
const DEFAULT_RETENTION_DAYS = 7;

/** Shape returned by `read_recent_logs` (mirror of the Rust struct). */
interface StoredLogEntry {
  ts: string;
  level: LogEntry["type"];
  tabId?: string;
  tabName?: string;
  runId?: string;
  message: string;
}

export function useLogs(getTabName?: (tabId: string) => string | undefined) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const persistRef = useRef(true);
  const tabNameRef = useRef(getTabName);
  // The lookup closure may be recreated per render; keep the ref fresh
  // without resubscribing anything.
  useEffect(() => {
    tabNameRef.current = getTabName;
  });

  // Startup: read retention, prune expired files, backfill yesterday+today.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await invoke<number | null>("get_log_retention_days");
        if (saved !== null) persistRef.current = saved > 0;
        const days = saved ?? DEFAULT_RETENTION_DAYS;
        if (days > 0) {
          await invoke("prune_log_files", { retentionDays: days });
        }
        if (cancelled || !persistRef.current) return;
        const stored = await invoke<StoredLogEntry[]>("read_recent_logs", {
          days: BACKFILL_DAYS,
        });
        if (cancelled || stored.length === 0) return;
        const backfilled: LogEntry[] = stored.map((stored, index) => ({
          id: `disk-${stored.ts}-${index}`,
          timestamp: new Date(stored.ts),
          type: stored.level,
          message: stored.message,
          tabId: stored.tabId,
          runId: stored.runId,
          fromDisk: true,
        }));
        setLogs((prev) => [...backfilled, ...prev]);
      } catch {
        // Disk unavailable (or the command failed) → memory-only logging.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addLog = useCallback(
    (
      type: LogEntry["type"],
      message: string,
      tabId?: string,
      runId?: string,
    ) => {
      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: new Date(),
        type,
        message,
        tabId,
        runId,
      };
      setLogs((prev) => {
        const next = [...prev, newLog];
        return next.length > MEMORY_LOG_MAX
          ? next.slice(next.length - MEMORY_LOG_MAX)
          : next;
      });
      if (persistRef.current) {
        invoke("append_log", {
          entry: {
            level: type,
            tabId: tabId ?? null,
            tabName: tabId ? (tabNameRef.current?.(tabId) ?? null) : null,
            runId: runId ?? null,
            message,
          },
        }).catch(() => {
          // Persistence failed → stay memory-only, never surface this.
        });
      }
    },
    [],
  );

  const removeLog = useCallback((id: string) => {
    setLogs((prev) => prev.filter((log) => log.id !== id));
  }, []);

  /** Clears the in-memory list only; disk files are handled by retention. */
  const clearLogs = useCallback(() => {
    setLogs((prev) => prev.filter((log) => log.fromDisk));
  }, []);

  /** Re-read the retention setting after the user changed it in Settings. */
  const refreshRetention = useCallback(async () => {
    try {
      const saved = await invoke<number | null>("get_log_retention_days");
      persistRef.current = saved === null ? true : saved > 0;
    } catch {
      // Keep the current flag; next launch re-reads it anyway.
    }
  }, []);

  return { logs, addLog, removeLog, clearLogs, refreshRetention };
}
