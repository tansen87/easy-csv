import { describe, it, expect } from "vitest";
import { xanCommands } from "@/data/commands";

// Replicate the parameter building logic from MainMenuHooks.ts handleExecute
function buildInvokeParams(
  commandId: string,
  userParams: Record<string, any>,
): { name: string; value: string; isPositional?: boolean }[] {
  const cmd = xanCommands.find((c) => c.id === commandId);
  if (!cmd) throw new Error(`Unknown command: ${commandId}`);

  return cmd.parameters.map((param) => {
    const rawValue = userParams[param.name] ?? param.default;
    const value = Array.isArray(rawValue)
      ? rawValue.filter(Boolean).join("|")
      : String(rawValue || "");
    return {
      name: param.name,
      value,
      isPositional: param.isPositional,
    };
  });
}

function buildInvokeCall(commandId: string, userParams: Record<string, any>) {
  const cmd = xanCommands.find((c) => c.id === commandId)!;
  const params = buildInvokeParams(commandId, userParams);
  return { name: cmd.name, parameters: params };
}

// ========== Explore & Visualize ==========

describe("Explore & Visualize commands", () => {
  describe("view", () => {
    it("should build view with defaults", () => {
      const call = buildInvokeCall("view", {});
      expect(call.name).toBe("view");
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
      expect(call.parameters.find((p) => p.name === "theme")?.value).toBe(
        "borderless",
      );
    });

    it("should override defaults with user values", () => {
      const call = buildInvokeCall("view", {
        select: "name,age",
        limit: 50,
        theme: "striped",
        all: true,
      });
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "name,age",
      );
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("50");
      expect(call.parameters.find((p) => p.name === "theme")?.value).toBe(
        "striped",
      );
      expect(call.parameters.find((p) => p.name === "all")?.value).toBe("true");
    });
  });

  describe("count", () => {
    it("should build count with no params", () => {
      const call = buildInvokeCall("count", {});
      expect(call.name).toBe("count");
      // Flag defaults are false → String(false || "") → ""
      expect(
        call.parameters.find((p) => p.name === "human-readable")?.value,
      ).toBe("");
    });

    it("should enable flags", () => {
      const call = buildInvokeCall("count", {
        "human-readable": true,
        parallel: true,
        threads: 4,
      });
      expect(
        call.parameters.find((p) => p.name === "human-readable")?.value,
      ).toBe("true");
      expect(call.parameters.find((p) => p.name === "parallel")?.value).toBe(
        "true",
      );
      expect(call.parameters.find((p) => p.name === "threads")?.value).toBe(
        "4",
      );
    });
  });

  describe("headers", () => {
    it("should build headers with defaults", () => {
      const call = buildInvokeCall("headers", {});
      expect(call.name).toBe("headers");
      expect(call.parameters.find((p) => p.name === "just-names")?.value).toBe(
        "",
      );
    });

    it("should enable just-names", () => {
      const call = buildInvokeCall("headers", { "just-names": true });
      expect(call.parameters.find((p) => p.name === "just-names")?.value).toBe(
        "true",
      );
    });
  });

  describe("flatten", () => {
    it("should build flatten with user params", () => {
      const call = buildInvokeCall("flatten", {
        select: "col1",
        limit: 100,
        condense: true,
      });
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "col1",
      );
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe(
        "100",
      );
      expect(call.parameters.find((p) => p.name === "condense")?.value).toBe(
        "true",
      );
    });
  });
});

// ========== Column Operations ==========

describe("Column operations", () => {
  describe("select", () => {
    it("should build select with positional expression", () => {
      const call = buildInvokeCall("select", { selection: "col1,col2" });
      expect(call.name).toBe("select");
      const selParam = call.parameters.find((p) => p.name === "selection");
      expect(selParam?.value).toBe("col1,col2");
      expect(selParam?.isPositional).toBe(true);
    });

    it("should include evaluate flag", () => {
      const call = buildInvokeCall("select", {
        selection: "if col1 > 10 then col2",
        evaluate: true,
      });
      expect(call.parameters.find((p) => p.name === "evaluate")?.value).toBe(
        "true",
      );
    });
  });

  describe("drop", () => {
    it("should build drop with positional selection", () => {
      const call = buildInvokeCall("drop", { selection: "col1,col2" });
      expect(call.name).toBe("drop");
      const selParam = call.parameters.find((p) => p.name === "selection");
      expect(selParam?.value).toBe("col1,col2");
      expect(selParam?.isPositional).toBe(true);
    });
  });

  describe("map", () => {
    it("should build map with positional expression", () => {
      const call = buildInvokeCall("map", {
        expression: 'upper(col("name")) as "upper_name"',
      });
      expect(call.name).toBe("map");
      const exprParam = call.parameters.find((p) => p.name === "expression");
      expect(exprParam?.value).toBe('upper(col("name")) as "upper_name"');
      expect(exprParam?.isPositional).toBe(true);
    });

    it("should include overwrite and filter flags", () => {
      const call = buildInvokeCall("map", {
        expression: "col('age') + 1",
        overwrite: true,
        filter: true,
      });
      expect(call.parameters.find((p) => p.name === "overwrite")?.value).toBe(
        "true",
      );
      expect(call.parameters.find((p) => p.name === "filter")?.value).toBe(
        "true",
      );
    });
  });

  describe("rename", () => {
    it("should build rename with columns mapping", () => {
      const call = buildInvokeCall("rename", { columns: "old_name:new_name" });
      expect(call.name).toBe("rename");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("old_name:new_name");
      expect(colParam?.isPositional).toBe(true);
    });
  });
});

// ========== Search & Filter ==========

describe("Search & Filter commands", () => {
  describe("search", () => {
    it("should build search with select and pattern", () => {
      const call = buildInvokeCall("search", {
        select: "name",
        pattern: "Alice",
      });
      expect(call.name).toBe("search");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "name",
      );
      expect(call.parameters.find((p) => p.name === "pattern")?.value).toBe(
        "Alice",
      );
    });

    it("should include regex and ignore-case flags", () => {
      const call = buildInvokeCall("search", {
        select: "email",
        pattern: "^test@.*\\.com$",
        regex: true,
        "ignore-case": true,
      });
      expect(call.parameters.find((p) => p.name === "regex")?.value).toBe(
        "true",
      );
      expect(call.parameters.find((p) => p.name === "ignore-case")?.value).toBe(
        "true",
      );
    });

    it("should include exact and invert-match", () => {
      const call = buildInvokeCall("search", {
        select: "status",
        pattern: "deleted",
        exact: true,
        "invert-match": true,
      });
      expect(call.parameters.find((p) => p.name === "exact")?.value).toBe(
        "true",
      );
      expect(
        call.parameters.find((p) => p.name === "invert-match")?.value,
      ).toBe("true");
    });
  });

  describe("filter", () => {
    it("should build filter with expression", () => {
      const call = buildInvokeCall("filter", {
        expression: 'col("age") > 18',
      });
      expect(call.name).toBe("filter");
      expect(call.parameters.find((p) => p.name === "expression")?.value).toBe(
        'col("age") > 18',
      );
    });
  });

  describe("head", () => {
    it("should build head with default limit", () => {
      const call = buildInvokeCall("head", {});
      expect(call.name).toBe("head");
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
    });

    it("should override limit", () => {
      const call = buildInvokeCall("head", { limit: 5 });
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("5");
    });
  });

  describe("tail", () => {
    it("should build tail with default limit", () => {
      const call = buildInvokeCall("tail", {});
      expect(call.name).toBe("tail");
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
    });
  });

  describe("slice", () => {
    it("should build slice with start and end", () => {
      const call = buildInvokeCall("slice", { start: 10, end: 20 });
      expect(call.name).toBe("slice");
      expect(call.parameters.find((p) => p.name === "start")?.value).toBe("10");
      expect(call.parameters.find((p) => p.name === "end")?.value).toBe("20");
    });
  });

  describe("top", () => {
    it("should build top with column and limit", () => {
      const call = buildInvokeCall("top", { column: "score", limit: 5 });
      expect(call.name).toBe("top");
      const colParam = call.parameters.find((p) => p.name === "column");
      expect(colParam?.value).toBe("score");
      expect(colParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("5");
    });
  });

  describe("sample", () => {
    it("should build sample with sample-size", () => {
      const call = buildInvokeCall("sample", { "sample-size": 100 });
      expect(call.name).toBe("sample");
      const sizeParam = call.parameters.find((p) => p.name === "sample-size");
      expect(sizeParam?.value).toBe("100");
      expect(sizeParam?.isPositional).toBe(true);
    });

    it("should include seed for reproducibility", () => {
      const call = buildInvokeCall("sample", { "sample-size": 50, seed: 42 });
      expect(call.parameters.find((p) => p.name === "seed")?.value).toBe("42");
    });
  });
});

// ========== Sort & Dedup ==========

describe("Sort & Dedup commands", () => {
  describe("sort", () => {
    it("should build sort with select", () => {
      const call = buildInvokeCall("sort", { select: "name" });
      expect(call.name).toBe("sort");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "name",
      );
    });

    it("should include reverse and numeric flags", () => {
      const call = buildInvokeCall("sort", {
        select: "score",
        reverse: true,
        numeric: true,
      });
      expect(call.parameters.find((p) => p.name === "reverse")?.value).toBe(
        "true",
      );
      expect(call.parameters.find((p) => p.name === "numeric")?.value).toBe(
        "true",
      );
    });
  });

  describe("dedup", () => {
    it("should build dedup with select", () => {
      const call = buildInvokeCall("dedup", { select: "name" });
      expect(call.name).toBe("dedup");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "name",
      );
    });

    it("should include check and keep-duplicates flags", () => {
      const call = buildInvokeCall("dedup", {
        select: "email",
        check: true,
        "keep-duplicates": true,
      });
      expect(call.parameters.find((p) => p.name === "check")?.value).toBe(
        "true",
      );
      expect(
        call.parameters.find((p) => p.name === "keep-duplicates")?.value,
      ).toBe("true");
    });
  });

  describe("shuffle", () => {
    it("should build shuffle with seed", () => {
      const call = buildInvokeCall("shuffle", { seed: 123 });
      expect(call.name).toBe("shuffle");
      expect(call.parameters.find((p) => p.name === "seed")?.value).toBe("123");
    });
  });
});

// ========== Aggregate ==========

describe("Aggregate commands", () => {
  describe("frequency", () => {
    it("should build frequency with select", () => {
      const call = buildInvokeCall("frequency", { select: "status" });
      expect(call.name).toBe("frequency");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "status",
      );
    });

    it("should include limit and approx", () => {
      const call = buildInvokeCall("frequency", {
        select: "category",
        limit: 20,
        approx: true,
      });
      expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("20");
      expect(call.parameters.find((p) => p.name === "approx")?.value).toBe(
        "true",
      );
    });
  });

  describe("groupby", () => {
    it("should build groupby with positional columns and expression", () => {
      const call = buildInvokeCall("groupby", {
        columns: "department",
        expression: "sum(salary)",
      });
      expect(call.name).toBe("groupby");
      const colParam = call.parameters.find((p) => p.name === "columns");
      const exprParam = call.parameters.find((p) => p.name === "expression");
      expect(colParam?.value).toBe("department");
      expect(colParam?.isPositional).toBe(true);
      expect(exprParam?.value).toBe("sum(salary)");
      expect(exprParam?.isPositional).toBe(true);
    });
  });

  describe("stats", () => {
    it("should build stats with select", () => {
      const call = buildInvokeCall("stats", { select: "age,salary" });
      expect(call.name).toBe("stats");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "age,salary",
      );
    });
  });

  describe("agg", () => {
    it("should build agg with expression", () => {
      const call = buildInvokeCall("agg", {
        expression: "sum(salary) as total, avg(age) as mean_age",
      });
      expect(call.name).toBe("agg");
      expect(call.parameters.find((p) => p.name === "expression")?.value).toBe(
        "sum(salary) as total, avg(age) as mean_age",
      );
    });
  });

  describe("bins", () => {
    it("should build bins with column and bins count", () => {
      const call = buildInvokeCall("bins", {
        column: "age",
        bins: 5,
      });
      expect(call.name).toBe("bins");
      const colParam = call.parameters.find((p) => p.name === "column");
      expect(colParam?.value).toBe("age");
      expect(colParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "bins")?.value).toBe("5");
    });
  });

  describe("window", () => {
    it("should build window with positional expression", () => {
      const call = buildInvokeCall("window", {
        expression: "rank() as rank",
        groupby: "department",
      });
      expect(call.name).toBe("window");
      const exprParam = call.parameters.find((p) => p.name === "expression");
      expect(exprParam?.value).toBe("rank() as rank");
      expect(exprParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "groupby")?.value).toBe(
        "department",
      );
    });
  });
});

// ========== Combine ==========

describe("Combine commands", () => {
  describe("cat", () => {
    it("should build cat with mode", () => {
      const call = buildInvokeCall("cat", {
        mode: "rows",
        inputs: "file1.csv|file2.csv",
      });
      expect(call.name).toBe("cat");
      const modeParam = call.parameters.find((p) => p.name === "mode");
      expect(modeParam?.value).toBe("rows");
      expect(modeParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "inputs")?.value).toBe(
        "file1.csv|file2.csv",
      );
    });
  });

  describe("join", () => {
    it("should build join with positional params", () => {
      const call = buildInvokeCall("join", {
        input1: "/data/a.csv",
        input2: "/data/b.csv",
        columns: "id",
        "join-type": "left",
      });
      expect(call.name).toBe("join");
      expect(call.parameters.find((p) => p.name === "input1")?.value).toBe(
        "/data/a.csv",
      );
      expect(call.parameters.find((p) => p.name === "input2")?.value).toBe(
        "/data/b.csv",
      );
      expect(call.parameters.find((p) => p.name === "columns")?.value).toBe(
        "id",
      );
      expect(call.parameters.find((p) => p.name === "join-type")?.value).toBe(
        "left",
      );
    });
  });

  describe("merge", () => {
    it("should build merge with inputs and select", () => {
      const call = buildInvokeCall("merge", {
        inputs: "/data/b.csv",
        select: "id",
      });
      expect(call.name).toBe("merge");
      const inputsParam = call.parameters.find((p) => p.name === "inputs");
      expect(inputsParam?.value).toBe("/data/b.csv");
      expect(inputsParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "id",
      );
    });
  });
});

// ========== Transform ==========

describe("Transform commands", () => {
  describe("transform", () => {
    it("should build transform with expression", () => {
      const call = buildInvokeCall("transform", {
        expression: 'if col("age") > 18 then "adult" else "minor"',
      });
      expect(call.name).toBe("transform");
      expect(call.parameters.find((p) => p.name === "expression")?.value).toBe(
        'if col("age") > 18 then "adult" else "minor"',
      );
    });
  });

  describe("enum", () => {
    it("should build enum with column-name", () => {
      const call = buildInvokeCall("enum", { "column-name": "row_num" });
      expect(call.name).toBe("enum");
      expect(call.parameters.find((p) => p.name === "column-name")?.value).toBe(
        "row_num",
      );
    });
  });

  describe("fill", () => {
    it("should build fill with select and value", () => {
      const call = buildInvokeCall("fill", {
        select: "score",
        value: "N/A",
      });
      expect(call.name).toBe("fill");
      expect(call.parameters.find((p) => p.name === "select")?.value).toBe(
        "score",
      );
      expect(call.parameters.find((p) => p.name === "value")?.value).toBe(
        "N/A",
      );
    });
  });

  describe("complete", () => {
    it("should build complete with column", () => {
      const call = buildInvokeCall("complete", {
        column: "month",
        groupby: "department",
      });
      expect(call.name).toBe("complete");
      const colParam = call.parameters.find((p) => p.name === "column");
      expect(colParam?.value).toBe("month");
      expect(colParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "groupby")?.value).toBe(
        "department",
      );
    });
  });

  describe("separate", () => {
    it("should build separate with positional params", () => {
      const call = buildInvokeCall("separate", {
        column: "full_name",
        separator: ",",
      });
      expect(call.name).toBe("separate");
      const colParam = call.parameters.find((p) => p.name === "column");
      expect(colParam?.value).toBe("full_name");
      expect(colParam?.isPositional).toBe(true);
      const sepParam = call.parameters.find((p) => p.name === "separator");
      expect(sepParam?.value).toBe(",");
      expect(sepParam?.isPositional).toBe(true);
    });
  });
});

// ========== Format ==========

describe("Format commands", () => {
  describe("rename", () => {
    it("should build rename with columns", () => {
      const call = buildInvokeCall("rename", {
        columns: "old:new",
      });
      expect(call.name).toBe("rename");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("old:new");
      expect(colParam?.isPositional).toBe(true);
    });
  });

  describe("explode", () => {
    it("should build explode with positional columns", () => {
      const call = buildInvokeCall("explode", {
        columns: "tags",
        sep: ",",
      });
      expect(call.name).toBe("explode");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("tags");
      expect(colParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "sep")?.value).toBe(",");
    });
  });

  describe("implode", () => {
    it("should build implode with positional columns", () => {
      const call = buildInvokeCall("implode", {
        columns: "tag",
        sep: "|",
      });
      expect(call.name).toBe("implode");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("tag");
      expect(colParam?.isPositional).toBe(true);
      expect(call.parameters.find((p) => p.name === "sep")?.value).toBe("|");
    });
  });

  describe("fmt", () => {
    it("should build fmt with out-delimiter", () => {
      const call = buildInvokeCall("fmt", {
        "out-delimiter": ";",
      });
      expect(call.name).toBe("fmt");
      expect(
        call.parameters.find((p) => p.name === "out-delimiter")?.value,
      ).toBe(";");
    });
  });

  describe("to", () => {
    it("should build to with format", () => {
      const call = buildInvokeCall("to", {
        format: "xlsx",
      });
      expect(call.name).toBe("to");
      const fmtParam = call.parameters.find((p) => p.name === "format");
      expect(fmtParam?.value).toBe("xlsx");
      expect(fmtParam?.isPositional).toBe(true);
    });

    it("should apply default format", () => {
      const call = buildInvokeCall("to", {});
      expect(call.parameters.find((p) => p.name === "format")?.value).toBe(
        "xlsx",
      );
    });
  });

  describe("from", () => {
    it("should build from with format", () => {
      const call = buildInvokeCall("from", {
        format: "xlsx",
      });
      expect(call.name).toBe("from");
      expect(call.parameters.find((p) => p.name === "format")?.value).toBe(
        "xlsx",
      );
    });

    it("should apply default format", () => {
      const call = buildInvokeCall("from", {});
      expect(call.parameters.find((p) => p.name === "format")?.value).toBe(
        "xlsx",
      );
    });
  });
});

// ========== Transpose & Pivot ==========

describe("Transpose & Pivot commands", () => {
  describe("transpose", () => {
    it("should build transpose with no required params", () => {
      const call = buildInvokeCall("transpose", {});
      expect(call.name).toBe("transpose");
    });
  });

  describe("pivot", () => {
    it("should build pivot with columns and expression", () => {
      const call = buildInvokeCall("pivot", {
        columns: "quarter",
        expr: "sum(revenue)",
        groupby: "department",
      });
      expect(call.name).toBe("pivot");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("quarter");
      expect(colParam?.isPositional).toBe(true);
      const exprParam = call.parameters.find((p) => p.name === "expr");
      expect(exprParam?.value).toBe("sum(revenue)");
      expect(exprParam?.isPositional).toBe(true);
    });
  });

  describe("unpivot", () => {
    it("should build unpivot with columns", () => {
      const call = buildInvokeCall("unpivot", {
        columns: "q1,q2,q3,q4",
        "name-column": "quarter",
        "value-column": "revenue",
      });
      expect(call.name).toBe("unpivot");
      const colParam = call.parameters.find((p) => p.name === "columns");
      expect(colParam?.value).toBe("q1,q2,q3,q4");
      expect(colParam?.isPositional).toBe(true);
    });
  });
});

// ========== Split ==========

describe("Split commands", () => {
  describe("split", () => {
    it("should build split with size", () => {
      const call = buildInvokeCall("split", {
        "out-dir": "/output",
        size: 1000,
        filename: "chunk_{}.csv",
      });
      expect(call.name).toBe("split");
      expect(call.parameters.find((p) => p.name === "size")?.value).toBe(
        "1000",
      );
      expect(call.parameters.find((p) => p.name === "filename")?.value).toBe(
        "chunk_{}.csv",
      );
    });

    it("should use default filename template", () => {
      const call = buildInvokeCall("split", { size: 500 });
      expect(call.parameters.find((p) => p.name === "filename")?.value).toBe(
        "output_{}.csv",
      );
    });
  });

  describe("partition", () => {
    it("should build partition with column", () => {
      const call = buildInvokeCall("partition", {
        column: "status",
        "out-dir": "/output",
      });
      expect(call.name).toBe("partition");
      const colParam = call.parameters.find((p) => p.name === "column");
      expect(colParam?.value).toBe("status");
      expect(colParam?.isPositional).toBe(true);
    });
  });
});

// ========== Other ==========

describe("Other commands", () => {
  describe("reverse", () => {
    it("should build reverse with no params", () => {
      const call = buildInvokeCall("reverse", {});
      expect(call.name).toBe("reverse");
    });
  });

  describe("range", () => {
    it("should build range with positional start and end", () => {
      const call = buildInvokeCall("range", { start: 1, end: 100 });
      expect(call.name).toBe("range");
      expect(call.parameters.find((p) => p.name === "start")?.value).toBe("1");
      expect(call.parameters.find((p) => p.name === "end")?.value).toBe("100");
    });
  });

  describe("run", () => {
    it("should build run with pipeline mode", () => {
      const call = buildInvokeCall("run", {
        mode: "pipeline",
        pipeline: "xan view | xan head",
      });
      expect(call.name).toBe("run");
      expect(call.parameters.find((p) => p.name === "pipeline")?.value).toBe(
        "xan view | xan head",
      );
    });

    it("should build run with script mode", () => {
      const call = buildInvokeCall("run", {
        mode: "script",
        file: "/scripts/process.py",
      });
      expect(call.name).toBe("run");
      expect(call.parameters.find((p) => p.name === "file")?.value).toBe(
        "/scripts/process.py",
      );
    });
  });

  describe("eval", () => {
    it("should build eval with expr", () => {
      const call = buildInvokeCall("eval", {
        expr: "sum(col('amount'))",
      });
      expect(call.name).toBe("eval");
      const exprParam = call.parameters.find((p) => p.name === "expr");
      expect(exprParam?.value).toBe("sum(col('amount'))");
      expect(exprParam?.isPositional).toBe(true);
    });
  });
});

// ========== Output ==========

describe("Output command", () => {
  it("should build output with positional path", () => {
    const call = buildInvokeCall("output", { path: "/out/result.csv" });
    expect(call.name).toBe("output");
    const pathParam = call.parameters.find((p) => p.name === "path");
    expect(pathParam?.value).toBe("/out/result.csv");
    expect(pathParam?.isPositional).toBe(true);
  });
});

// ========== Array value joining ==========

describe("Array value joining", () => {
  it("should join array values with pipe separator", () => {
    const call = buildInvokeCall("cat", {
      mode: "rows",
      inputs: ["file1.csv", "file2.csv", "file3.csv"],
    });
    expect(call.parameters.find((p) => p.name === "inputs")?.value).toBe(
      "file1.csv|file2.csv|file3.csv",
    );
  });

  it("should filter empty values from array", () => {
    const call = buildInvokeCall("cat", {
      mode: "rows",
      inputs: ["file1.csv", "", "file3.csv"],
    });
    expect(call.parameters.find((p) => p.name === "inputs")?.value).toBe(
      "file1.csv|file3.csv",
    );
  });
});

// ========== Default value application ==========

describe("Default value application", () => {
  it("should apply defaults for view command", () => {
    const call = buildInvokeCall("view", {});
    expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
    expect(call.parameters.find((p) => p.name === "theme")?.value).toBe(
      "borderless",
    );
    expect(call.parameters.find((p) => p.name === "expand")?.value).toBe(
      "true",
    );
  });

  it("should apply defaults for frequency command", () => {
    const call = buildInvokeCall("frequency", {});
    expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
  });

  it("should apply defaults for head command", () => {
    const call = buildInvokeCall("head", {});
    expect(call.parameters.find((p) => p.name === "limit")?.value).toBe("10");
  });

  it("should apply defaults for split command", () => {
    const call = buildInvokeCall("split", {});
    expect(call.parameters.find((p) => p.name === "size")?.value).toBe(
      "1000000",
    );
    expect(call.parameters.find((p) => p.name === "filename")?.value).toBe(
      "output_{}.csv",
    );
  });

  it("should apply default join-type for join command", () => {
    const call = buildInvokeCall("join", {
      input1: "a.csv",
      input2: "b.csv",
    });
    expect(call.parameters.find((p) => p.name === "join-type")?.value).toBe(
      "inner",
    );
  });

  it("should apply default mode for cat command", () => {
    const call = buildInvokeCall("cat", {});
    expect(call.parameters.find((p) => p.name === "mode")?.value).toBe("rows");
  });

  it("should apply default column-sep for pivot command", () => {
    const call = buildInvokeCall("pivot", {});
    expect(call.parameters.find((p) => p.name === "column-sep")?.value).toBe(
      "_",
    );
  });
});

// ========== All commands exist in xanCommands ==========

describe("All command IDs are defined", () => {
  const expectedIds = [
    "output",
    "view",
    "headers",
    "count",
    "flatten",
    "hist",
    "plot",
    "select",
    "drop",
    "map",
    "transform",
    "enum",
    "fill",
    "complete",
    "separate",
    "blank",
    "search",
    "bisect",
    "filter",
    "head",
    "tail",
    "slice",
    "top",
    "sample",
    "sort",
    "dedup",
    "shuffle",
    "frequency",
    "groupby",
    "stats",
    "agg",
    "bins",
    "window",
    "cat",
    "join",
    "merge",
    "rename",
    "behead",
    "fixlengths",
    "explode",
    "implode",
    "input",
    "scrape",
    "fmt",
    "to",
    "from",
    "reverse",
    "transpose",
    "pivot",
    "unpivot",
    "split",
    "partition",
    "range",
    "run",
    "eval",
    "batch-filter",
    "batch-from",
    "batch-to",
  ];

  it("should have all expected commands", () => {
    for (const id of expectedIds) {
      const cmd = xanCommands.find((c) => c.id === id);
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBeTruthy();
      expect(cmd!.parameters).toBeDefined();
    }
  });

  it("should have unique IDs", () => {
    const ids = xanCommands.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("every command should produce valid invoke params", () => {
    for (const cmd of xanCommands) {
      const params = buildInvokeParams(cmd.id, {});
      expect(params.length).toBe(cmd.parameters.length);
      for (const param of params) {
        expect(param.name).toBeTruthy();
        expect(typeof param.value).toBe("string");
      }
    }
  });
});
