import { describe, it, expect } from "vitest";
import {
  detectTabularFormat,
  isCsvFile,
  duckdbTableName,
} from "@/utils/fileFormat";

// Design 024: the frontend decides what may be opened. Unknown extensions
// return `null` (old "please use the from command" behaviour); the backend's
// `detect_input_format` is deliberately more permissive (unknown → CSV).
describe("detectTabularFormat", () => {
  it("recognizes csv extensions", () => {
    expect(detectTabularFormat("/a.csv")).toBe("csv");
    expect(detectTabularFormat("/a.CSV")).toBe("csv");
    expect(detectTabularFormat("/a.txt")).toBe("csv");
    expect(detectTabularFormat("/a.tsv")).toBe("csv");
  });

  it("recognizes parquet", () => {
    expect(detectTabularFormat("/a.parquet")).toBe("parquet");
    expect(detectTabularFormat("/a.Parquet")).toBe("parquet");
  });

  it("recognizes duckdb databases including the .db alias", () => {
    expect(detectTabularFormat("/a.duckdb")).toBe("duckdb");
    expect(detectTabularFormat("/a.DDB")).toBe("duckdb");
    expect(detectTabularFormat("/a.db")).toBe("duckdb");
  });

  it("returns null for unknown extensions and extensionless paths", () => {
    expect(detectTabularFormat("/a.xlsx")).toBeNull();
    expect(detectTabularFormat("/a.sqlite")).toBeNull();
    expect(detectTabularFormat("/a.json")).toBeNull();
    expect(detectTabularFormat("/noext")).toBeNull();
  });

  it("isCsvFile only matches the csv family", () => {
    expect(isCsvFile("/a.csv")).toBe(true);
    expect(isCsvFile("/a.parquet")).toBe(false);
    expect(isCsvFile("/a.duckdb")).toBe(false);
    expect(isCsvFile("/a.xlsx")).toBe(false);
  });
});

describe("duckdbTableName", () => {
  it("keeps plain main-schema names unqualified", () => {
    expect(duckdbTableName({ schema: "main", name: "sales", kind: "" })).toBe(
      "sales",
    );
  });

  it("qualifies tables outside the main schema", () => {
    expect(
      duckdbTableName({ schema: "analytics", name: "items", kind: "" }),
    ).toBe("analytics.items");
  });
});
