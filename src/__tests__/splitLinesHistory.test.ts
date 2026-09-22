import { describe, it, expect, beforeEach } from "vitest";
import {
  SPLIT_LINES_HISTORY_KEY,
  clearLastSplitLinesResult,
  loadLastSplitLinesResult,
  saveLastSplitLinesResult,
  type StoredSplitLinesResult,
} from "@/utils/splitLinesHistory";

function sample(
  overrides: Partial<StoredSplitLinesResult> = {},
): StoredSplitLinesResult {
  return {
    outputDir: "/tmp/out",
    samplePaths: ["/tmp/out/a_part1.csv", "/tmp/out/a_part2.csv"],
    fileCount: 3,
    totalRows: 500,
    headerWritten: true,
    finishedAt: "2026-09-22T08:12:33.000Z",
    elapsedMs: 820,
    inputFile: "/tmp/a.csv",
    outDirInput: "/tmp/out",
    linesPerFile: 200,
    noHeaders: false,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("splitLinesHistory", () => {
  it("round-trips a stored result", () => {
    const value = sample();
    saveLastSplitLinesResult(value);

    expect(loadLastSplitLinesResult()).toEqual(value);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLastSplitLinesResult()).toBeNull();
  });

  it("returns null for unparseable or incomplete payloads", () => {
    window.localStorage.setItem(SPLIT_LINES_HISTORY_KEY, "{not json");
    expect(loadLastSplitLinesResult()).toBeNull();

    window.localStorage.setItem(
      SPLIT_LINES_HISTORY_KEY,
      JSON.stringify({ a: 1 }),
    );
    expect(loadLastSplitLinesResult()).toBeNull();

    // A missing option field would be written straight into the form.
    const withoutOption: Record<string, unknown> = { ...sample() };
    delete withoutOption.outDirInput;
    window.localStorage.setItem(
      SPLIT_LINES_HISTORY_KEY,
      JSON.stringify(withoutOption),
    );
    expect(loadLastSplitLinesResult()).toBeNull();

    window.localStorage.setItem(
      SPLIT_LINES_HISTORY_KEY,
      JSON.stringify({ ...sample(), fileCount: "3" }),
    );
    expect(loadLastSplitLinesResult()).toBeNull();
  });

  it("rejects sample paths that are not strings", () => {
    window.localStorage.setItem(
      SPLIT_LINES_HISTORY_KEY,
      JSON.stringify({ ...sample(), samplePaths: [1, 2] }),
    );
    expect(loadLastSplitLinesResult()).toBeNull();
  });

  it("skips oversized payloads instead of failing", () => {
    saveLastSplitLinesResult(sample({ outputDir: `/tmp/${"x".repeat(4000)}` }));
    expect(window.localStorage.getItem(SPLIT_LINES_HISTORY_KEY)).toBeNull();
  });

  it("clears the record", () => {
    saveLastSplitLinesResult(sample());
    clearLastSplitLinesResult();
    expect(loadLastSplitLinesResult()).toBeNull();
  });
});
