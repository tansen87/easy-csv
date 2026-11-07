import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { DataLineagePanel } from "@/modules/pipeline/panels/DataLineagePanel";
import { ColumnSchema, StepLineage } from "@/types/xan";

/**
 * Data lineage panel.
 *
 * The panel answers one question per column ("where did it come from, where did
 * it go") inside 320px, so the node graph lives in the fullscreen lane view.
 * These tests pin the list grouping, the inline path, and the two empty states.
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

const lineage: StepLineage[] = [
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
    outputSchema: [
      grouped[0],
      grouped[2],
      { ...grouped[1], name: "销售额", previousName: "金额合计" },
    ],
    inputRowCount: 5,
    outputRowCount: 5,
    transformations: [],
  },
];

type PanelProps = React.ComponentProps<typeof DataLineagePanel>;

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    lineageData: lineage,
    onSaveLineage: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <LanguageProvider>
      <DataLineagePanel {...props} />
    </LanguageProvider>,
  );
  return { ...utils, props };
}

const rowOf = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("easy-csv-language", "zh");
});

afterEach(() => {
  localStorage.clear();
});

describe("DataLineagePanel · list", () => {
  it("splits columns into result and removed groups with counts", () => {
    renderPanel();

    expect(screen.getByText("结果中的列")).toBeInTheDocument();
    expect(screen.getByText("中途被移除")).toBeInTheDocument();
    expect(rowOf("品类")).toBeInTheDocument();
    expect(rowOf("销售额")).toBeInTheDocument();
    expect(rowOf("日期")).toBeInTheDocument();
  });

  it("summarises what happened to a column in one line", () => {
    renderPanel();

    expect(rowOf("销售额")).toHaveTextContent("4 步 · 改名 1 次");
    expect(rowOf("品类")).toHaveTextContent("第 3 步分组键");
    expect(rowOf("数量合计")).toHaveTextContent("第 3 步生成");
    expect(rowOf("日期")).toHaveTextContent("之后不再出现在结果里");
  });

  it("shows the change summary when no column is selected", () => {
    renderPanel();

    expect(screen.getByText("本次改动")).toBeInTheDocument();
    expect(screen.getByText("筛掉空金额")).toBeInTheDocument();
    expect(screen.getByText("219 → 203 行")).toBeInTheDocument();
  });

  it("gives every header icon an accessible name", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "全屏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更多" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });
});

describe("DataLineagePanel · column path", () => {
  it("expands the full path of a column, one line per step", () => {
    renderPanel();
    fireEvent.click(rowOf("销售额"));

    expect(screen.getByText("列路径")).toBeInTheDocument();
    expect(rowOf("销售额")).toHaveAttribute("aria-expanded", "true");
    // 没动过这一列的步骤压成一行，只报「保留」
    expect(screen.getByText("保留")).toBeInTheDocument();
    // 动过的步骤给出细节
    expect(screen.getByText("类型")).toBeInTheDocument();
    expect(screen.getByText("生成")).toBeInTheDocument();
    expect(screen.getByText("改名")).toBeInTheDocument();
    expect(screen.getByText('sum(col("金额"))')).toBeInTheDocument();
    expect(screen.getByText("源数据")).toBeInTheDocument();
    expect(screen.getByText("在泳道图中查看")).toBeInTheDocument();
    // 打开路径时让位，不再显示「本次改动」
    expect(screen.queryByText("本次改动")).not.toBeInTheDocument();
  });

  it("collapses again when the row is clicked a second time", () => {
    renderPanel();
    fireEvent.click(rowOf("销售额"));
    fireEvent.click(rowOf("销售额"));

    expect(screen.queryByText("列路径")).not.toBeInTheDocument();
    expect(rowOf("销售额")).toHaveAttribute("aria-expanded", "false");
  });

  it("ends the rail when the column is dropped", () => {
    renderPanel();
    fireEvent.click(rowOf("日期"));

    expect(screen.getByText("路径到此为止")).toBeInTheDocument();
    expect(screen.getByText("结果里没有这一列")).toBeInTheDocument();
  });

  it("keeps only one column open at a time", () => {
    renderPanel();
    fireEvent.click(rowOf("销售额"));
    fireEvent.click(rowOf("品类"));

    expect(rowOf("销售额")).toHaveAttribute("aria-expanded", "false");
    expect(rowOf("品类")).toHaveAttribute("aria-expanded", "true");
  });
});

describe("DataLineagePanel · states", () => {
  it("explains the empty state instead of one grey line", () => {
    renderPanel({ lineageData: [] });

    expect(screen.getByText("还没有可追踪的血缘")).toBeInTheDocument();
    expect(screen.getByText("等待最近一次执行")).toBeInTheDocument();
    // 没有血缘时不显示搜索框与页脚
    expect(screen.queryByPlaceholderText("搜索列")).not.toBeInTheDocument();
    expect(screen.queryByText("最近一次执行")).not.toBeInTheDocument();
  });

  it("reports a search that matches nothing and offers a way back", () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText("搜索列"), {
      target: { value: "运费" },
    });

    expect(screen.getByText("没有匹配「运费」的列")).toBeInTheDocument();
    fireEvent.click(screen.getByText("清除搜索"));

    expect(rowOf("销售额")).toBeInTheDocument();
    expect(screen.queryByText("没有匹配「运费」的列")).not.toBeInTheDocument();
  });

  it("filters the list by column name", () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText("搜索列"), {
      target: { value: "数量" },
    });

    expect(screen.getByText("数量合计")).toBeInTheDocument();
    expect(screen.queryByText("品类")).not.toBeInTheDocument();
  });

  it("exports the lineage JSON from the ⋯ menu", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    fireEvent.click(screen.getByText("导出血缘 JSON"));

    expect(props.onSaveLineage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("导出血缘 JSON")).not.toBeInTheDocument();
  });

  it("closes from the header button", () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
