import { describe, it, expect, beforeEach } from "vitest";
import {
  EXCEL_MERGE_HISTORY_KEY,
  loadLastExcelMergeResult,
  saveLastExcelMergeResult,
  clearLastExcelMergeResult,
  type StoredExcelMergeResult,
} from "@/utils/excelMergeHistory";

const base: StoredExcelMergeResult = {
  outputPath: "/data/out/merged.xlsx",
  outputFormat: "xlsx",
  sourceFileCount: 3,
  sheetCount: 4,
  totalRows: 120,
  header: ["source", "id", "name"],
  skipped: [],
  unionSummary: null,
  finishedAt: "2026-09-29T08:00:00.000Z",
  elapsedMs: 900,
  sources: ["/data/in"],
  recursive: true,
  extensions: ["xlsx"],
  sheetMode: "all",
  sheetName: "",
  missingSheet: "error",
  align: "union",
  sourceColumn: "file_sheet",
  outputPathInput: "",
};

function seed(overrides: Partial<StoredExcelMergeResult> = {}): void {
  window.localStorage.setItem(
    EXCEL_MERGE_HISTORY_KEY,
    JSON.stringify({ ...base, ...overrides }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("excelMergeHistory", () => {
  it("round-trips a valid record", () => {
    saveLastExcelMergeResult(base);
    expect(loadLastExcelMergeResult()).toEqual(base);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    window.localStorage.setItem(EXCEL_MERGE_HISTORY_KEY, "{not json");
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects records with missing option fields", () => {
    const broken = { ...base } as Record<string, unknown>;
    delete broken.align;
    window.localStorage.setItem(
      EXCEL_MERGE_HISTORY_KEY,
      JSON.stringify(broken),
    );
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects records with wrong field types", () => {
    seed({ totalRows: "many" as unknown as number });
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects records with an unknown enum value", () => {
    seed({ align: "fuzzy" as unknown as StoredExcelMergeResult["align"] });
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects a malformed union summary", () => {
    seed({
      unionSummary: {
        finalColumns: ["id"],
        notInAllParts: [{ column: 3, presentIn: 1, total: 2 }],
        nearDuplicateColumns: [],
      } as unknown as StoredExcelMergeResult["unionSummary"],
    });
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("skips persistence when the payload exceeds the size limit", () => {
    const huge: StoredExcelMergeResult = {
      ...base,
      header: Array.from(
        { length: 400 },
        (_, i) => `column_${i}_${"x".repeat(20)}`,
      ),
    };
    saveLastExcelMergeResult(huge);
    expect(loadLastExcelMergeResult()).toBeNull();
    expect(window.localStorage.getItem(EXCEL_MERGE_HISTORY_KEY)).toBeNull();
  });

  it("clears the record", () => {
    saveLastExcelMergeResult(base);
    clearLastExcelMergeResult();
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  // -- design 026: optional new fields, backward compatible --------------------

  it("accepts a 025-era record without the 026 fields", () => {
    // `base` has no outputShape/outputs/nameMappings/sheetFilter — the exact
    // shape the 025 dialog persisted. It must still load.
    expect(loadLastExcelMergeResult()).toBeNull(); // nothing seeded yet
    seed();
    const loaded = loadLastExcelMergeResult();
    expect(loaded).not.toBeNull();
    expect(loaded?.outputShape).toBeUndefined();
    expect(loaded?.outputs).toBeUndefined();
  });

  it("round-trips a 026 record with shape, outputs and mappings", () => {
    const record: StoredExcelMergeResult = {
      ...base,
      outputShape: "by_sheet",
      sheetFilter: ["s1", "s2"],
      outputs: [
        { path: "/data/out/s1.xlsx", sheetCount: 2, totalRows: 10 },
        { path: "/data/out/s2.xlsx", sheetCount: 2, totalRows: 12 },
      ],
      nameMappings: [["S1", "S1_2"]],
    };
    saveLastExcelMergeResult(record);
    expect(loadLastExcelMergeResult()).toEqual(record);
  });

  it("rejects a 026 record with a malformed outputs list", () => {
    seed({
      outputs: [{ path: 3, sheetCount: 1, totalRows: 1 }],
    } as unknown as StoredExcelMergeResult);
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects a 026 record with a malformed nameMappings list", () => {
    seed({
      nameMappings: [["a", "b", "c"]],
    } as unknown as StoredExcelMergeResult);
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("rejects a record with an unknown output shape", () => {
    seed({
      outputShape: "sideways",
    } as unknown as StoredExcelMergeResult);
    expect(loadLastExcelMergeResult()).toBeNull();
  });
});
