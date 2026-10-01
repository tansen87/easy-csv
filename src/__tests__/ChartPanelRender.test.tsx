import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { render, fireEvent } from "@testing-library/react";
import React from "react";

import { ChartPanel } from "@/modules/data-preview/charts/ChartPanel";
import { ChartLegend, ChartTooltip } from "@/modules/data-preview/charts/ChartPrimitives";
import { LanguageProvider } from "@/i18n";
import { ThemeProvider } from "@/components/setting/ThemeProvider";
import { processChartDataWithIssues } from "@/hooks/charts/processChartData";
import type { ChartConfig } from "@/types/xan";

const wrap = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <ThemeProvider>
      <LanguageProvider>{node}</LanguageProvider>
    </ThemeProvider>,
  );

const renderPanel = (config: ChartConfig, headers: string[], data: string[][]) => {
  localStorage.setItem("easy-csv-language", "zh");
  const processed = processChartDataWithIssues(headers, data, config);
  return wrap(
    <ChartPanel
      config={config}
      series={processed.series}
      isVisible
      onClose={vi.fn()}
      chartState={{
        config,
        series: processed.series,
        headers,
        rows: data,
        droppedRows: processed.droppedRows,
        issue: processed.issue,
      }}
    />,
  );
};

const HEADERS = ["region", "sales"];
const DATA = [
  ["north", "10"],
  ["south", "30"],
];

/** Enough categories that the legend would have wrapped before the change. */
const CATEGORIES = Array.from({ length: 12 }, (_, i) => `品类${i + 1}`);

/** Interactive render so the real recharts tree is mounted (not SSR). */
const renderInteractive = (
  config: ChartConfig,
  headers: string[],
  data: string[][],
) => {
  localStorage.setItem("easy-csv-language", "zh");
  const processed = processChartDataWithIssues(headers, data, config);
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <ChartPanel
          config={config}
          series={processed.series}
          isVisible
          onClose={vi.fn()}
          chartState={{
            config,
            series: processed.series,
            headers,
            rows: data,
            droppedRows: processed.droppedRows,
            issue: processed.issue,
          }}
        />
      </LanguageProvider>
    </ThemeProvider>,
  );
};

/**
 * The panel must actually draw a chart.
 *
 * An earlier rewrite dropped the `ResponsiveContainer` wrapper, so recharts
 * received no numeric width/height. Its `validateWidthHeight` then returned
 * `null` and rendered *nothing at all* — while the legend still showed, so
 * text-only assertions stayed green and the regression shipped. These cases
 * assert the rendered surface instead.
 */
describe("ChartPanel actually draws a chart (regression: blank chart)", () => {
  const cases: Array<[ChartConfig["chartType"], ChartConfig]> = [
    ["line", { chartType: "line", x: "region", y: "sales" }],
    ["scatter", { chartType: "scatter", x: "region", y: "sales" }],
    ["bar", { chartType: "bar", x: "region", y: "sales" }],
    ["histogram", { chartType: "histogram", x: "sales" }],
    ["pie", { chartType: "pie", x: "region", y: "sales" }],
  ];

  it.each(cases)("renders a recharts surface for %s", (_name, config) => {
    const { container } = renderInteractive(config, HEADERS, DATA);
    expect(container.querySelector(".recharts-surface")).toBeTruthy();
    expect(container.querySelector(".recharts-wrapper")).toBeTruthy();
  });

  it("renders a bar for a single series with Chinese headers (sample file shape)", () => {
    // Mirrors `src-tauri/samples/easy-csv-sample-sales.csv`: the reported case
    // was x=地区, y=金额 showing no chart at all.
    const { container } = renderInteractive(
      { chartType: "bar", x: "地区", y: "金额" },
      ["日期", "地区", "品类", "金额", "数量"],
      [
        ["2026-07-01", "西南", "服饰", "14447.65", "5"],
        ["2026-07-01", "华东", "数码", "12950.81", "9"],
        ["2026-07-02", "华南", "食品", "13774.78", "4"],
      ],
    );

    expect(container.querySelector(".recharts-surface")).toBeTruthy();
    // One <path>/<rect> per bar — the data must reach the geometry, not just
    // the axis labels.
    const rects = container.querySelectorAll(".recharts-bar-rectangle");
    expect(rects.length).toBeGreaterThan(0);
  });

  it("renders a multi-series bar when a category column is given", () => {
    const { container } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      [
        ["north", "10", "web"],
        ["north", "20", "shop"],
        ["south", "30", "web"],
      ],
    );
    expect(container.querySelector(".recharts-surface")).toBeTruthy();
  });

  it("does not crash when recharts invokes the tooltip content (props contract)", () => {
    // recharts calls `content` with the whole props object. Destructuring it
    // positionally as `(payload, label)` made `payload.map` throw and blanked
    // the chart. Rendering alone exercises that path.
    const { container } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales" },
      HEADERS,
      DATA,
    );
    expect(container.querySelector(".recharts-surface")).toBeTruthy();
  });

  it("keeps the legend on one horizontally scrollable row with many categories", () => {
    // 12 categories used to wrap the legend over several lines, stealing
    // vertical space from the plot inside the fixed-height panel.
    const rows = CATEGORIES.map((c, i) => [c, String(100 - i * 5), c]);
    const { container } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      rows,
    );

    // In chart view the only ScrollArea is the legend's.
    const viewport = container.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    expect(viewport).toBeTruthy();

    // The chip row must not wrap: every category sits on the same line.
    const row = container.querySelector(".flex-nowrap");
    expect(row).toBeTruthy();
    expect(row!.children.length).toBe(CATEGORIES.length);
  });

  it("offers a category filter with a live visible/total count", () => {
    const { getByText } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      [
        ["north", "10", "web"],
        ["south", "20", "shop"],
        ["east", "30", "direct"],
      ],
    );
    expect(getByText("筛选")).toBeTruthy();
    expect(getByText("3/3")).toBeTruthy();
  });

  it("deselect-all hides every category and explains how to restore them", () => {
    const { container, getByText } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      [
        ["north", "10", "web"],
        ["south", "20", "shop"],
      ],
    );

    fireEvent.click(getByText("筛选"));
    fireEvent.click(getByText("取消全选"));

    // A blank plot would look broken; the panel explains itself instead.
    expect(container.querySelector(".recharts-surface")).toBeNull();
    expect(container.textContent).toContain("全部分类已隐藏");
    expect(container.textContent).toContain("重新显示");
  });

  it("select-all restores the chart after deselect-all", () => {
    const { container, getByText } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      [
        ["north", "10", "web"],
        ["south", "20", "shop"],
      ],
    );

    fireEvent.click(getByText("筛选"));
    fireEvent.click(getByText("取消全选"));
    fireEvent.click(getByText("全选"));

    expect(container.querySelector(".recharts-surface")).toBeTruthy();
  });

  it("keeps the legend chips and the filter dropdown in sync", () => {
    const { container, getByText } = renderInteractive(
      { chartType: "bar", x: "region", y: "sales", category: "channel" },
      ["region", "sales", "channel"],
      [
        ["north", "10", "web"],
        ["south", "20", "shop"],
      ],
    );

    // Hide one series via the dropdown checkbox…
    fireEvent.click(getByText("筛选"));
    const checkbox = container.querySelector('input[type="checkbox"]')!;
    fireEvent.click(checkbox);
    // …the count updates…
    expect(getByText("1/2")).toBeTruthy();
    // …and the matching legend chip is marked hidden (aria-pressed = false).
    const chips = container.querySelectorAll('[data-radix-scroll-area-viewport] button');
    const pressed = Array.from(chips).map((c) => c.getAttribute("aria-pressed"));
    expect(pressed).toContain("false");
  });
});

describe("ChartPanel renders without act()", () => {
  it("renders a single-series bar chart with a Y legend", () => {
    const html = renderPanel({ chartType: "bar", x: "region", y: "sales" }, HEADERS, DATA);
    // The old panel showed no legend at all for a single series.
    expect(html).toContain("sales");
    expect(html).toContain("Y 轴");
  });

  it("shows a localised chart type, never the raw id", () => {
    const html = renderPanel({ chartType: "heatmap", x: "region", y: "sales" }, HEADERS, DATA);
    expect(html).toContain("热力图");
    expect(html).not.toContain("heatmap");
  });

  it("explains a missing column instead of rendering a blank axis", () => {
    const html = renderPanel({ chartType: "bar", x: "Region", y: "sales" }, HEADERS, DATA);
    expect(html).toContain("找不到列");
    expect(html).toContain("region");
  });

  it("offers a data-table view", () => {
    const html = renderPanel({ chartType: "bar", x: "region", y: "sales" }, HEADERS, DATA);
    expect(html).toContain("数据表");
    expect(html).toContain("图表");
  });

  it("renders the data table inside a ScrollArea (styled scrollbar)", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const config: ChartConfig = { chartType: "bar", x: "region", y: "sales" };
    const processed = processChartDataWithIssues(HEADERS, DATA, config);
    const { container, getByText } = render(
      <ThemeProvider>
        <LanguageProvider>
          <ChartPanel
            config={config}
            series={processed.series}
            isVisible
            onClose={vi.fn()}
            chartState={{
              config,
              series: processed.series,
              headers: HEADERS,
              rows: DATA,
            }}
          />
        </LanguageProvider>
      </ThemeProvider>,
    );

    // Switching to the table view is what mounts the table.
    fireEvent.click(getByText("数据表"));

    // Radix renders the viewport with this marker; the plain
    // `<div className="overflow-auto">` this replaced had no such node and fell
    // back to the OS scrollbar.
    expect(
      container.querySelector("[data-radix-scroll-area-viewport]"),
    ).toBeTruthy();
    expect(container.querySelector("table")).toBeTruthy();
  });

  it("keeps both scrollbar orientations available for wide tables", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const config: ChartConfig = { chartType: "bar", x: "region", y: "sales" };
    const processed = processChartDataWithIssues(HEADERS, DATA, config);
    const { container, getByText } = render(
      <ThemeProvider>
        <LanguageProvider>
          <ChartPanel
            config={config}
            series={processed.series}
            isVisible
            onClose={vi.fn()}
            chartState={{
              config,
              series: processed.series,
              headers: HEADERS,
              rows: DATA,
            }}
          />
        </LanguageProvider>
      </ThemeProvider>,
    );
    fireEvent.click(getByText("数据表"));

    // Radix only mounts a ScrollAreaScrollbar once it can measure content
    // overflow, and jsdom reports every box as 0×0 — so the scrollbar *nodes*
    // are absent here even though the real browser renders them. Assert the
    // mechanism that actually drives them: the viewport keeps both axes
    // scrollable because the component mounts both orientations (it does not
    // pass `hideHorizontalScrollbar`).
    const viewport = container.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );
    expect(viewport).toBeTruthy();
    expect(viewport!.style.overflowX).toBe("scroll");
    expect(viewport!.style.overflowY).toBe("scroll");

    // A wide table must be able to grow past the box instead of being clipped
    // by Radix's `display: table` content wrapper.
    const content = viewport!.firstElementChild as HTMLElement;
    expect(content.style.minWidth).toBe("100%");
  });

  it("keeps the header row sticky inside the scroll viewport", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const config: ChartConfig = { chartType: "bar", x: "region", y: "sales" };
    const processed = processChartDataWithIssues(HEADERS, DATA, config);
    const { container, getByText } = render(
      <ThemeProvider>
        <LanguageProvider>
          <ChartPanel
            config={config}
            series={processed.series}
            isVisible
            onClose={vi.fn()}
            chartState={{
              config,
              series: processed.series,
              headers: HEADERS,
              rows: DATA,
            }}
          />
        </LanguageProvider>
      </ThemeProvider>,
    );
    fireEvent.click(getByText("数据表"));

    const head = container.querySelector("thead");
    expect(head).toBeTruthy();
    expect(head!.className).toContain("sticky");
    // The table must live inside the scroll viewport, not beside it.
    expect(
      container
        .querySelector("[data-radix-scroll-area-viewport]")!
        .contains(container.querySelector("table")),
    ).toBe(true);
  });

  it("warns when rows were dropped as non-numeric", () => {
    const html = renderPanel(
      { chartType: "bar", x: "region", y: "sales" },
      HEADERS,
      [
        ["north", "10"],
        ["south", "N/A"],
      ],
    );
    expect(html).toContain("跳过");
  });

  it("warns when the data was truncated", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const config: ChartConfig = { chartType: "bar", x: "region", y: "sales" };
    const processed = processChartDataWithIssues(HEADERS, DATA, config);
    const html = wrap(
      <ChartPanel
        config={config}
        series={processed.series}
        isVisible
        onClose={vi.fn()}
        chartState={{
          config,
          series: processed.series,
          headers: HEADERS,
          rows: DATA,
          truncated: true,
          totalRows: 9999,
        }}
      />,
    );
    expect(html).toContain("9999");
    expect(html).toContain("仅基于前");
  });

  it("renders a word cloud with its font-size explanation", () => {
    const html = renderPanel(
      { chartType: "wordcloud", x: "note" },
      ["note"],
      [["alpha beta"], ["alpha gamma"]],
    );
    expect(html).toContain("字号 = 出现频次");
    expect(html).toContain("alpha");
  });

  it("renders a heatmap scale legend", () => {
    const html = renderPanel({ chartType: "heatmap", x: "region", y: "sales" }, HEADERS, DATA);
    expect(html).toContain("低");
    expect(html).toContain("高");
    expect(html).toContain("计数");
  });

  it("renders integer heatmap values without a trailing .0", () => {
    const html = renderPanel({ chartType: "heatmap", x: "region", y: "sales" }, HEADERS, DATA);
    expect(html).not.toContain(">12.0<");
  });
});

describe("ChartPrimitives", () => {
  it("renders legend entries with role hints", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const html = wrap(
      <ChartLegend entries={[{ name: "sales", color: "#123456", role: "Y 轴" }]} />,
    );
    expect(html).toContain("sales");
    expect(html).toContain("#123456");
  });

  it("renders a tooltip with value and share", () => {
    localStorage.setItem("easy-csv-language", "zh");
    const html = wrap(
      <ChartTooltip
        title="south"
        rows={[{ name: "sales", value: 1234567.891, share: 0.341 }]}
      />,
    );
    expect(html).toContain("south");
    expect(html).toContain("1,234,567.89");
    expect(html).toContain("34.1%");
  });
});
