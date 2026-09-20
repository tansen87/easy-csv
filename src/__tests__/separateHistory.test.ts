import { describe, it, expect, beforeEach } from "vitest";
import {
  SEPARATE_HISTORY_KEY,
  clearLastSeparateResult,
  delimiterLabel,
  formatElapsed,
  loadLastSeparateResult,
  saveLastSeparateResult,
  type StoredSeparateResult,
} from "@/utils/separateHistory";

function sample(
  overrides: Partial<StoredSeparateResult> = {},
): StoredSeparateResult {
  return {
    goodPath: "/tmp/a_good.csv",
    badPath: "/tmp/a_bad.csv",
    goodRows: 10,
    badRows: 2,
    expectedColumns: 3,
    finishedAt: "2026-09-20T08:12:33.000Z",
    elapsedMs: 820,
    inputFile: "/tmp/a.csv",
    delimiter: ";",
    quoting: true,
    skiprows: 0,
    streaming: true,
    expectedColumnsInput: "",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("separateHistory", () => {
  it("round-trips a stored result", () => {
    const value = sample();
    saveLastSeparateResult(value);

    expect(loadLastSeparateResult()).toEqual(value);
  });

  it("returns null when nothing is stored", () => {
    expect(loadLastSeparateResult()).toBeNull();
  });

  it("returns null for unparseable or incomplete payloads", () => {
    window.localStorage.setItem(SEPARATE_HISTORY_KEY, "{not json");
    expect(loadLastSeparateResult()).toBeNull();

    window.localStorage.setItem(SEPARATE_HISTORY_KEY, JSON.stringify({ a: 1 }));
    expect(loadLastSeparateResult()).toBeNull();

    window.localStorage.setItem(
      SEPARATE_HISTORY_KEY,
      JSON.stringify({ ...sample(), goodRows: "10" }),
    );
    expect(loadLastSeparateResult()).toBeNull();
  });

  it("skips oversized payloads instead of failing", () => {
    saveLastSeparateResult(
      sample({ goodPath: `/tmp/${"x".repeat(4000)}.csv` }),
    );
    expect(window.localStorage.getItem(SEPARATE_HISTORY_KEY)).toBeNull();
  });

  it("clears the record", () => {
    saveLastSeparateResult(sample());
    clearLastSeparateResult();
    expect(loadLastSeparateResult()).toBeNull();
  });
});

describe("separateHistory formatting helpers", () => {
  it("formats elapsed durations", () => {
    expect(formatElapsed(420)).toBe("420 ms");
    expect(formatElapsed(1500)).toBe("1.5 s");
    expect(formatElapsed(0)).toBe("0 ms");
    expect(formatElapsed(undefined)).toBe("");
    expect(formatElapsed(Number.NaN)).toBe("");
  });

  it("renders readable delimiter labels", () => {
    expect(delimiterLabel(",")).toBe(",");
    expect(delimiterLabel("\t")).toBe("\\t");
    expect(delimiterLabel(";")).toBe(";");
  });
});
