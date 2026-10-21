import { describe, it, expect } from "vitest";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import type {
  FilterDraft,
  QuickAliasLabels,
  ReplaceDraft,
  SliceDraft,
} from "@/modules/dialogs/quick/types";

const LABELS: QuickAliasLabels = {
  filterOperator: {
    equals: "Equals",
    not_equals: "Not equals",
    starts_with: "Starts with",
    not_starts_with: "Not starts with",
    ends_with: "Ends with",
    not_ends_with: "Not ends with",
    contains: "Contains",
    not_contains: "Not contains",
    regex: "Regex",
    is_null: "Is null",
    is_not_null: "Is not null",
    greater_than: ">",
    greater_or_equal: ">=",
    less_than: "<",
    less_or_equal: "<=",
  },
  sort: "Sort",
  replace: "Replace",
  date: "Date Transform",
  textTransform: "Text Transform",
  numberTransform: "Number Transform",
  slice: { left: "Left", right: "Right", slice: "Slice", split: "Split" },
  pad: { pad: "Pad", lpad: "Left Pad", rpad: "Right Pad" },
  window: "Window",
  batchFilter: "Batch Filter",
  pivotAgg: "Agg",
  pivotGroupby: "Groupby",
  pivot: "Pivot",
};

const filterBase: FilterDraft = {
  kind: "filter",
  mode: "text",
  column: "name",
  textOperator: "equals",
  numberOperator: "equals",
  values: ["Alice"],
  numberValue: "",
  ignoreCase: false,
};

describe("buildQuickCommand · filter", () => {
  it("builds an exact search for equals / not_equals", () => {
    expect(buildQuickCommand(filterBase, LABELS)).toEqual({
      type: "search",
      params: {
        select: "name",
        exact: true,
        pattern: "Alice",
        "add-pattern": [],
        "ignore-case": false,
        "invert-match": false,
      },
      alias: "Equals",
    });

    expect(
      buildQuickCommand(
        { ...filterBase, textOperator: "not_equals", values: ["a", "b"] },
        LABELS,
      )?.params,
    ).toMatchObject({
      pattern: "a",
      "add-pattern": ["b"],
      "invert-match": true,
    });
  });

  it("turns prefix/suffix/contains operators into regex patterns", () => {
    expect(
      buildQuickCommand(
        { ...filterBase, textOperator: "starts_with", values: ["foo"] },
        LABELS,
      )?.params,
    ).toMatchObject({ pattern: "^foo", regex: true, "invert-match": false });

    expect(
      buildQuickCommand(
        { ...filterBase, textOperator: "not_ends_with", values: ["foo"] },
        LABELS,
      )?.params,
    ).toMatchObject({ pattern: "foo$", regex: true, "invert-match": true });
  });

  it("handles null checks without values", () => {
    expect(
      buildQuickCommand({ ...filterBase, textOperator: "is_null", values: [] }, LABELS),
    ).toEqual({
      type: "search",
      params: { select: "name", empty: true },
      alias: "Is null",
    });
    expect(
      buildQuickCommand(
        { ...filterBase, textOperator: "is_not_null", values: [] },
        LABELS,
      )?.params,
    ).toEqual({ select: "name", "non-empty": true });
  });

  it("builds a numeric filter expression", () => {
    expect(
      buildQuickCommand(
        {
          ...filterBase,
          mode: "number",
          numberOperator: "greater_or_equal",
          numberValue: "18",
        },
        LABELS,
      ),
    ).toEqual({
      type: "filter",
      params: {
        expression: 'col("name") >= 18',
        parallel: false,
        threads: undefined,
      },
      alias: ">=",
    });
  });

  it("returns null when required inputs are missing", () => {
    expect(buildQuickCommand({ ...filterBase, column: "" }, LABELS)).toBeNull();
    expect(
      buildQuickCommand({ ...filterBase, values: ["   "] }, LABELS),
    ).toBeNull();
    expect(
      buildQuickCommand(
        { ...filterBase, mode: "number", numberValue: "" },
        LABELS,
      ),
    ).toBeNull();
  });
});

describe("buildQuickCommand · sort / replace / date / transforms", () => {
  it("joins multiple sort columns", () => {
    expect(
      buildQuickCommand(
        {
          kind: "sort",
          columns: ["a", "b"],
          order: "desc",
          numeric: true,
        },
        LABELS,
      ),
    ).toEqual({
      type: "sort",
      params: { select: "a,b", output: "", reverse: true, numeric: true },
      alias: "Sort",
    });
  });

  it("nests replace pairs and keeps regex literals", () => {
    const draft: ReplaceDraft = {
      kind: "replace",
      column: "name",
      pairs: [
        { pattern: "a", replace: "b", regex: false, ignoreCase: false },
        { pattern: "\\d+", replace: "x", regex: true, ignoreCase: true },
      ],
    };
    expect(buildQuickCommand(draft, LABELS)?.params.expression).toBe(
      'replace(replace(col("name"), "a", "b"), /\\d+/i, "x") as "name"',
    );
  });

  it("marks the date overwrite only when the alias matches the source", () => {
    expect(
      buildQuickCommand(
        {
          kind: "date",
          column: "d",
          inputFormat: "%Y%m%d",
          outputFormat: "%d/%m/%Y",
          outputColumn: "new_date",
        },
        LABELS,
      )?.params,
    ).toMatchObject({
      expression: 'strftime(datetime(col("d"), "%Y%m%d"), "%d/%m/%Y") as "new_date"',
      overwrite: false,
    });

    expect(
      buildQuickCommand(
        {
          kind: "date",
          column: "d",
          inputFormat: "%Y%m%d",
          outputFormat: "%d/%m/%Y",
          outputColumn: "d",
        },
        LABELS,
      )?.params.overwrite,
    ).toBe(true);
  });

  it("escapes control characters in the strip transform", () => {
    expect(
      buildQuickCommand(
        { kind: "text-transform", columns: ["a", "b"], transform: "strip" },
        LABELS,
      )?.params.expression,
    ).toBe(
      'replace(col("a"), /[\\r\\t\\n]/, "") as "a", replace(col("b"), /[\\r\\t\\n]/, "") as "b"',
    );
  });

  it("maps every number transform", () => {
    expect(
      buildQuickCommand(
        { kind: "number-transform", columns: ["n"], transform: "round" },
        LABELS,
      )?.params.expression,
    ).toBe('to_fixed(round(col("n"), 0.01), 2) as "n"');
  });
});

describe("buildQuickCommand · slice / pad", () => {
  const sliceBase: SliceDraft = {
    kind: "slice",
    column: "s",
    sliceType: "split",
    leftLength: "4",
    rightLength: "4",
    sliceStart: "0",
    sliceEnd: "4",
    separator: "/",
    customSeparator: "",
    indices: ["0"],
    joinWith: "-",
    outputColumn: "new_col",
  };

  it("builds left/right/slice expressions", () => {
    expect(
      buildQuickCommand({ ...sliceBase, sliceType: "left" }, LABELS)?.params
        .expression,
    ).toBe('col("s")[:4] as "new_col"');
    expect(
      buildQuickCommand({ ...sliceBase, sliceType: "right" }, LABELS)?.params
        .expression,
    ).toBe('col("s")[-4:] as "new_col"');
    expect(
      buildQuickCommand({ ...sliceBase, sliceType: "slice" }, LABELS)?.params
        .expression,
    ).toBe('col("s")[0:4] as "new_col"');
  });

  it("joins multiple split indices", () => {
    expect(
      buildQuickCommand(
        { ...sliceBase, indices: ["0", "2"], joinWith: "-" },
        LABELS,
      )?.params.expression,
    ).toBe(
      'split(col("s"), "/")[0] ++ "-" ++ split(col("s"), "/")[2] as "new_col"',
    );
  });

  it("requires a custom separator when split/custom is selected", () => {
    expect(
      buildQuickCommand(
        { ...sliceBase, separator: "custom", customSeparator: "" },
        LABELS,
      ),
    ).toBeNull();
  });

  it("builds pad expressions with and without a character", () => {
    expect(
      buildQuickCommand(
        { kind: "pad", column: "s", padType: "lpad", width: "10", char: "" },
        LABELS,
      )?.params.expression,
    ).toBe('lpad(col("s"), 10) as "s"');
    expect(
      buildQuickCommand(
        { kind: "pad", column: "s", padType: "rpad", width: "8", char: "0" },
        LABELS,
      )?.params.expression,
    ).toBe('rpad(col("s"), 8, "0") as "s"');
    expect(
      buildQuickCommand(
        { kind: "pad", column: "s", padType: "pad", width: "0", char: "" },
        LABELS,
      ),
    ).toBeNull();
  });
});

describe("buildQuickCommand · pivot / window / batch-filter", () => {
  it("picks agg/groupby/pivot from the selections", () => {
    const values = [{ column: "amount", aggregation: "sum" }];

    expect(
      buildQuickCommand(
        { kind: "pivot", columns: [], groupBy: [], values, columnSep: "_" },
        LABELS,
      ),
    ).toMatchObject({ type: "agg", alias: "Agg" });

    expect(
      buildQuickCommand(
        { kind: "pivot", columns: [], groupBy: ["region"], values, columnSep: "_" },
        LABELS,
      ),
    ).toMatchObject({
      type: "groupby",
      params: { columns: '"region"', expression: 'sum(col("amount")) as "amount"' },
    });

    expect(
      buildQuickCommand(
        {
          kind: "pivot",
          columns: ["year"],
          groupBy: ["region"],
          values,
          columnSep: "-",
        },
        LABELS,
      ),
    ).toEqual({
      type: "pivot",
      params: {
        columns: '"year"',
        expr: 'sum(col("amount")) as "amount"',
        groupby: '"region"',
        "column-sep": "-",
        output: "",
      },
      alias: "Pivot",
    });
  });

  it("builds one expression per window entry", () => {
    expect(
      buildQuickCommand(
        {
          kind: "window",
          groupBy: "region",
          entries: [
            { column: "x", func: "rolling_sum", alias: "rs", windowSize: "5" },
            { column: "y", func: "row_number", alias: "", windowSize: "10" },
          ],
        },
        LABELS,
      ),
    ).toMatchObject({
      type: "window",
      params: {
        expression: 'rolling_sum(5, col("x")) as "rs", row_number()',
        groupby: "region",
      },
    });
  });

  it("passes batch-filter params through", () => {
    expect(
      buildQuickCommand(
        { kind: "batch-filter", params: { column: "name" } },
        LABELS,
      ),
    ).toEqual({
      type: "batch-filter",
      params: { column: "name" },
      alias: "Batch Filter",
    });
  });
});
