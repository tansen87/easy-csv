import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useTabs } from "@/hooks/useTabs";
import type { CsvReadResult } from "@/types/xan";

// Design 018: the delimiter is app-wide (settings page ⇄ input node badge).
// `autoDetectDelimiter` decides whether a read detects the delimiter or uses
// the configured one; every tab follows, so there is no per-tab divergence.
const mockInvoke = vi.mocked(invoke);

/** The `read_csv_file` command's payload, mirroring the Rust side. */
function readResult(overrides: Partial<CsvReadResult> = {}): CsvReadResult {
  return {
    headers: ["a", "b"],
    rows: [["1", "2"]],
    delimiter: ",",
    delimiter_source: "detected",
    delimiter_confidence: "high",
    columns: 2,
    ...overrides,
  };
}

/** Answers `read_csv_file` the way the backend would: forced > detected > fallback. */
function mockBackend(detectedDelimiter = ";") {
  mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
    switch (cmd) {
      case "load_recent_files":
        return "[]";
      case "read_csv_file": {
        const forced = args?.delimiter as string | null;
        if (forced) {
          // A trailing-trimmed single byte is what the Rust side resolves.
          return readResult({
            delimiter: forced,
            delimiter_source: "forced",
            columns: 2,
          });
        }
        return readResult({ delimiter: detectedDelimiter });
      }
      default:
        return null;
    }
  });
}

function readCalls() {
  return mockInvoke.mock.calls.filter(([cmd]) => cmd === "read_csv_file");
}

function lastReadArgs() {
  const calls = readCalls();
  return calls[calls.length - 1]?.[1] as Record<string, unknown>;
}

function setup(delimiter = ",", autoDetect = true) {
  const addLog = vi.fn();
  const view = renderHook(
    ({ delim, auto }: { delim: string; auto: boolean }) =>
      useTabs(delim, addLog, auto),
    { initialProps: { delim: delimiter, auto: autoDetect } },
  );
  return { ...view, addLog };
}

function tabById(result: { current: ReturnType<typeof useTabs> }, id: string) {
  return result.current.tabs.find((t) => t.id === id)!;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTabs delimiter resolution (design 018)", () => {
  it("detects the delimiter while auto-detection is on", async () => {
    mockBackend(";");
    const { result, addLog } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv");
    });

    expect(lastReadArgs()).toEqual({
      filePath: "/tmp/a.csv",
      delimiter: null,
      fallbackDelimiter: ",",
      limit: 31,
    });

    const tab = tabById(result, "tab-1");
    expect(tab.defaultDelimiter).toBe(";");
    expect(tab.delimiterMode).toBe("auto");
    expect(tab.delimiterSource).toBe("detected");
    expect(tab.delimiterConfidence).toBe("high");
    expect(tab.headers).toEqual(["a", "b"]);

    // Detection that disagrees with the configured default is reported once.
    expect(addLog).toHaveBeenCalledWith(
      "info",
      expect.stringContaining('Auto-detected delimiter ";"'),
    );
  });

  it("stays quiet when the detected delimiter equals the configured one", async () => {
    mockBackend(",");
    const { result, addLog } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv");
    });

    expect(addLog).not.toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Auto-detected"),
    );
  });

  it("reads with the configured delimiter when auto-detection is off", async () => {
    mockBackend(";");
    const { result } = setup("|", false);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv");
    });

    expect(lastReadArgs()).toEqual({
      filePath: "/tmp/a.csv",
      delimiter: "|",
      fallbackDelimiter: "|",
      limit: 31,
    });

    const tab = tabById(result, "tab-1");
    expect(tab.defaultDelimiter).toBe("|");
    expect(tab.delimiterMode).toBe("|");
    expect(tab.delimiterSource).toBe("forced");
  });

  it("re-reads the open tab when the mode changes from either control", async () => {
    mockBackend(";");
    const { result, rerender } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv");
    });
    expect(lastReadArgs()).toMatchObject({ delimiter: null });

    // e.g. picking "Pipe (|)" in the settings page or the node badge.
    await act(async () => {
      rerender({ delim: "|", auto: false });
    });
    await waitFor(() =>
      expect(lastReadArgs()).toMatchObject({ delimiter: "|" }),
    );
    expect(tabById(result, "tab-1").defaultDelimiter).toBe("|");

    // ... and switching back to auto-detection.
    await act(async () => {
      rerender({ delim: "|", auto: true });
    });
    await waitFor(() =>
      expect(lastReadArgs()).toMatchObject({ delimiter: null }),
    );
    expect(tabById(result, "tab-1").delimiterMode).toBe("auto");
  });

  it("lets an imported pipeline's delimiter win for that read only", async () => {
    mockBackend(";");
    const { result } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv", ";");
    });

    expect(lastReadArgs()).toMatchObject({ delimiter: ";" });
    expect(tabById(result, "tab-1").delimiterMode).toBe(";");
    expect(tabById(result, "tab-1").delimiterSource).toBe("forced");
  });

  it("ignores the delimiter setting for non-CSV files", async () => {
    mockBackend(";");
    const { result, addLog } = setup(",", false);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/book.xlsx");
    });

    expect(readCalls()).toHaveLength(0);
    expect(tabById(result, "tab-1").inputFile).toBe("/tmp/book.xlsx");
    expect(addLog).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Non-CSV file"),
    );
  });
});
