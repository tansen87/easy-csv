/**
 * Persistence for the "Number Rows per Group" dialog: the last successful run
 * (output path, row / group totals, completion time) plus the options that
 * produced it. Stored in localStorage so the dialog can still show the outcome
 * after it is closed — or after the app is restarted.
 *
 * Mirrors `splitLinesHistory.ts` / `separateHistory.ts`.
 */

export const GROUP_ENUM_HISTORY_KEY = "easy-csv-group-enum-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredGroupEnumResult {
  /** Result: path of the written CSV. */
  outputPath: string;
  totalRows: number;
  groupCount: number;
  /** Result: name of the added index column. */
  indexColumn: string;
  /** Result: column the numbering was grouped by. */
  groupColumn: string;
  /** Result: whether constant-memory "contiguous groups" mode was used. */
  sorted: boolean;
  /** ISO 8601 timestamp of when the run finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  inputFile: string;
  /** Raw "output directory" field; empty means "next to the input". */
  outDirInput: string;
  delimiterMode: string;
  ignoreQuoting: boolean;
  /** Whether rows with a different field count are allowed through. */
  flexible: boolean;
  skiprows: number;
}

function isStoredGroupEnumResult(value: unknown): value is StoredGroupEnumResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputPath === "string" &&
    typeof v.totalRows === "number" &&
    typeof v.groupCount === "number" &&
    typeof v.indexColumn === "string" &&
    typeof v.groupColumn === "string" &&
    typeof v.sorted === "boolean" &&
    typeof v.finishedAt === "string" &&
    typeof v.inputFile === "string" &&
    typeof v.outDirInput === "string" &&
    typeof v.delimiterMode === "string" &&
    typeof v.ignoreQuoting === "boolean" &&
    typeof v.flexible === "boolean" &&
    typeof v.skiprows === "number"
  );
}

export function loadLastGroupEnumResult(): StoredGroupEnumResult | null {
  try {
    const raw = localStorage.getItem(GROUP_ENUM_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredGroupEnumResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastGroupEnumResult(result: StoredGroupEnumResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(GROUP_ENUM_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastGroupEnumResult(): void {
  try {
    localStorage.removeItem(GROUP_ENUM_HISTORY_KEY);
  } catch {
    // ignore
  }
}
