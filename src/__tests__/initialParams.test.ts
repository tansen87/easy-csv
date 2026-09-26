import { describe, it, expect } from "vitest";
import { buildCommandInitialParams } from "@/modules/dialogs/command/lib/initialParams";
import type { CommandEntryContext } from "@/types/dialog";

// Design 019 §3.1: this pure function replaces the parameter building that 11
// bespoke floating dialogs used to duplicate. The assertions below pin the
// *default output* of each dialog it replaces, so a regression here is a
// regression in the right-click entries.

const HEADERS = ["name", "age", "city"];
const ctx = (over: Partial<CommandEntryContext> = {}): CommandEntryContext => ({
  col: 1,
  headers: HEADERS,
  ...over,
});

describe("buildCommandInitialParams", () => {
  it("scopes a text filter to the clicked column", () => {
    expect(buildCommandInitialParams("search", ctx())).toEqual({ select: "age" });
  });

  it("builds a numeric filter expression for the clicked column", () => {
    expect(buildCommandInitialParams("filter", ctx())).toEqual({
      expression: 'col("age") == 0',
    });
  });

  it("preselects the clicked column for sort, ascending and as text", () => {
    expect(buildCommandInitialParams("sort", ctx())).toEqual({
      select: "age",
      reverse: false,
      numeric: false,
      output: "",
    });
  });

  it("keeps sort usable when no column was resolved", () => {
    expect(buildCommandInitialParams("sort", {})).toEqual({ output: "" });
  });

  it.each([
    ["len", 'col("age").len() as "age"'],
    ["lower", 'col("age").lower() as "age"'],
    ["upper", 'col("age").upper() as "age"'],
    ["trim", 'col("age").trim() as "age"'],
    ["ltrim", 'col("age").ltrim() as "age"'],
    ["rtrim", 'col("age").rtrim() as "age"'],
    ["strip", 'replace(col("age"), /[\\r\\t\\n]/, "") as "age"'],
  ] as const)("maps the %s text transform onto the clicked column", (kind, expr) => {
    expect(
      buildCommandInitialParams("map", ctx({ textTransform: kind as never })),
    ).toEqual({ expression: expr, overwrite: true, output: "" });
  });

  it.each([
    ["abs", 'abs(col("age")) as "age"'],
    ["neg", 'neg(col("age")) as "age"'],
    ["floor", 'floor(col("age")) as "age"'],
    ["ceil", 'ceil(col("age")) as "age"'],
    ["int", 'trunc(col("age")) as "age"'],
    ["float", 'float(col("age")) as "age"'],
    ["round", 'to_fixed(round(col("age"), 0.01), 2) as "age"'],
  ] as const)(
    "maps the %s number transform onto the clicked column",
    (kind, expr) => {
      expect(
        buildCommandInitialParams(
          "map",
          ctx({ numberTransform: kind as never }),
        ),
      ).toEqual({ expression: expr, overwrite: true, output: "" });
    },
  );

  it.each([
    ["left", 'col("age")[:4] as "age"', true],
    ["right", 'col("age")[-4:] as "age"', true],
    ["slice", 'col("age")[0:4] as "age"', true],
    ["split", 'split(col("age"), "/") as "new_col"', false],
  ] as const)(
    "scaffolds the %s slice on the clicked column",
    (kind, expr, overwrite) => {
      expect(
        buildCommandInitialParams("map", ctx({ slice: kind as never })),
      ).toEqual({ expression: expr, overwrite, output: "" });
    },
  );

  it("pads the clicked column with the legacy defaults", () => {
    expect(buildCommandInitialParams("map", ctx({ pad: "pad" }))).toEqual({
      expression: 'pad(col("age"), 10) as "age"',
      overwrite: true,
      output: "",
    });
    expect(buildCommandInitialParams("map", ctx({ pad: "lpad" }))).toEqual({
      expression: 'lpad(col("age"), 10) as "age"',
      overwrite: true,
      output: "",
    });
  });

  it("falls back to the date-transform scaffold only when asked for it", () => {
    expect(
      buildCommandInitialParams("map", ctx({ mapScaffold: "date" })),
    ).toEqual({
      expression:
        'strftime(datetime(col("age"), "%Y%m%d"), "%d/%m/%Y") as "new_date"',
      overwrite: false,
      output: "",
    });
  });

  it("scaffolds a replace chain for the replace entry", () => {
    expect(
      buildCommandInitialParams("map", ctx({ mapScaffold: "replace" })),
    ).toEqual({
      expression: 'replace(col("age"), "", "") as "age"',
      overwrite: true,
      output: "",
    });
  });

  it("uses an identity expression for a bare map entry", () => {
    expect(buildCommandInitialParams("map", ctx())).toEqual({
      expression: 'col("age") as "age"',
      overwrite: true,
      output: "",
    });
  });

  it("stays empty rather than guessing when there is no column", () => {
    expect(buildCommandInitialParams("search", {})).toEqual({});
    expect(buildCommandInitialParams("filter", { col: 9, headers: HEADERS })).toEqual(
      {},
    );
    expect(buildCommandInitialParams("map", {})).toEqual({
      output: "",
      overwrite: false,
    });
    expect(
      buildCommandInitialParams("map", { col: 9, headers: HEADERS, pad: "pad" }),
    ).toEqual({ output: "", overwrite: false });
  });

  it("returns no prefill for commands that have no canvas entry", () => {
    expect(buildCommandInitialParams("window", ctx())).toEqual({ output: "" });
    expect(buildCommandInitialParams("pivot", ctx())).toEqual({});
    expect(buildCommandInitialParams("batch-filter", ctx())).toEqual({});
  });
});
