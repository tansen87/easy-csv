/**
 * Persistence for the "Separate Good/Bad Rows" dialog: the last successful run
 * (output paths, row counts, completion time) plus the options that produced
 * it. Stored in localStorage so the dialog can still show the outcome after it
 * is closed — or after the app is restarted.
 */

export const SEPARATE_HISTORY_KEY = "easy-csv-separate-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredSeparateResult {
  goodPath: string;
  badPath: string;
  goodRows: number;
  badRows: number;
  expectedColumns: number;
  /** ISO 8601 timestamp of when the split finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  inputFile: string;
  delimiter: string;
  quoting: boolean;
  skiprows: number;
  streaming: boolean;
  expectedColumnsInput: string;
}

function isStoredSeparateResult(value: unknown): value is StoredSeparateResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.goodPath === "string" &&
    typeof v.badPath === "string" &&
    typeof v.goodRows === "number" &&
    typeof v.badRows === "number" &&
    typeof v.finishedAt === "string"
  );
}

export function loadLastSeparateResult(): StoredSeparateResult | null {
  try {
    const raw = localStorage.getItem(SEPARATE_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSeparateResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastSeparateResult(result: StoredSeparateResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(SEPARATE_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastSeparateResult(): void {
  try {
    localStorage.removeItem(SEPARATE_HISTORY_KEY);
  } catch {
    // ignore
  }
}

/** `"820 ms"` / `"1.4 s"`; empty string when unknown. */
export function formatElapsed(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** Human-readable label for a raw one-character delimiter. */
export function delimiterLabel(delimiter: string): string {
  switch (delimiter) {
    case "\t":
      return "\\t";
    case " ":
      return "Space";
    default:
      return delimiter;
  }
}
