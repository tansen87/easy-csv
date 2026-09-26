import { describe, it, expect, beforeEach } from "vitest";
import {
  ENCODING_HISTORY_KEY,
  clearLastEncodingResult,
  loadLastEncodingResult,
  saveLastEncodingResult,
  type StoredEncodingResult,
} from "@/utils/encodingHistory";

function sample(
  overrides: Partial<StoredEncodingResult> = {},
): StoredEncodingResult {
  return {
    outputPath: "/tmp/a_utf8.csv",
    bytesRead: 2048,
    bytesWritten: 1024,
    finishedAt: "2026-09-21T08:12:33.000Z",
    elapsedMs: 420,
    inputFile: "/tmp/a.csv",
    sourceEncoding: "gbk",
    targetEncoding: "utf-8",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("encodingHistory", () => {
  it("round-trips a stored result", () => {
    const value = sample();
    saveLastEncodingResult(value);

    expect(loadLastEncodingResult()).toEqual(value);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLastEncodingResult()).toBeNull();
  });

  it("returns null for unparseable or incomplete payloads", () => {
    window.localStorage.setItem(ENCODING_HISTORY_KEY, "{not json");
    expect(loadLastEncodingResult()).toBeNull();

    window.localStorage.setItem(ENCODING_HISTORY_KEY, JSON.stringify({ a: 1 }));
    expect(loadLastEncodingResult()).toBeNull();

    window.localStorage.setItem(
      ENCODING_HISTORY_KEY,
      JSON.stringify({ ...sample(), bytesWritten: "1024" }),
    );
    expect(loadLastEncodingResult()).toBeNull();

    // Options are required as well: a record without them would pre-fill
    // `undefined` into the path inputs / encoding selects.
    const { targetEncoding: _dropped, ...withoutOptions } = sample();
    window.localStorage.setItem(
      ENCODING_HISTORY_KEY,
      JSON.stringify(withoutOptions),
    );
    expect(loadLastEncodingResult()).toBeNull();
  });

  it("skips oversized payloads instead of failing", () => {
    saveLastEncodingResult(
      sample({ outputPath: `/tmp/${"x".repeat(4000)}.csv` }),
    );
    expect(window.localStorage.getItem(ENCODING_HISTORY_KEY)).toBeNull();
  });

  it("clears the record", () => {
    saveLastEncodingResult(sample());
    clearLastEncodingResult();
    expect(loadLastEncodingResult()).toBeNull();
  });
});
