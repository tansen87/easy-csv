/**
 * Persistence for the "Convert to Excel" dialog: the last successful run
 * (output path, row / sheet totals, completion time) plus the options that
 * produced it. Stored in localStorage so the dialog can still show the outcome
 * after it is closed — or after the app is restarted.
 *
 * Mirrors `splitLinesHistory.ts` / `groupEnumHistory.ts`.
 */

export const CSV_TO_EXCEL_HISTORY_KEY = "easy-csv-csv-to-excel-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export interface StoredCsvToExcelResult {
  /** Result: path of the written workbook. */
  outputPath: string;
  totalRows: number;
  sheetCount: number;
  columns: number;
  /** Result: whether the rows were chunked across worksheets. */
  multi: boolean;
  chunkSize: number;
  /** ISO 8601 timestamp of when the conversion finished. */
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

function isStoredCsvToExcelResult(
  value: unknown,
): value is StoredCsvToExcelResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputPath === "string" &&
    typeof v.totalRows === "number" &&
    typeof v.sheetCount === "number" &&
    typeof v.columns === "number" &&
    typeof v.multi === "boolean" &&
    typeof v.chunkSize === "number" &&
    typeof v.finishedAt === "string" &&
    typeof v.inputFile === "string" &&
    typeof v.outDirInput === "string" &&
    typeof v.delimiterMode === "string" &&
    typeof v.ignoreQuoting === "boolean" &&
    typeof v.flexible === "boolean" &&
    typeof v.skiprows === "number"
  );
}

export function loadLastCsvToExcelResult(): StoredCsvToExcelResult | null {
  try {
    const raw = localStorage.getItem(CSV_TO_EXCEL_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredCsvToExcelResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastCsvToExcelResult(result: StoredCsvToExcelResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(CSV_TO_EXCEL_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastCsvToExcelResult(): void {
  try {
    localStorage.removeItem(CSV_TO_EXCEL_HISTORY_KEY);
  } catch {
    // ignore
  }
}
