/**
 * Persistence for the "CSV Encoding" dialog: the last successful conversion
 * (output path, byte counts, completion time) plus the options that produced
 * it. Stored in localStorage so the dialog can still show the outcome after it
 * is closed — or after the app is restarted.
 *
 * Deliberate mirror of `separateHistory.ts` (same key/value shape, same
 * staleness semantics) so both file-level dialogs behave the same way.
 */

export const ENCODING_HISTORY_KEY = "easy-csv-encoding-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredEncodingResult {
  /** Path the converted file was written to. */
  outputPath: string;
  bytesRead: number;
  bytesWritten: number;
  /** ISO 8601 timestamp of when the conversion finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  inputFile: string;
  sourceEncoding: string;
  targetEncoding: string;
}

/**
 * Every field except `elapsedMs` is required: a payload missing one of them is
 * dropped rather than partially loaded, so the dialog never renders `undefined`
 * into a path input or an encoding select. New options must therefore be added
 * as optional (`?`) to keep older records loadable.
 */
function isStoredEncodingResult(value: unknown): value is StoredEncodingResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputPath === "string" &&
    typeof v.bytesRead === "number" &&
    typeof v.bytesWritten === "number" &&
    typeof v.finishedAt === "string" &&
    typeof v.inputFile === "string" &&
    typeof v.sourceEncoding === "string" &&
    typeof v.targetEncoding === "string"
  );
}

export function loadLastEncodingResult(): StoredEncodingResult | null {
  try {
    const raw = localStorage.getItem(ENCODING_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredEncodingResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastEncodingResult(result: StoredEncodingResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(ENCODING_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastEncodingResult(): void {
  try {
    localStorage.removeItem(ENCODING_HISTORY_KEY);
  } catch {
    // ignore
  }
}
