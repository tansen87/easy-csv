import { describe, it, expect } from "vitest";
import { ColumnSchema, StepLineage } from "@/types/xan";
import {
  buildColumnTrace,
  buildLanes,
  diffStep,
  summarizeColumns,
  summarizeSteps,
} from "@/modules/pipeline/panels/lib/columnLineage";
import {
  aggregationColumns,
  parseAggregations,
  pickSourceColumn,
} from "@/utils/lineageSchema";

/**
 * Column-level lineage inference.
 *
 * Everything here is derived from `StepLineage[]` snapshots: schema diffs plus
 * the `sourceColumnName` chain. The fixtures below mirror what
 * `useDataLineage.computeOutputSchema` produces for
 * 筛掉空金额 → 金额转数字 → 按品类汇总 → 改列名.
 */

function col(
  name: string,
  type: ColumnSchema["type"],
  extra: Partial<ColumnSchema> = {},
): ColumnSchema {
  return {
    name,
    type,
    sourceStepId: "table-node",
    sourceColumnName: name,
    ...extra,
  };
}

const source = [
  col("日期", "date"),
  col("地区", "string"),
  col("品类", "string"),
  col("金额", "string"),
  col("数量", "number"),
];

const casted = source.map((c) =>
  c.name === "金额" ? { ...c, type: "number" as const } : c,
);

const grouped = [
  col("品类", "string"),
  col("金额合计", "number", {
    sourceStepId: "s3",
    sourceColumnName: "金额",
    expression: 'sum(col("金额"))',
  }),
  col("数量合计", "number", {
    sourceStepId: "s3",
    sourceColumnName: "数量",
    expression: 'sum(col("数量"))',
  }),
];

const renamed = [
  grouped[0],
  grouped[2],
  {
    ...grouped[1],
    name: "销售额",
    previousName: "金额合计",
  },
];

function buildLineage(): StepLineage[] {
  return [
    {
      stepId: "s1",
      commandName: "filter",
      alias: "筛掉空金额",
      inputSchema: source,
      outputSchema: source,
      inputRowCount: 219,
      outputRowCount: 203,
      transformations: [],
    },
    {
      stepId: "s2",
      commandName: "cast",
      alias: "金额转数字",
      inputSchema: source,
      outputSchema: casted,
      inputRowCount: 203,
      outputRowCount: 203,
      transformations: [],
    },
    {
      stepId: "s3",
      commandName: "groupby",
      alias: "按品类汇总",
      inputSchema: casted,
      outputSchema: grouped,
      inputRowCount: 203,
      outputRowCount: 5,
      transformations: [],
    },
    {
      stepId: "s4",
      commandName: "rename",
      alias: "改列名",
      inputSchema: grouped,
      outputSchema: renamed,
      inputRowCount: 5,
      outputRowCount: 5,
      transformations: [],
    },
  ];
}

describe("diffStep", () => {
  it("reports a type change as a cast", () => {
    const diff = diffStep(buildLineage()[1]);
    expect(diff.cast).toEqual([{ name: "金额", from: "string", to: "number" }]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("pairs a removed and an added column into a rename via previousName", () => {
    const diff = diffStep(buildLineage()[3]);
    expect(diff.renamed).toEqual([{ from: "金额合计", to: "销售额" }]);
    // 改名不应该同时出现在 added / removed 里，否则「本次改动」会重复报两遍
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it("treats the aggregation output as added columns", () => {
    const diff = diffStep(buildLineage()[2]);
    expect(diff.added.map((c) => c.name)).toEqual(["金额合计", "数量合计"]);
    expect(diff.removed.map((c) => c.name)).toEqual(["日期", "地区", "金额", "数量"]);
  });
});

describe("buildColumnTrace", () => {
  it("walks a result column back to its source through rename and aggregation", () => {
    const trace = buildColumnTrace(buildLineage(), "销售额");

    expect(trace).not.toBeNull();
    expect(trace!.sourceName).toBe("金额");
    expect(trace!.sourceType).toBe("string");
    expect(trace!.finalName).toBe("销售额");
    expect(trace!.survives).toBe(true);
    expect(trace!.steps.map((s) => s.kind)).toEqual([
      "kept",
      "cast",
      "derived",
      "renamed",
    ]);
    expect(trace!.steps[2].expression).toBe('sum(col("金额"))');
    expect(trace!.steps[3].columnIn).toBe("金额合计");
    expect(trace!.steps[3].columnOut).toBe("销售额");
  });

  it("marks a group key step", () => {
    const trace = buildColumnTrace(buildLineage(), "品类");
    const groupStep = trace!.steps.find((s) => s.groupKey);
    expect(groupStep?.index).toBe(3);
    expect(groupStep?.kind).toBe("kept");
  });

  it("ends at the step that removes the column", () => {
    const trace = buildColumnTrace(buildLineage(), "地区");

    expect(trace!.survives).toBe(false);
    expect(trace!.removedAt).toBe(3);
    const last = trace!.steps[trace!.steps.length - 1];
    expect(last.kind).toBe("removed");
    expect(last.columnOut).toBeNull();
  });

  it("keeps the source type even when the column is dropped", () => {
    expect(buildColumnTrace(buildLineage(), "日期")!.sourceType).toBe("date");
  });

  it("returns null when there is no lineage", () => {
    expect(buildColumnTrace([], "金额")).toBeNull();
  });
});

describe("summarizeColumns", () => {
  it("splits surviving and dropped columns", () => {
    const groups = summarizeColumns(buildLineage());

    expect(groups.result.map((c) => c.name)).toEqual(["品类", "数量合计", "销售额"]);
    expect(groups.removed.map((c) => c.name)).toEqual(["日期", "地区"]);
  });

  it("does not report an absorbed column as removed", () => {
    const groups = summarizeColumns(buildLineage());
    const all = [...groups.result, ...groups.removed].map((c) => c.name);
    // 金额 → 金额合计 → 销售额 是一条链，不能既算结果又算移除
    expect(all).not.toContain("金额");
    expect(all).not.toContain("金额合计");
  });

  it("counts renames so the row can say 改名 1 次", () => {
    const groups = summarizeColumns(buildLineage());
    const sales = groups.result.find((c) => c.name === "销售额")!;
    expect(sales.renamedCount).toBe(1);
    expect(sales.steps).toBe(4);
  });

  it("returns empty groups for empty lineage", () => {
    expect(summarizeColumns([])).toEqual({ result: [], removed: [] });
  });
});

describe("summarizeSteps", () => {
  it("numbers steps from 1 and keeps row counts", () => {
    const changes = summarizeSteps(buildLineage());
    expect(changes.map((c) => c.index)).toEqual([1, 2, 3, 4]);
    expect(changes[2].rowCountIn).toBe(203);
    expect(changes[2].rowCountOut).toBe(5);
    expect(changes[0].alias).toBe("筛掉空金额");
  });
});

describe("buildLanes", () => {
  it("creates one lane per source column and keeps the final name", () => {
    const lanes = buildLanes(buildLineage());
    expect(lanes.map((l) => l.sourceName)).toEqual([
      "日期",
      "地区",
      "品类",
      "金额",
      "数量",
    ]);
    const amount = lanes.find((l) => l.sourceName === "金额")!;
    expect(amount.finalName).toBe("销售额");
    expect(amount.survives).toBe(true);
    expect(lanes.find((l) => l.sourceName === "日期")!.survives).toBe(false);
  });
});

describe("parseAggregations", () => {
  it("reads aliases from an aggregation expression", () => {
    const parsed = parseAggregations(
      'sum(col("金额")) as 金额合计, count() as 单数',
    );
    expect(parsed).toEqual([
      { name: "金额合计", fn: "sum", args: 'col("金额")' },
      { name: "单数", fn: "count", args: "" },
    ]);
  });

  it("ignores parts without an alias so the schema is never guessed", () => {
    expect(parseAggregations('sum(col("金额"))')).toEqual([]);
    expect(parseAggregations("garbage")).toEqual([]);
    expect(parseAggregations("")).toEqual([]);
  });

  it("accepts quoted aliases", () => {
    expect(parseAggregations('max(col("金额")) as "最大金额"')).toEqual([
      { name: "最大金额", fn: "max", args: 'col("金额")' },
    ]);
  });
});

describe("pickSourceColumn", () => {
  it("finds the input column a aggregation reads", () => {
    expect(pickSourceColumn('col("金额")', source)).toBe("金额");
    expect(pickSourceColumn("col(金额) * 2", source)).toBe("金额");
  });

  it("returns undefined when nothing matches the input schema", () => {
    expect(pickSourceColumn('col("运费")', source)).toBeUndefined();
    expect(pickSourceColumn("", source)).toBeUndefined();
  });
});

describe("aggregationColumns", () => {
  it("marks aggregate output as derived with an expression", () => {
    const [column] = aggregationColumns(
      "s3",
      'sum(col("金额")) as 金额合计',
      source,
    );
    expect(column).toMatchObject({
      name: "金额合计",
      type: "number",
      sourceColumnName: "金额",
      expression: 'sum(col("金额"))',
    });
  });

  it("keeps text aggregations typed as string", () => {
    const [column] = aggregationColumns("s3", 'first(col("地区")) as 首单地区', source);
    expect(column.type).toBe("string");
  });
});
