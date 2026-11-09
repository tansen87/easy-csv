import { describe, it, expect } from "vitest";
import {
  detectFrequencyDelimiter,
  parseFrequencyValues,
} from "@/utils/batchFilterValues";

// Regression cover for "value source: from column" in Batch Filter.
//
// `xan frequency` answers with a three-column table (`field,value,count`),
// written with the delimiter the input was read with, capped at the 10 most
// frequent values unless `--all` is passed. The old implementation parsed it as
// if it were one tab-separated column, so every comma row became a single fake
// value (`品类,服饰,7`) that then matched nothing.
describe("detectFrequencyDelimiter", () => {
  it("prefers the caller's delimiter when the header matches", () => {
    expect(detectFrequencyDelimiter("field,value,count\na,b,1", ",")).toBe(",");
  });

  it("detects a tab-written table", () => {
    expect(detectFrequencyDelimiter("field\tvalue\tcount\na\tb\t1", ",")).toBe(
      "\t",
    );
  });

  it("falls back to the detected delimiter when the preferred one is wrong", () => {
    // A parquet/duckdb input gets no `-d`, so stdout stays comma-delimited even
    // when the run's delimiter is a tab.
    expect(detectFrequencyDelimiter("field,value,count\na,b,1", "\t")).toBe(
      ",",
    );
  });

  it("returns the preferred delimiter when there is no header to sniff", () => {
    expect(detectFrequencyDelimiter("0,b,1", ";")).toBe(";");
    expect(detectFrequencyDelimiter("0,b,1")).toBe(",");
  });
});

describe("parseFrequencyValues", () => {
  it("reads the value column of a comma table", () => {
    const output = "field,value,count\n品类,服饰,7\n品类,数码,5\n品类,食品,3\n";
    expect(parseFrequencyValues(output, ",")).toEqual(["服饰", "数码", "食品"]);
  });

  it("never yields a whole frequency row as a value", () => {
    const output = "field,value,count\n地区,华东,4\n";
    expect(parseFrequencyValues(output, ",")).not.toContain("地区,华东,4");
  });

  it("follows a tab delimiter even when the tab is comma-delimited", () => {
    const output = "field\tvalue\tcount\na\ttabbed\t2";
    expect(parseFrequencyValues(output, ",")).toEqual(["tabbed"]);
  });

  it("keeps quoted values containing the delimiter, with doubled quotes", () => {
    const output =
      'field,value,count\ncity,"Washington, D.C.",2\ncity,"say ""hi""",1';
    expect(parseFrequencyValues(output, ",")).toEqual([
      "Washington, D.C.",
      'say "hi"',
    ]);
  });

  it("keeps a quoted value that spans lines as one value", () => {
    const output = 'field,value,count\nnote,"first\nsecond",1\nnote,plain,2';
    expect(parseFrequencyValues(output, ",")).toEqual([
      "first\nsecond",
      "plain",
    ]);
  });

  it("skips the header row, empty cells and duplicates", () => {
    const output = "field,value,count\na,A,2\na,A,1\na,,0";
    expect(parseFrequencyValues(output, ",")).toEqual(["A"]);
  });

  it("drops xan's <empty> / <rest> sentinel rows", () => {
    const output = "field,value,count\na,<empty>,3\na,A,1\na,<rest>,9";
    expect(parseFrequencyValues(output, ",")).toEqual(["A"]);
  });

  it("treats every row as data when the table has no header (--no-headers)", () => {
    expect(parseFrequencyValues("0,A,1\n0,B,1", ",")).toEqual(["A", "B"]);
  });

  it("handles CRLF output and a byte-order mark", () => {
    const output = "\uFEFFfield,value,count\r\na,A,1\r\n";
    expect(parseFrequencyValues(output, ",")).toEqual(["A"]);
  });

  it("preserves the cell byte for byte (no trimming)", () => {
    const output = "field,value,count\na, x ,1\na,x,2";
    expect(parseFrequencyValues(output, ",")).toEqual([" x ", "x"]);
  });

  it("returns nothing for empty or whitespace-only output", () => {
    expect(parseFrequencyValues("", ",")).toEqual([]);
    expect(parseFrequencyValues("   \n", ",")).toEqual([]);
    expect(parseFrequencyValues("field,value,count\n", ",")).toEqual([]);
  });
});
