/**
 * Persistence for the "Clean Characters" dialog (design 064): the last
 * successful run plus the options that produced it. Stored in localStorage so
 * the dialog can still show the outcome after it is closed.
 */

export const CLEAN_CHARS_HISTORY_KEY = "easy-csv-clean-chars-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredCleanCharsResult {
  outputPath: string;
  rows: number;
  removedChars: number;
  replacedChars: number;
  /** Physical lines still inside an unclosed quote at EOF. */
  unclosedLines?: number;
  /** ISO 8601 timestamp of when the run finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  inputFile: string;
  removeCr: boolean;
  mergeBlankLines: boolean;
  tabToSpace: boolean;
  removeQuotes: boolean;
  customChars: string;
  mergeQuotedNewlines: boolean;
}

function isStoredCleanCharsResult(
  value: unknown,
): value is StoredCleanCharsResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputPath === "string" &&
    typeof v.rows === "number" &&
    typeof v.removedChars === "number" &&
    typeof v.replacedChars === "number" &&
    typeof v.finishedAt === "string"
  );
}

export function loadLastCleanCharsResult(): StoredCleanCharsResult | null {
  try {
    const raw = localStorage.getItem(CLEAN_CHARS_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredCleanCharsResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastCleanCharsResult(result: StoredCleanCharsResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(CLEAN_CHARS_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastCleanCharsResult(): void {
  try {
    localStorage.removeItem(CLEAN_CHARS_HISTORY_KEY);
  } catch {
    // ignore
  }
}
