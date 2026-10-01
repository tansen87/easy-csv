import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useTabs } from "@/hooks/useTabs";
import type { DuckdbTableInfo, TabularReadResult } from "@/types/xan";

// Design 018: the delimiter is app-wide (settings page ⇄ input node badge).
// `autoDetectDelimiter` decides whether a read detects the delimiter or uses
// the configured one; every tab follows, so there is no per-tab divergence.
// Design 024: every tabular format goes through `read_tabular_file`; only CSV
// carries delimiter bookkeeping, and non-CSV tabs are never re-read.
const mockInvoke = vi.mocked(invoke);

/** The `read_tabular_file` command's payload, mirroring the Rust side. */
function readResult(
  overrides: Partial<TabularReadResult> = {},
): TabularReadResult {
  return {
    headers: ["a", "b"],
    rows: [["1", "2"]],
    delimiter: ",",
    delimiter_source: "detected",
    delimiter_confidence: "high",
    columns: 2,
    format: "csv",
    ...overrides,
  };
}

/** Answers `read_tabular_file` the way the backend would: forced > detected > fallback. */
function mockBackend(detectedDelimiter = ";") {
  mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
    switch (cmd) {
      case "load_recent_files":
        return "[]";
      case "read_tabular_file": {
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
  return mockInvoke.mock.calls.filter(([cmd]) => cmd === "read_tabular_file");
}

function lastReadArgs() {
  const calls = readCalls();
  return calls[calls.length - 1]?.[1] as Record<string, unknown>;
}

function setup(
  delimiter = ",",
  autoDetect = true,
  requestTableSelection?: (
    filePath: string,
    tables: DuckdbTableInfo[],
  ) => Promise<string | null>,
) {
  const addLog = vi.fn();
  const onOpenError = vi.fn();
  const view = renderHook(
    ({ delim, auto }: { delim: string; auto: boolean }) =>
      useTabs(delim, addLog, auto, requestTableSelection, onOpenError),
    { initialProps: { delim: delimiter, auto: autoDetect } },
  );
  return { ...view, addLog, onOpenError };
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
    const { result } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.csv");
    });

    expect(lastReadArgs()).toEqual({
      filePath: "/tmp/a.csv",
      table: null,
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
    expect(tab.inputFormat).toBe("csv");
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
      table: null,
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

  it("ignores the delimiter setting for non-tabular files", async () => {
    mockBackend(";");
    const { result, addLog } = setup(",", false);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/book.xlsx");
    });

    expect(readCalls()).toHaveLength(0);
    expect(tabById(result, "tab-1").inputFile).toBe("/tmp/book.xlsx");
    expect(addLog).toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Non-tabular file"),
    );
  });
});

describe("useTabs tabular formats (design 024)", () => {
  it("reads a parquet file without delimiter bookkeeping", async () => {
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "read_tabular_file") {
        expect(args?.table).toBeNull();
        return readResult({
          format: "parquet",
          delimiter: undefined,
          delimiter_source: undefined,
          delimiter_confidence: undefined,
          source_table: undefined,
        });
      }
      return null;
    });
    const { result, addLog } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.parquet");
    });

    const tab = tabById(result, "tab-1");
    expect(tab.inputFile).toBe("/tmp/a.parquet");
    expect(tab.inputFormat).toBe("parquet");
    expect(tab.headers).toEqual(["a", "b"]);
    expect(tab.defaultDelimiter).toBeUndefined();
    expect(tab.delimiterMode).toBeUndefined();
    expect(tab.sourceTable).toBeUndefined();
    expect(addLog).not.toHaveBeenCalledWith(
      "info",
      expect.stringContaining("Auto-detected"),
    );
  });

  it("does not re-read non-CSV tabs when the delimiter mode changes", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "read_tabular_file")
        return readResult({ format: "parquet", delimiter: undefined });
      return null;
    });
    const { result, rerender } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/a.parquet");
    });
    const before = readCalls().length;

    await act(async () => {
      rerender({ delim: "|", auto: false });
    });
    await act(async () => {
      rerender({ delim: "|", auto: true });
    });

    expect(readCalls().length).toBe(before);
  });

  it("auto-selects the single table of a .duckdb file", async () => {
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables")
        return [{ schema: "main", name: "sales", kind: "BASE TABLE" }];
      if (cmd === "read_tabular_file") {
        expect(args?.table).toBe("sales");
        return readResult({ format: "duckdb", source_table: "sales" });
      }
      return null;
    });
    const { result } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/db.duckdb");
    });

    const tab = tabById(result, "tab-1");
    expect(tab.inputFormat).toBe("duckdb");
    expect(tab.sourceTable).toBe("sales");
  });

  it("qualifies tables outside the main schema", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables")
        return [{ schema: "analytics", name: "items", kind: "BASE TABLE" }];
      if (cmd === "read_tabular_file")
        return readResult({
          format: "duckdb",
          source_table: "analytics.items",
        });
      return null;
    });
    const { result } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/db.duckdb");
    });

    expect(lastReadArgs()).toMatchObject({ table: "analytics.items" });
    expect(tabById(result, "tab-1").sourceTable).toBe("analytics.items");
  });

  it("asks via requestTableSelection when a .duckdb holds several tables", async () => {
    const picker = vi.fn(async () => "other.items");
    mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables")
        return [
          { schema: "main", name: "sales", kind: "BASE TABLE" },
          { schema: "other", name: "items", kind: "VIEW" },
        ];
      if (cmd === "read_tabular_file")
        return readResult({ format: "duckdb", source_table: args?.table });
      return null;
    });
    const { result } = setup(",", true, picker);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/db.duckdb");
    });

    expect(picker).toHaveBeenCalledWith("/tmp/db.duckdb", [
      { schema: "main", name: "sales", kind: "BASE TABLE" },
      { schema: "other", name: "items", kind: "VIEW" },
    ]);
    expect(lastReadArgs()).toMatchObject({ table: "other.items" });
    expect(tabById(result, "tab-1").sourceTable).toBe("other.items");
  });

  it("aborts without reading when the picker returns null", async () => {
    const picker = vi.fn(async () => null);
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables")
        return [
          { schema: "main", name: "sales", kind: "BASE TABLE" },
          { schema: "main", name: "items", kind: "BASE TABLE" },
        ];
      return null;
    });
    const { result, onOpenError } = setup(",", true, picker);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/db.duckdb");
    });

    expect(readCalls()).toHaveLength(0);
    // The open was aborted before any state was written.
    expect(tabById(result, "tab-1").inputFile).toBeUndefined();
    // A user cancel is not an error.
    expect(onOpenError).not.toHaveBeenCalled();
  });

  it("reports a database without tables", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables") return [];
      return null;
    });
    const { result, addLog, onOpenError } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/empty.duckdb");
    });

    expect(readCalls()).toHaveLength(0);
    expect(addLog).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("No tables found"),
    );
    expect(onOpenError).toHaveBeenCalledWith(
      expect.stringContaining("No tables found"),
    );
  });

  it("surfaces a missing duckdb plugin as a visible open error", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "list_duckdb_tables")
        throw new Error(
          "DuckDB plugin is required to read .parquet / .duckdb files. Install it under Settings → Plugins.",
        );
      return null;
    });
    const { result, onOpenError } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/db.duckdb");
    });

    expect(readCalls()).toHaveLength(0);
    // The caller (App) maps this message to the localized toast.
    expect(onOpenError).toHaveBeenCalledWith(
      expect.stringContaining("DuckDB plugin is required"),
    );
  });

  it("surfaces parquet read failures without touching CSV behaviour", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "load_recent_files") return "[]";
      if (cmd === "read_tabular_file")
        throw new Error("IO Error: No magic bytes found at end of file");
      return null;
    });
    const { result, onOpenError } = setup(",", true);

    await act(async () => {
      await result.current.loadCsvData("tab-1", "/tmp/broken.parquet");
    });

    expect(onOpenError).toHaveBeenCalledWith(
      expect.stringContaining("No magic bytes"),
    );
  });
});
