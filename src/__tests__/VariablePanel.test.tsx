import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { VariablePanel } from "@/modules/variables/VariablePanel";
import { PipelineStep, XanCommand } from "@/types/xan";

/**
 * 管道变量面板。
 *
 * 面板是一份变量台账:按「待填写 → 已就绪 → 仅管道引用」分组,值就地可改,
 * 名称行展开引用清单。这些测试钉住分组语义、编辑契约(只写默认值、不动类型)、
 * 名称规则与「声明」的提升行为。
 *
 * 注意夹具用 ASCII 变量名:占位符语法是 [A-Za-z_]\w*,中文名本来就引用不到。
 */

function command(name: string): XanCommand {
  return {
    id: name,
    name,
    description: "",
    descriptionCn: "",
    category: "",
    parameters: [],
  };
}

function step(
  id: string,
  name: string,
  parameters: Record<string, any>,
  alias?: string,
): PipelineStep {
  return { id, command: command(name), parameters, alias };
}

const steps: PipelineStep[] = [
  step("s1", "filter", { from: "{{dateRange}}", to: "{{dateRange}}" }, "筛选"),
  step("s2", "filter", { value: "{{amountLimit}}" }),
  step("s3", "sort", { columns: "{{sortDir}}" }),
];

const variables = [
  {
    name: "dateRange",
    defaultValue: "2024-01-01..2024-03-31",
    type: "string" as const,
  },
  { name: "amountLimit", defaultValue: "", type: "string" as const },
];

type PanelProps = React.ComponentProps<typeof VariablePanel>;

function renderPanel(overrides: Partial<PanelProps> = {}) {
  const props: PanelProps = {
    steps,
    variables,
    onChange: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <LanguageProvider>
      <VariablePanel {...props} />
    </LanguageProvider>,
  );
  return { ...utils, props };
}

const nameLabel = (name: string) => `{{${name}}}`;
const valueLabel = (name: string, value: string) =>
  `{{${name}}} 默认: ${value}`;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("easy-csv-language", "zh");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("VariablePanel", () => {
  it("groups pending, ready and referenced-only variables", () => {
    renderPanel();
    expect(screen.getByText("待填写")).toBeInTheDocument();
    expect(screen.getByText("已就绪")).toBeInTheDocument();
    expect(screen.getByText("仅管道引用")).toBeInTheDocument();
    expect(screen.getByText("未填写")).toBeInTheDocument();
    expect(
      screen.getByText(/执行到这里会弹窗补填/),
    ).toBeInTheDocument();
    expect(screen.getByText("2 个变量")).toBeInTheDocument();
    expect(screen.getByText("1 个待填写")).toBeInTheDocument();
    expect(screen.getByText("1 个仅引用")).toBeInTheDocument();
  });

  it("marks unreferenced declared variables as unused", () => {
    renderPanel({
      variables: [
        ...variables,
        { name: "outDir", defaultValue: "D:\\out\\q3", type: "path" },
      ],
    });
    expect(screen.getByText("未被引用")).toBeInTheDocument();
    expect(screen.getByText("3 个变量")).toBeInTheDocument();
  });

  it("expands the reference list for a declared variable", () => {
    renderPanel();
    expect(screen.queryByText("被 2 个参数引用")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(nameLabel("dateRange")));
    expect(screen.getByText("被 2 个参数引用")).toBeInTheDocument();
    expect(screen.getAllByText("筛选")).toHaveLength(2);
    expect(screen.getByText("from")).toBeInTheDocument();
    // 收起
    fireEvent.click(screen.getByLabelText(nameLabel("dateRange")));
    expect(screen.queryByText("被 2 个参数引用")).not.toBeInTheDocument();
  });

  it("shows where an undeclared variable is used and declares it on demand", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    expect(screen.getByText(/第 3 步/)).toBeInTheDocument();
    expect(screen.getAllByText(/sort/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("声明"));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      ...variables,
      { name: "sortDir", defaultValue: "", type: "string" },
    ]);
  });

  it("commits an edited default with Enter and keeps the declared type", () => {
    const onChange = vi.fn();
    renderPanel({
      onChange,
      variables: [
        { name: "amountLimit", defaultValue: "", type: "number" as const },
      ],
    });
    fireEvent.click(screen.getByLabelText(valueLabel("amountLimit", "未填写")));
    const input = screen.getByLabelText("{{amountLimit}} 默认");
    fireEvent.change(input, { target: { value: "1200" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([
      { name: "amountLimit", defaultValue: "1200", type: "number" },
    ]);
  });

  it("cancels editing with Escape without writing a value", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(
      screen.getByLabelText(valueLabel("dateRange", "2024-01-01..2024-03-31")),
    );
    const input = screen.getByLabelText("{{dateRange}} 默认");
    fireEvent.change(input, { target: { value: "改了一半" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("{{dateRange}} 默认"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(valueLabel("dateRange", "2024-01-01..2024-03-31")),
    ).toBeInTheDocument();
  });

  it("changes the type from the row menu without touching the value", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(screen.getByLabelText("{{dateRange}} 变量操作"));
    // 类型用共享 Select:聚焦即展开,点选项提交
    fireEvent.focus(screen.getByRole("combobox", { name: "{{dateRange}} 类型" }));
    fireEvent.click(screen.getByRole("option", { name: "数值" }));
    expect(onChange).toHaveBeenCalledWith([
      {
        name: "dateRange",
        defaultValue: "2024-01-01..2024-03-31",
        type: "number",
      },
      variables[1],
    ]);
  });

  it("copies the placeholder and deletes the variable from the row menu", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(screen.getByLabelText("{{dateRange}} 变量操作"));
    fireEvent.click(screen.getByText("复制 {{dateRange}}"));
    expect(writeText).toHaveBeenCalledWith("{{dateRange}}");
    fireEvent.click(screen.getByLabelText("{{dateRange}} 变量操作"));
    fireEvent.click(screen.getByText("删除变量"));
    expect(onChange).toHaveBeenCalledWith([variables[1]]);
  });

  it("clears every declared variable behind an inline confirmation", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(screen.getByLabelText("变量操作"));
    fireEvent.click(screen.getByText("清除全部变量"));
    expect(screen.getByText("清除全部 2 个变量?")).toBeInTheDocument();
    fireEvent.click(screen.getByText("清除", { selector: "button" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("rejects invalid and duplicate names in the add form", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(screen.getByText("新增变量"));
    const input = screen.getByPlaceholderText("变量名");
    fireEvent.change(input, { target: { value: "开始 日期" } });
    expect(screen.getByText("只能用字母、数字与下划线")).toBeInTheDocument();
    expect(screen.getByText("添加")).toBeDisabled();
    fireEvent.change(input, { target: { value: "amountLimit" } });
    expect(screen.getByText("变量名已存在")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "outDir" } });
    fireEvent.focus(screen.getByRole("combobox", { name: "类型" }));
    fireEvent.click(screen.getByRole("option", { name: "路径" }));
    fireEvent.click(screen.getByText("添加"));
    expect(onChange).toHaveBeenCalledWith([
      ...variables,
      { name: "outDir", defaultValue: "", type: "path" },
    ]);
  });

  it("shows the empty state when nothing is declared or referenced", () => {
    const onChange = vi.fn();
    renderPanel({ steps: [], variables: [], onChange });
    expect(screen.getByText("还没有变量")).toBeInTheDocument();
    fireEvent.click(screen.getByText("新增变量"));
    expect(screen.getByPlaceholderText("变量名")).toBeInTheDocument();
  });

  it("collapses the expanded row after its variable disappears", () => {
    const { rerender } = renderPanel();
    fireEvent.click(screen.getByLabelText(nameLabel("dateRange")));
    expect(screen.getByText("被 2 个参数引用")).toBeInTheDocument();
    rerender(
      <LanguageProvider>
        <VariablePanel
          steps={[]}
          variables={[]}
          onChange={vi.fn()}
          onClose={vi.fn()}
        />
      </LanguageProvider>,
    );
    expect(screen.queryByText("被 2 个参数引用")).not.toBeInTheDocument();
    expect(screen.getByText("还没有变量")).toBeInTheDocument();
  });
});
