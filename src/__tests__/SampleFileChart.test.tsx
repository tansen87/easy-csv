import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import { ChartPanel } from "@/modules/data-preview/charts/ChartPanel";
import { LanguageProvider } from "@/i18n";
import { ThemeProvider } from "@/components/setting/ThemeProvider";
import { processChartDataWithIssues } from "@/hooks/charts/processChartData";
import type { ChartConfig } from "@/types/xan";
// Vite `?raw` import: the jsdom environment cannot require `node:fs`.
import sampleCsv from "../../src-tauri/samples/easy-csv-sample-sales.csv?raw";

/**
 * End-to-end coverage for the built-in sample file.
 *
 * The reported bug was "x = 地区, y = 金额 shows no chart at all". The cause was
 * a missing `ResponsiveContainer`, so recharts received no numeric width/height
 * and rendered nothing while the legend still showed. These cases drive the real
 * file through the same shaping + render path the app uses.
 */
function loadSample() {
  const lines = String(sampleCsv).trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const rows = lines.slice(1).map((line) => line.split(","));
  return { headers, rows };
}

const renderSample = (config: ChartConfig) => {
  const { headers, rows } = loadSample();
  localStorage.setItem("easy-csv-language", "zh");
  const processed = processChartDataWithIssues(headers, rows, config);
  const utils = render(
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
            rows,
            droppedRows: processed.droppedRows,
            issue: processed.issue,
          }}
        />
      </LanguageProvider>
    </ThemeProvider>,
  );
  return { ...utils, processed, headers, rows };
};

describe("built-in sample file (easy-csv-sample-sales.csv)", () => {
  it("exposes the expected Chinese headers", () => {
    const { headers, rows } = loadSample();
    expect(headers).toEqual(["日期", "地区", "品类", "金额", "数量"]);
    expect(rows.length).toBe(219);
  });

  it("shapes 地区 vs 金额 into a single numeric series", () => {
    const { headers, rows } = loadSample();
    const result = processChartDataWithIssues(headers, rows, {
      chartType: "bar",
      x: "地区",
      y: "金额",
    });

    expect(result.series).toHaveLength(1);
    expect(result.issue).toBeUndefined();
    // The file has 4 rows with an empty 金额: they must be reported as dropped
    // rather than silently charted as 0 (design 029 §3.3).
    expect(result.droppedRows).toBe(4);
    expect(result.series[0].data[0]).toEqual({ 地区: "西南", 金额: 14447.65 });
  });

  it("renders an actual chart surface for 地区 vs 金额", () => {
    const { container } = renderSample({ chartType: "bar", x: "地区", y: "金额" });

    // The regression: no `.recharts-wrapper` at all, i.e. a blank panel.
    expect(container.querySelector(".recharts-wrapper")).toBeTruthy();
    expect(container.querySelector(".recharts-surface")).toBeTruthy();
    expect(
      container.querySelectorAll(".recharts-bar-rectangle").length,
    ).toBeGreaterThan(0);
  });

  const chartCases: Array<[string, ChartConfig]> = [
    ["line", { chartType: "line", x: "日期", y: "金额" }],
    ["scatter", { chartType: "scatter", x: "数量", y: "金额" }],
    ["bar", { chartType: "bar", x: "地区", y: "金额" }],
    ["histogram", { chartType: "histogram", x: "金额" }],
    ["pie", { chartType: "pie", x: "品类", y: "金额" }],
    ["heatmap", { chartType: "heatmap", x: "地区", y: "品类" }],
    ["wordcloud", { chartType: "wordcloud", x: "品类" }],
  ];

  it.each(chartCases)("renders %s on the real file without crashing", (_name, config) => {
    const { container } = renderSample(config);
    // Heatmap and word cloud draw hand-rolled SVG instead of recharts.
    const drawn =
      container.querySelector(".recharts-wrapper") ??
      container.querySelector("svg");
    expect(drawn, `${config.chartType} produced nothing`).toBeTruthy();
  });
});
