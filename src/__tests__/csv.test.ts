import { describe, it, expect } from "vitest";
import { parseCsvString } from "@/utils/csv";

describe("parseCsvString", () => {
  it("parses headers and rows", () => {
    const out = parseCsvString("name,age\ntom,20\njerry,30\n");
    expect(out.headers).toEqual(["name", "age"]);
    expect(out.rows).toEqual([
      ["tom", "20"],
      ["jerry", "30"],
    ]);
    expect(out.truncated).toBe(false);
  });

  it("handles quoted fields containing commas and escaped quotes", () => {
    const out = parseCsvString('name,note\n"John, Jr.","said ""hi"""\n');
    expect(out.rows).toEqual([["John, Jr.", 'said "hi"']]);
  });

  it("skips blank lines", () => {
    const out = parseCsvString("a,b\n1,2\n\n3,4\n\n");
    expect(out.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("caps rows and sets truncated when maxRows exceeded", () => {
    const raw = "h\n1\n2\n3\n4\n5\n";
    const out = parseCsvString(raw, 3);
    expect(out.rows).toHaveLength(3);
    expect(out.truncated).toBe(true);
  });

  it("returns empty when input is blank", () => {
    const out = parseCsvString("   \n\n");
    expect(out).toEqual({ headers: [""], rows: [], truncated: false });
  });
});