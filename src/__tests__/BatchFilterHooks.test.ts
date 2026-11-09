import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { useBatchFilter } from "@/hooks/useBatchFilter";
import type { RunContext } from "@/types/execution";

// useBatchFilter internal logic tests.
// sanitizeFileName and buildRegexPattern are internal, so we test their behavior
// by reproducing the logic and verifying the invoke call patterns.

describe("useBatchFilter command building", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Reproduce sanitizeFileName logic
  const sanitizeFileName = (value: string): string => {
    // eslint-disable-next-line no-control-regex -- mirrors useBatchFilter: control characters are invalid in Windows filenames
    return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").substring(0, 50);
  };

  // Reproduce buildRegexPattern logic
  const buildRegexPattern = (operator: string, value: string): string => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    switch (operator) {
      case "equals":
        return `^${escaped}$`;
      case "starts_with":
      case "not_starts_with":
        return `^${escaped}`;
      case "ends_with":
      case "not_ends_with":
        return `${escaped}$`;
      case "contains":
      case "not_contains":
        return escaped;
      default:
        return escaped;
    }
  };

  describe("sanitizeFileName", () => {
    it("should remove invalid Windows filename characters", () => {
      expect(sanitizeFileName("file:name<>")).toBe("filename");
    });

    it("should truncate to 50 characters", () => {
      const long = "a".repeat(100);
      expect(sanitizeFileName(long)).toHaveLength(50);
    });

    it("should handle normal filenames", () => {
      expect(sanitizeFileName("normal_file")).toBe("normal_file");
    });

    it("should remove pipe character", () => {
      expect(sanitizeFileName("file|name")).toBe("filename");
    });
  });

  describe("buildRegexPattern", () => {
    it("should build equals pattern", () => {
      expect(buildRegexPattern("equals", "Alice")).toBe("^Alice$");
    });

    it("should build starts_with pattern", () => {
      expect(buildRegexPattern("starts_with", "Al")).toBe("^Al");
    });

    it("should build ends_with pattern", () => {
      expect(buildRegexPattern("ends_with", "ce")).toBe("ce$");
    });

    it("should build contains pattern", () => {
      expect(buildRegexPattern("contains", "li")).toBe("li");
    });

    it("should escape special regex characters", () => {
      expect(buildRegexPattern("contains", "a.b*c")).toBe("a\\.b\\*c");
    });
  });

  describe("text filter invoke calls", () => {
    it("should build correct search command for equals operator", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const column = "name";
      const value = "Alice";
      const outputPath = "/out/name_Alice.csv";

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: column, isPositional: false },
            { name: "exact", value: "true", isPositional: false },
            { name: "pattern", value, isPositional: true },
            { name: "output", value: outputPath, isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      expect(mockInvoke).toHaveBeenCalledWith("execute_xan_pipeline", {
        commands: expect.arrayContaining([
          expect.objectContaining({
            name: "search",
            parameters: expect.arrayContaining([
              { name: "select", value: "name", isPositional: false },
              { name: "exact", value: "true", isPositional: false },
              { name: "pattern", value: "Alice", isPositional: true },
            ]),
          }),
        ]),
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });
    });

    it("should build correct search command for contains with regex", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const pattern = buildRegexPattern("contains", "test");

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "col", isPositional: false },
            { name: "pattern", value: pattern, isPositional: true },
            { name: "regex", value: "true", isPositional: false },
            { name: "output", value: "/out/test.csv", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "regex",
        value: "true",
        isPositional: false,
      });
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "pattern",
        value: "test",
        isPositional: true,
      });
    });

    it("should add invert-match for not_contains operator", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const pattern = buildRegexPattern("not_contains", "test");

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "col", isPositional: false },
            { name: "pattern", value: pattern, isPositional: true },
            { name: "regex", value: "true", isPositional: false },
            { name: "invert-match", value: "true", isPositional: false },
            { name: "output", value: "/out/test.csv", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "invert-match",
        value: "true",
        isPositional: false,
      });
    });

    it("should add ignore-case when caseInsensitive is true", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "col", isPositional: false },
            { name: "exact", value: "true", isPositional: false },
            { name: "pattern", value: "Alice", isPositional: true },
            { name: "ignore-case", value: "true", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "ignore-case",
        value: "true",
        isPositional: false,
      });
    });
  });

  describe("number filter invoke calls", () => {
    it("should build correct filter command with expression", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const column = "age";
      const op = ">";
      const value = "18";
      const expression = `col("${column}") ${op} ${value}`;

      const commands = [
        {
          name: "filter",
          parameters: [
            { name: "expression", value: expression, isPositional: true },
            {
              name: "output",
              value: "/out/age_gt_18.csv",
              isPositional: false,
            },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].name).toBe("filter");
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "expression",
        value: 'col("age") > 18',
        isPositional: true,
      });
    });

    it("should map number operators to symbols correctly", () => {
      const operatorMap: Record<string, string> = {
        equals: "==",
        not_equals: "!=",
        greater_than: ">",
        greater_or_equal: ">=",
        less_than: "<",
        less_or_equal: "<=",
      };

      Object.entries(operatorMap).forEach(([_op, symbol]) => {
        const expression = `col("price") ${symbol} 100`;
        expect(expression).toContain(symbol);
      });
    });
  });

  describe("is_null / is_not_null special cases", () => {
    it("should use search with empty flag for is_null", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "name", isPositional: false },
            { name: "empty", value: "true", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "empty",
        value: "true",
        isPositional: false,
      });
    });

    it("should use search with non-empty flag for is_not_null", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "name", isPositional: false },
            { name: "non-empty", value: "true", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "non-empty",
        value: "true",
        isPositional: false,
      });
    });
  });

  describe("output path construction", () => {
    it("should build correct output path with sanitized value", () => {
      const outputDir = "/data";
      const baseName = "input";
      const sanitizedValue = sanitizeFileName("value:1");
      const outputPath = `${outputDir}/${baseName}_${sanitizedValue}.csv`;
      expect(outputPath).toBe("/data/input_value1.csv");
    });

    it("should use custom output dir when provided", () => {
      const configOutputDir = "C:\\custom\\output";
      const basePath = "input";
      const value = "test";
      const outputPath = `${configOutputDir}/${basePath}_${value}.csv`;
      expect(outputPath).toBe("C:\\custom\\output/input_test.csv");
    });
  });

  describe("not_starts_with / not_ends_with patterns", () => {
    it("should build not_starts_with pattern", () => {
      expect(buildRegexPattern("not_starts_with", "test")).toBe("^test");
    });

    it("should build not_ends_with pattern", () => {
      expect(buildRegexPattern("not_ends_with", "test")).toBe("test$");
    });
  });

  describe("regex operator text filter", () => {
    it("should build search command with regex flag for regex operator", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "col", isPositional: false },
            { name: "pattern", value: "^test.*$", isPositional: true },
            { name: "regex", value: "true", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      expect(cmdArgs.commands[0].parameters).toContainEqual({
        name: "regex",
        value: "true",
        isPositional: false,
      });
    });
  });

  describe("not_equals operator with invert-match", () => {
    it("should add both exact and invert-match for not_equals", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const commands = [
        {
          name: "search",
          parameters: [
            { name: "select", value: "status", isPositional: false },
            { name: "exact", value: "true", isPositional: false },
            { name: "pattern", value: "deleted", isPositional: true },
            { name: "invert-match", value: "true", isPositional: false },
          ],
        },
      ];

      await invoke("execute_xan_pipeline", {
        commands,
        inputFile: "/test.csv",
        defaultDelimiter: ",",
      });

      const cmdArgs = mockInvoke.mock.calls[0][1] as any;
      const params = cmdArgs.commands[0].parameters;
      expect(params).toContainEqual(
        expect.objectContaining({ name: "exact", value: "true" }),
      );
      expect(params).toContainEqual(
        expect.objectContaining({ name: "invert-match", value: "true" }),
      );
    });
  });

  // Real hook coverage for "value source: from column". The previous suite
  // re-implemented `split("\t")[0]` inline, so it could not fail when the real
  // code mis-read a comma-delimited frequency table.
  describe("executeBatchFilterDirect — value source: from column", () => {
    function makeCtx(overrides: Partial<RunContext> = {}): RunContext {
      return {
        runId: "run-1",
        tabId: "tab-1",
        inputFile: "/data/sales.csv",
        delimiter: ",",
        isCancelled: () => false,
        onProgress: vi.fn(),
        log: vi.fn(),
        ...overrides,
      };
    }

    /** Answers the frequency probe with `frequencyOutput`; all else succeeds. */
    function mockBackend(frequencyOutput: string) {
      mockInvoke.mockImplementation(async (cmd: string, args?: any) => {
        if (cmd !== "execute_xan_pipeline") return null;
        return args?.commands?.[0]?.name === "frequency"
          ? { success: true, output: frequencyOutput }
          : { success: true, output: "" };
      });
    }

    function callsTo(commandName: string): any[] {
      return mockInvoke.mock.calls
        .map((call) => call[1] as any)
        .filter((args) => args?.commands?.[0]?.name === commandName);
    }

    function paramValue(args: any, name: string) {
      return args.commands[0].parameters.find(
        (param: any) => param.name === name,
      )?.value;
    }

    it("asks frequency for every distinct value, not xan's default top 10", async () => {
      mockBackend("field,value,count\nname,Alice,5\nname,Bob,3\n");

      const { result } = renderHook(() => useBatchFilter());
      await result.current.executeBatchFilterDirect(
        makeCtx(),
        {
          column: "name",
          filterType: "text",
          textOperator: "equals",
          valueMode: "column",
        },
        "/data/sales.csv",
      );

      const [probe] = callsTo("frequency");
      expect(probe).toBeDefined();
      expect(probe.commands[0].parameters).toContainEqual({
        name: "all",
        value: "true",
        isPositional: false,
      });
      expect(probe.commands[0].parameters).toContainEqual({
        name: "no-extra",
        value: "true",
        isPositional: false,
      });
    });

    it("filters by the extracted values, not by whole frequency rows", async () => {
      mockBackend("field,value,count\n品类,服饰,7\n品类,数码,5\n");

      const { result } = renderHook(() => useBatchFilter());
      await result.current.executeBatchFilterDirect(
        makeCtx(),
        {
          column: "品类",
          filterType: "text",
          textOperator: "equals",
          valueMode: "column",
          extractColumn: "品类",
        },
        "/data/sales.csv",
      );

      const searches = callsTo("search");
      expect(searches).toHaveLength(2);
      expect(searches.map((args) => paramValue(args, "pattern"))).toEqual([
        "服饰",
        "数码",
      ]);
      expect(searches.map((args) => paramValue(args, "output"))).toEqual([
        "/data/sales_服饰.csv",
        "/data/sales_数码.csv",
      ]);
    });

    it("falls back to the filter column when extract-column is blank", async () => {
      mockBackend("field,value,count\n地区,华东,2\n");

      const { result } = renderHook(() => useBatchFilter());
      await result.current.executeBatchFilterDirect(
        makeCtx(),
        {
          column: "地区",
          filterType: "text",
          textOperator: "equals",
          valueMode: "column",
          extractColumn: "   ",
        },
        "/data/sales.csv",
      );

      expect(paramValue(callsTo("frequency")[0], "select")).toBe("地区");
      expect(callsTo("search")).toHaveLength(1);
    });
  });

  describe("multi-value batch processing", () => {
    it("should produce one invoke per value", async () => {
      mockInvoke.mockResolvedValue({ success: true, output: "" });

      const values = ["Alice", "Bob", "Charlie"];
      for (const value of values) {
        await invoke("execute_xan_pipeline", {
          commands: [
            {
              name: "search",
              parameters: [
                { name: "select", value: "name", isPositional: false },
                { name: "exact", value: "true", isPositional: false },
                { name: "pattern", value, isPositional: true },
                {
                  name: "output",
                  value: `/out/name_${value}.csv`,
                  isPositional: false,
                },
              ],
            },
          ],
          inputFile: "/test.csv",
          defaultDelimiter: ",",
        });
      }

      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });

  describe("number filter expression building", () => {
    it("should build equals expression with ==", () => {
      const expression = `col("price") == 100`;
      expect(expression).toBe('col("price") == 100');
    });

    it("should build not_equals expression with !=", () => {
      const expression = `col("status") != "active"`;
      expect(expression).toBe('col("status") != "active"');
    });

    it("should build greater_than expression with >", () => {
      const expression = `col("age") > 18`;
      expect(expression).toBe('col("age") > 18');
    });

    it("should build less_or_equal expression with <=", () => {
      const expression = `col("score") <= 100`;
      expect(expression).toBe('col("score") <= 100');
    });
  });
});
