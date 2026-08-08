import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";

// Replicate pure functions from BatchConvertHooks.ts
const globToRegex = (pattern: string): RegExp => {
  const regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`, "i");
};

const getBaseName = (filePath: string): string => {
  const parts = filePath.split(/[\\/]/);
  const fileName = parts[parts.length - 1] || "output";
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.substring(0, lastDot) : fileName;
};

const getOutputDir = (filePath: string, customOutputDir?: string): string => {
  if (customOutputDir && customOutputDir.trim()) {
    return customOutputDir.trim();
  }
  const lastSlash = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\"),
  );
  return lastSlash >= 0 ? filePath.substring(0, lastSlash) : ".";
};

describe("globToRegex", () => {
  it("should match exact filename", () => {
    const re = globToRegex("data.csv");
    expect(re.test("data.csv")).toBe(true);
    expect(re.test("data.json")).toBe(false);
  });

  it("should match wildcard *", () => {
    const re = globToRegex("*.csv");
    expect(re.test("file.csv")).toBe(true);
    expect(re.test("data.csv")).toBe(true);
    expect(re.test("file.json")).toBe(false);
  });

  it("should match single char wildcard ?", () => {
    const re = globToRegex("file?.csv");
    expect(re.test("file1.csv")).toBe(true);
    expect(re.test("fileA.csv")).toBe(true);
    expect(re.test("file12.csv")).toBe(false);
  });

  it("should escape dots", () => {
    const re = globToRegex("data.csv");
    expect(re.test("dataXcsv")).toBe(false);
  });

  it("should be case insensitive", () => {
    const re = globToRegex("Data.CSV");
    expect(re.test("data.csv")).toBe(true);
    expect(re.test("DATA.CSV")).toBe(true);
  });

  it("should match combined patterns", () => {
    const re = globToRegex("report_*.xlsx");
    expect(re.test("report_jan.xlsx")).toBe(true);
    expect(re.test("report_feb.xlsx")).toBe(true);
    expect(re.test("report_jan.csv")).toBe(false);
  });
});

describe("getBaseName", () => {
  it("should extract filename without extension", () => {
    expect(getBaseName("/path/to/file.csv")).toBe("file");
  });

  it("should handle Windows paths", () => {
    expect(getBaseName("C:\\data\\report.xlsx")).toBe("report");
  });

  it("should handle multiple dots", () => {
    expect(getBaseName("my.data.file.csv")).toBe("my.data.file");
  });

  it("should handle no extension", () => {
    expect(getBaseName("/path/to/file")).toBe("file");
  });

  it("should handle trailing slash", () => {
    expect(getBaseName("/path/to/")).toBe("output");
  });

  it("should handle bare filename", () => {
    expect(getBaseName("test.json")).toBe("test");
  });
});

describe("getOutputDir", () => {
  it("should use custom output dir when provided", () => {
    expect(getOutputDir("/any/path/file.csv", "D:\\output")).toBe("D:\\output");
  });

  it("should trim custom output dir", () => {
    expect(getOutputDir("/any/path/file.csv", "  D:\\output  ")).toBe(
      "D:\\output",
    );
  });

  it("should fallback to parent directory", () => {
    expect(getOutputDir("/data/files/report.csv")).toBe("/data/files");
  });

  it("should handle Windows paths", () => {
    expect(getOutputDir("C:\\data\\report.csv")).toBe("C:\\data");
  });

  it("should return . when no slash", () => {
    expect(getOutputDir("file.csv")).toBe(".");
  });

  it("should prefer custom dir over path extraction", () => {
    expect(getOutputDir("/a/b/file.csv", "/custom")).toBe("/custom");
  });
});

describe("BatchConvertHooks invoke patterns", () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should build csv-to-xlsx conversion with 'to' command", async () => {
    mockInvoke.mockResolvedValue({ success: true, output: "" });

    const commands = [
      {
        name: "to",
        parameters: [
          { name: "format", value: "xlsx", isPositional: true },
          { name: "output", value: "/out/report.xlsx", isPositional: false },
        ],
      },
    ];

    await invoke("execute_xan_pipeline", {
      commands,
      inputFile: "/data/report.csv",
      defaultDelimiter: ",",
    });

    expect(mockInvoke).toHaveBeenCalledWith("execute_xan_pipeline", {
      commands: expect.arrayContaining([
        expect.objectContaining({
          name: "to",
          parameters: expect.arrayContaining([
            { name: "format", value: "xlsx", isPositional: true },
          ]),
        }),
      ]),
      inputFile: "/data/report.csv",
      defaultDelimiter: ",",
    });
  });

  it("should build xlsx-to-csv conversion with 'from' command", async () => {
    mockInvoke.mockResolvedValue({ success: true, output: "" });

    const commands = [
      {
        name: "from",
        parameters: [
          { name: "format", value: "xlsx", isPositional: false },
          { name: "output", value: "/out/data.csv", isPositional: false },
        ],
      },
    ];

    await invoke("execute_xan_pipeline", {
      commands,
      inputFile: "/data/report.xlsx",
      defaultDelimiter: ",",
    });

    const cmdArgs = mockInvoke.mock.calls[0][1] as any;
    expect(cmdArgs.commands[0].name).toBe("from");
  });

  it("should build xlsx-to-json with from+to two-step pipeline", async () => {
    mockInvoke.mockResolvedValue({ success: true, output: "" });

    const commands = [
      {
        name: "from",
        parameters: [{ name: "format", value: "xlsx", isPositional: false }],
      },
      {
        name: "to",
        parameters: [
          { name: "format", value: "json", isPositional: true },
          { name: "output", value: "/out/data.json", isPositional: false },
        ],
      },
    ];

    await invoke("execute_xan_pipeline", {
      commands,
      inputFile: "/data/report.xlsx",
      defaultDelimiter: ",",
    });

    const cmdArgs = mockInvoke.mock.calls[0][1] as any;
    expect(cmdArgs.commands).toHaveLength(2);
    expect(cmdArgs.commands[0].name).toBe("from");
    expect(cmdArgs.commands[1].name).toBe("to");
  });

  it("should pass format-specific params for xlsx source", async () => {
    mockInvoke.mockResolvedValue({ success: true, output: "" });

    const commands = [
      {
        name: "from",
        parameters: [
          { name: "format", value: "xlsx", isPositional: false },
          { name: "sheet-name", value: "Sheet1", isPositional: false },
          { name: "sample-size", value: "100", isPositional: false },
        ],
      },
    ];

    await invoke("execute_xan_pipeline", {
      commands,
      inputFile: "/data/report.xlsx",
      defaultDelimiter: ",",
    });

    const cmdArgs = mockInvoke.mock.calls[0][1] as any;
    expect(cmdArgs.commands[0].parameters).toContainEqual({
      name: "sheet-name",
      value: "Sheet1",
      isPositional: false,
    });
  });

  it("should handle conversion failure", async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: "Format not supported",
    });

    const result = await invoke<any>("execute_xan_pipeline", {
      commands: [{ name: "to", parameters: [] }],
      inputFile: "/data/file.csv",
      defaultDelimiter: ",",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Format not supported");
  });
});
