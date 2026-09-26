/**
 * Persistence for the "Split by Lines" dialog: the last successful run (output
 * directory, part count, row totals, completion time) plus the options that
 * produced it. Stored in localStorage so the dialog can still show the outcome
 * after it is closed — or after the app is restarted.
 *
 * Mirrors `separateHistory.ts` / `encodingHistory.ts` (design 017 / 020), with
 * one deliberate difference: the split emits an arbitrary number of part files,
 * so the record keeps the **output directory** (always revealable, whatever the
 * part count) plus a few sample paths for display instead of every path.
 */

export const SPLIT_LINES_HISTORY_KEY = "easy-csv-split-lines-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredSplitLinesResult {
  /** Result: directory every part was written to. */
  outputDir: string;
  /** Result: leading part paths, kept for display only (see `fileCount`). */
  samplePaths: string[];
  fileCount: number;
  totalRows: number;
  /** Result: whether the first line was copied into every part as a header. */
  headerWritten: boolean;
  /** ISO 8601 timestamp of when the split finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  inputFile: string;
  /** Raw "output directory" field; empty means "next to the input". */
  outDirInput: string;
  linesPerFile: number;
  noHeaders: boolean;
}

function isStoredSplitLinesResult(
  value: unknown,
): value is StoredSplitLinesResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputDir === "string" &&
    Array.isArray(v.samplePaths) &&
    v.samplePaths.every((p) => typeof p === "string") &&
    typeof v.fileCount === "number" &&
    typeof v.totalRows === "number" &&
    typeof v.headerWritten === "boolean" &&
    typeof v.finishedAt === "string" &&
    typeof v.inputFile === "string" &&
    typeof v.outDirInput === "string" &&
    typeof v.linesPerFile === "number" &&
    typeof v.noHeaders === "boolean"
  );
}

export function loadLastSplitLinesResult(): StoredSplitLinesResult | null {
  try {
    const raw = localStorage.getItem(SPLIT_LINES_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSplitLinesResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastSplitLinesResult(result: StoredSplitLinesResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(SPLIT_LINES_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastSplitLinesResult(): void {
  try {
    localStorage.removeItem(SPLIT_LINES_HISTORY_KEY);
  } catch {
    // ignore
  }
}
