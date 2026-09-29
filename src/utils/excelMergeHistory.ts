/**
 * Persistence for the "Merge Excel" dialog: the last successful run (output
 * file, source/sheet/row totals, final columns, completion time) plus the
 * options that produced it. Stored in localStorage so the dialog can still
 * show the outcome after it is closed — or after the app is restarted.
 *
 * Mirrors `splitLinesHistory.ts` / `separateHistory.ts` (design 021 / 017).
 * Unlike the split (arbitrary part count → stores a directory), the merge
 * produces exactly ONE output file, so the record keeps the file path itself.
 */

export const EXCEL_MERGE_HISTORY_KEY = "easy-csv-excel-merge-last";

/** Skip persistence when the payload is unexpectedly large (very long paths). */
const MAX_BYTES = 2048;

export type ExcelSheetMode = "first" | "name" | "all";
export type ExcelAlign = "union" | "strict" | "intersection";
export type ExcelSourceColumn = "none" | "file" | "file_sheet";
export type ExcelMissingSheet = "error" | "skip";
export type ExcelOutputFormat = "csv" | "xlsx";

export interface StoredExcelMergeResult {
  /** Result: the single merged output file. */
  outputPath: string;
  outputFormat: ExcelOutputFormat;
  sourceFileCount: number;
  sheetCount: number;
  totalRows: number;
  /** Result: final columns of the merged table (source column first when on). */
  header: string[];
  /** Result: workbooks/sheets excluded during the merge, with reasons. */
  skipped: string[];
  /** Result: quantified widening of the default union alignment. */
  unionSummary: {
    finalColumns: string[];
    notInAllParts: { column: string; presentIn: number; total: number }[];
    nearDuplicateColumns: [string, string][];
  } | null;
  /** ISO 8601 timestamp of when the merge finished. */
  finishedAt: string;
  /** Backend-reported duration in milliseconds. */
  elapsedMs?: number;
  /** Options that produced this result (used to pre-fill the dialog). */
  sources: string[];
  recursive: boolean;
  extensions: string[];
  sheetMode: ExcelSheetMode;
  sheetName: string;
  missingSheet: ExcelMissingSheet;
  align: ExcelAlign;
  sourceColumn: ExcelSourceColumn;
  outputPathInput: string;
}

const SHEET_MODES: ExcelSheetMode[] = ["first", "name", "all"];
const ALIGNS: ExcelAlign[] = ["union", "strict", "intersection"];
const SOURCE_COLUMNS: ExcelSourceColumn[] = ["none", "file", "file_sheet"];
const MISSING_SHEETS: ExcelMissingSheet[] = ["error", "skip"];
const OUTPUT_FORMATS: ExcelOutputFormat[] = ["csv", "xlsx"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function oneOf<T extends string>(value: unknown, allowed: T[]): value is T {
  return typeof value === "string" && (allowed as string[]).includes(value);
}

function isUnionSummary(
  value: unknown,
): value is StoredExcelMergeResult["unionSummary"] {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const coverages = v.notInAllParts;
  const pairs = v.nearDuplicateColumns;
  return (
    isStringArray(v.finalColumns) &&
    Array.isArray(coverages) &&
    coverages.every(
      (c) =>
        c &&
        typeof c === "object" &&
        typeof (c as Record<string, unknown>).column === "string" &&
        typeof (c as Record<string, unknown>).presentIn === "number" &&
        typeof (c as Record<string, unknown>).total === "number",
    ) &&
    Array.isArray(pairs) &&
    pairs.every(
      (p) =>
        Array.isArray(p) &&
        p.length === 2 &&
        p.every((x) => typeof x === "string"),
    )
  );
}

function isStoredExcelMergeResult(
  value: unknown,
): value is StoredExcelMergeResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.outputPath === "string" &&
    oneOf(v.outputFormat, OUTPUT_FORMATS) &&
    typeof v.sourceFileCount === "number" &&
    typeof v.sheetCount === "number" &&
    typeof v.totalRows === "number" &&
    isStringArray(v.header) &&
    isStringArray(v.skipped) &&
    isUnionSummary(v.unionSummary) &&
    typeof v.finishedAt === "string" &&
    isStringArray(v.sources) &&
    typeof v.recursive === "boolean" &&
    isStringArray(v.extensions) &&
    oneOf(v.sheetMode, SHEET_MODES) &&
    typeof v.sheetName === "string" &&
    oneOf(v.missingSheet, MISSING_SHEETS) &&
    oneOf(v.align, ALIGNS) &&
    oneOf(v.sourceColumn, SOURCE_COLUMNS) &&
    typeof v.outputPathInput === "string"
  );
}

export function loadLastExcelMergeResult(): StoredExcelMergeResult | null {
  try {
    const raw = localStorage.getItem(EXCEL_MERGE_HISTORY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredExcelMergeResult(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastExcelMergeResult(result: StoredExcelMergeResult): void {
  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > MAX_BYTES) return;
    localStorage.setItem(EXCEL_MERGE_HISTORY_KEY, serialized);
  } catch {
    // Private mode / quota errors degrade to session-only display.
  }
}

export function clearLastExcelMergeResult(): void {
  try {
    localStorage.removeItem(EXCEL_MERGE_HISTORY_KEY);
  } catch {
    // ignore
  }
}
