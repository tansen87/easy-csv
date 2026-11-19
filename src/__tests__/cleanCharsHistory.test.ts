import { describe, it, expect, beforeEach } from "vitest";
import {
  CLEAN_CHARS_HISTORY_KEY,
  clearLastCleanCharsResult,
  loadLastCleanCharsResult,
  saveLastCleanCharsResult,
  type StoredCleanCharsResult,
} from "@/utils/cleanCharsHistory";

function sample(): StoredCleanCharsResult {
  return {
    outputPath: "/tmp/orders_clean.csv",
    rows: 12,
    removedChars: 30,
    replacedChars: 4,
    unclosedLines: 0,
    finishedAt: "2026-11-19T06:32:00.000Z",
    elapsedMs: 620,
    inputFile: "/tmp/orders.csv",
    removeCr: true,
    mergeBlankLines: true,
    tabToSpace: true,
    removeQuotes: true,
    customChars: "",
    mergeQuotedNewlines: false,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("cleanCharsHistory", () => {
  it("round-trips the last result", () => {
    const stored = sample();
    saveLastCleanCharsResult(stored);
    expect(loadLastCleanCharsResult()).toEqual(stored);
  });

  it("clears the stored record", () => {
    saveLastCleanCharsResult(sample());
    clearLastCleanCharsResult();
    expect(window.localStorage.getItem(CLEAN_CHARS_HISTORY_KEY)).toBeNull();
    expect(loadLastCleanCharsResult()).toBeNull();
  });

  it("ignores malformed payloads", () => {
    window.localStorage.setItem(CLEAN_CHARS_HISTORY_KEY, '{"rows":"nope"}');
    expect(loadLastCleanCharsResult()).toBeNull();
  });

  it("skips payloads larger than the storage budget", () => {
    const stored = sample();
    stored.outputPath = "/tmp/" + "x".repeat(3000);
    saveLastCleanCharsResult(stored);
    expect(window.localStorage.getItem(CLEAN_CHARS_HISTORY_KEY)).toBeNull();
  });
});
