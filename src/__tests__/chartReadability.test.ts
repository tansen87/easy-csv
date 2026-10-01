import { describe, it, expect } from "vitest";

import {
  processChartData,
  processChartDataWithIssues,
  parseNumericCell,
  defaultSortFor,
  colorForIndex,
} from "@/hooks/charts/processChartData";
import { formatNumber } from "@/utils/format";
import type { ChartConfig } from "@/types/xan";

const barConfig: ChartConfig = { chartType: "bar", x: "region", y: "sales" };

describe("parseNumericCell (design 029 §3.3)", () => {
  it("parses plain and signed numbers", () => {
    expect(parseNumericCell("42")).toBe(42);
    expect(parseNumericCell("-7.5")).toBe(-7.5);
    expect(parseNumericCell(3)).toBe(3);
  });

  it("distinguishes a missing value from a real zero", () => {
    // The old `parseFloat(v) || 0` collapsed all of these into 0 and drew a
    // fake crash to zero.
    expect(parseNumericCell("N/A")).toBeNull();
    expect(parseNumericCell("")).toBeNull();
    expect(parseNumericCell("   ")).toBeNull();
    expect(parseNumericCell("-")).toBeNull();
    expect(parseNumericCell("abc")).toBeNull();
    expect(parseNumericCell(null)).toBeNull();
    expect(parseNumericCell(undefined)).toBeNull();
    // ...while a genuine 0 stays 0.
    expect(parseNumericCell("0")).toBe(0);
    expect(parseNumericCell("0.0")).toBe(0);
  });

  it("reads thousands-separated numbers instead of truncating them", () => {
    // Previously "1,234" became 1 because parseFloat stopped at the comma.
    expect(parseNumericCell("1,234")).toBe(1234);
    expect(parseNumericCell("1 234")).toBe(1234);
    expect(parseNumericCell("1,234,567.89")).toBe(1234567.89);
  });
});

describe("processChartData issue reporting (design 029 §3.4 / §4.8)", () => {
  it("reports a missing x column with the available columns", () => {
    const result = processChartDataWithIssues(["a", "b"], [["1", "2"]], {
      chartType: "bar",
      x: "Region",
      y: "sales",
    });

    expect(result.series).toEqual([]);
    expect(result.issue).toEqual({
      kind: "column_not_found",
      column: "Region",
      available: ["a", "b"],
    });
  });

  it("reports an empty table rather than drawing a blank axis", () => {
    const result = processChartDataWithIssues(["a"], [], {
      chartType: "line",
      x: "a",
    });
    expect(result.issue).toEqual({ kind: "no_rows" });
  });

  it("names a y column that never parses as a number", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      [
        ["north", "N/A"],
        ["south", "-"],
      ],
      barConfig,
    );

    expect(result.series).toEqual([]);
    expect(result.issue).toEqual({
      kind: "no_numeric_values",
      column: "sales",
      totalRows: 2,
      nonNumericRows: 2,
    });
  });

  it("keeps nulls instead of zeroes when only some rows are non-numeric", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      [
        ["north", "10"],
        ["south", "N/A"],
        ["east", "20"],
      ],
      barConfig,
    );

    expect(result.series).toHaveLength(1);
    expect(result.droppedRows).toBe(1);
    expect(result.issue).toBeUndefined();
    const values = result.series[0].data.map((d) => d.sales);
    expect(values).toEqual([10, null, 20]);
  });
});

describe("chart sorting (design 029 §4.2)", () => {
  const rows = [
    ["north", "10"],
    ["south", "30"],
    ["east", "20"],
  ];

  it("defaults bar/pie/heatmap to descending and line to source order", () => {
    expect(defaultSortFor("bar")).toBe("desc");
    expect(defaultSortFor("pie")).toBe("desc");
    expect(defaultSortFor("heatmap")).toBe("desc");
    expect(defaultSortFor("line")).toBe("none");
    expect(defaultSortFor("scatter")).toBe("none");
  });

  it("orders a pie by value so the largest slice leads", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      rows,
      { chartType: "pie", x: "region", y: "sales" },
    );
    expect(result.series[0].data.map((d) => d.region)).toEqual([
      "south",
      "east",
      "north",
    ]);
  });

  it("can be asked for ascending order", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      rows,
      { chartType: "pie", x: "region", y: "sales" },
      { sort: "asc" },
    );
    expect(result.series[0].data.map((d) => d.region)).toEqual([
      "north",
      "east",
      "south",
    ]);
  });

  it("leaves the visual source order when asked for none", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      rows,
      { chartType: "pie", x: "region", y: "sales" },
      { sort: "none" },
    );
    expect(result.series[0].data.map((d) => d.region)).toEqual([
      "north",
      "south",
      "east",
    ]);
  });

  it("aggregates duplicate categories before ordering the pie", () => {
    const result = processChartDataWithIssues(
      ["region", "sales"],
      [
        ["north", "5"],
        ["south", "30"],
        ["north", "40"],
      ],
      { chartType: "pie", x: "region", y: "sales" },
    );
    // north = 45 must outrank south = 30 once merged.
    expect(result.series[0].data.map((d) => d.region)).toEqual(["north", "south"]);
    expect(result.series[0].data[0].sales).toBe(45);
  });
});

describe("color stability (design 029 §4.6)", () => {
  it("assigns colours by index so hiding a series cannot recolour others", () => {
    expect(colorForIndex(0)).toBe(colorForIndex(0));
    expect(colorForIndex(0)).not.toBe(colorForIndex(1));
    expect(colorForIndex(0)).toBe(colorForIndex(8));
  });
});

describe("processChartData compatibility wrapper", () => {
  it("still returns just the series for existing callers", () => {
    const series = processChartData(["region", "sales"], [["north", "1"]], barConfig);
    expect(Array.isArray(series)).toBe(true);
    expect(series).toHaveLength(1);
    expect(series[0].name).toBe("sales");
  });

  it("returns an empty array when the column is missing", () => {
    expect(processChartData(["a"], [["1"]], { chartType: "bar", x: "zzz", y: "a" })).toEqual([]);
  });
});

describe("formatNumber (design 029 §4.3)", () => {
  it("groups large values and keeps tooltip precision", () => {
    expect(formatNumber(1234567.891)).toBe("1,234,567.89");
  });

  it("abbreviates axis-scale magnitudes", () => {
    expect(formatNumber(1200000, "compact")).toBe("1.2M");
    expect(formatNumber(912300, "compact")).toBe("912.3k");
    expect(formatNumber(1200, "compact")).toBe("1.2k");
    expect(formatNumber(45, "compact")).toBe("45");
  });

  it("honours explicit precision modes", () => {
    expect(formatNumber(12.345, "integer")).toBe("12");
    expect(formatNumber(12.345, "decimal1")).toBe("12.3");
    expect(formatNumber(12.345, "decimal2")).toBe("12.35");
    expect(formatNumber(12.345, "percent")).toBe("12.3%");
  });

  it("renders missing values as an em dash, not zero", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });

  it("shows integer counts without a trailing .0 (heatmap cells)", () => {
    // The heatmap used a fixed toFixed(1) and printed counts as `12.0`.
    expect(formatNumber(12, "integer")).toBe("12");
  });
});
