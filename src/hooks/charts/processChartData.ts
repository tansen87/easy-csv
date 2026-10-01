import type { ChartConfig, ChartDataPoint, ChartSeries } from "@/types/xan";

/**
 * Why a chart produced no/partial series.
 *
 * The panel used to receive a bare `[]` for every failure mode and rendered an
 * empty axis for all of them, so "file has no rows", "column name is wrong" and
 * "column is all nulls" were indistinguishable.
 */
export type ChartDataIssue =
  | { kind: "no_rows" }
  | { kind: "column_not_found"; column: string; available: string[] }
  | { kind: "no_numeric_values"; column: string; totalRows: number; nonNumericRows: number };

export interface ChartDataResult {
  series: ChartSeries[];
  /** Present only when the chart could not be built, or was built partially. */
  issue?: ChartDataIssue;
  /** Rows whose value cell could not be parsed as a number. */
  droppedRows: number;
  /** Data was cut short before shaping, so aggregates are incomplete. */
  truncated?: boolean;
}

/** Sort applied to the category axis. */
export type ChartSort = "desc" | "asc" | "none";

export interface ChartProcessOptions {
  /**
   * Category charts default to value-descending so "who is biggest" is
   * answerable at a glance. Line charts keep source order because their x axis
   * is usually a time series that must not be reshuffled.
   */
  sort?: ChartSort;
}

const DEFAULT_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#d97706",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#15803d",
  "#be185d",
];

/** Default sort for a chart type when the caller does not specify one. */
export function defaultSortFor(chartType: ChartConfig["chartType"]): ChartSort {
  switch (chartType) {
    case "bar":
    case "pie":
    case "heatmap":
      return "desc";
    default:
      // line / scatter / histogram / wordcloud keep their natural order.
      return "none";
  }
}

/**
 * Parse a value cell, distinguishing "no value" from a real 0.
 *
 * `parseFloat(v) || 0` (the previous behaviour) turned `N/A`, empty strings and
 * thousands-separated numbers into a literal 0, which drew a fake crash to zero
 * on line charts and a phantom zero bar on bar charts.
 */
export function parseNumericCell(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  const text = String(raw).trim();
  if (text === "") return null;

  // Strip thousands separators ("1,234" / "1 234" / "1.234,5"-style groupings)
  // so grouped numbers are read as numbers instead of silently becoming 1.
  const cleaned = text.replace(/[\s\u00a0,]/g, "");
  if (cleaned === "" || /^[-+]?$/.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Stable per-category colour so hiding a series never recolours the others. */
export function colorForIndex(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
}

function sortPoints<T extends { value: number }>(
  points: T[],
  sort: ChartSort,
): T[] {
  if (sort === "none") return points;
  const sorted = [...points].sort((a, b) =>
    sort === "desc" ? b.value - a.value : a.value - b.value,
  );
  return sorted;
}

/**
 * Transform raw tabular data (headers + string cells) into recharts series
 * according to the chart config. Pure function — no React, no IO.
 *
 * Returns a `ChartDataResult` carrying both the series and the reason nothing
 * could be drawn, so the panel can explain itself.
 */
export function processChartDataWithIssues(
  headers: string[],
  data: string[][],
  config: ChartConfig,
  options: ChartProcessOptions = {},
): ChartDataResult {
  const xIndex = headers.indexOf(config.x);
  if (xIndex === -1) {
    return {
      series: [],
      issue: { kind: "column_not_found", column: config.x, available: headers },
      droppedRows: 0,
    };
  }

  if (data.length === 0) {
    return { series: [], issue: { kind: "no_rows" }, droppedRows: 0 };
  }

  const categoryIndex = config.category ? headers.indexOf(config.category) : -1;
  const yIndex = config.y ? headers.indexOf(config.y) : -1;
  const sort = options.sort ?? defaultSortFor(config.chartType);

  if (config.chartType === "histogram") {
    // For histogram, we need numeric values from x column
    const values = data
      .map((row) => parseNumericCell(row[xIndex]))
      .filter((v): v is number => v !== null);

    if (values.length === 0) {
      return {
        series: [],
        issue: {
          kind: "no_numeric_values",
          column: config.x,
          totalRows: data.length,
          nonNumericRows: data.length,
        },
        droppedRows: data.length,
      };
    }

    const bins = config.bins || 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins || 1;

    const histogramData: ChartDataPoint[] = [];
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = values.filter((v) =>
        i === bins - 1 ? v >= binStart && v <= binEnd : v >= binStart && v < binEnd,
      ).length;
      histogramData.push({
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        count,
      });
    }

    return {
      series: [
        {
          name: config.x,
          data: histogramData,
          color: config.color || colorForIndex(0),
        },
      ],
      droppedRows: data.length - values.length,
    };
  }

  if (config.chartType === "wordcloud") {
    const wordCounts = new Map<string, number>();

    data.forEach((row) => {
      const text = row[xIndex] || "";
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      const weight = yIndex >= 0 ? parseNumericCell(row[yIndex]) ?? 1 : 1;

      words.forEach((word) => {
        const cleanWord = word.replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
        if (cleanWord) {
          wordCounts.set(cleanWord, (wordCounts.get(cleanWord) || 0) + weight);
        }
      });
    });

    const maxCount = Math.max(...Array.from(wordCounts.values()), 1);
    const wordData: ChartDataPoint[] = Array.from(wordCounts.entries())
      .map(([word, count]) => ({
        text: word,
        value: count,
        normalizedValue: count / maxCount,
      }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 200);

    if (wordData.length === 0) {
      return {
        series: [],
        issue: {
          kind: "no_numeric_values",
          column: config.x,
          totalRows: data.length,
          nonNumericRows: data.length,
        },
        droppedRows: 0,
      };
    }

    return {
      series: [
        {
          name: config.x,
          data: wordData,
          color: config.color || colorForIndex(0),
        },
      ],
      droppedRows: 0,
    };
  }

  if (config.chartType === "heatmap") {
    const yCol = yIndex >= 0 ? headers[yIndex] : "count";
    const xValues = new Set<string>();
    const yValues = new Set<string>();
    const valueMap = new Map<string, number>();

    data.forEach((row) => {
      const xVal = String(row[xIndex] || "");
      const yVal = yIndex >= 0 ? String(row[yIndex] || "") : "";

      xValues.add(xVal);
      yValues.add(yVal);

      const key = `${xVal}|${yVal}`;
      valueMap.set(key, (valueMap.get(key) || 0) + 1);
    });

    const xArray = Array.from(xValues);
    const yArray = Array.from(yValues);
    const maxValue = Math.max(...Array.from(valueMap.values()), 1);

    const heatData: ChartDataPoint[] = [];
    yArray.forEach((yVal) => {
      xArray.forEach((xVal) => {
        const key = `${xVal}|${yVal}`;
        const value = valueMap.get(key) || 0;
        heatData.push({
          [config.x]: xVal,
          [yCol]: yVal,
          value,
          normalizedValue: value / maxValue,
        });
      });
    });

    return {
      series: [
        {
          name: `${config.x} vs ${yCol}`,
          data: heatData,
          color: config.color || colorForIndex(0),
        },
      ],
      droppedRows: 0,
    };
  }

  // Everything below draws the y column, so a missing y is a hard stop rather
  // than a chart with an invented "count" axis.
  if (config.chartType === "pie") {
    if (categoryIndex >= 0) {
      const categories = new Map<string, ChartDataPoint[]>();
      data.forEach((row) => {
        const cat = row[categoryIndex] || "Unknown";
        if (!categories.has(cat)) {
          categories.set(cat, []);
        }
        const point: ChartDataPoint = { [config.x]: row[xIndex] };
        point[config.y || "count"] =
          yIndex >= 0 ? parseNumericCell(row[yIndex]) ?? 0 : 1;
        categories.get(cat)!.push(point);
      });

      return {
        series: Array.from(categories.entries()).map(([cat, points], i) => ({
          name: cat,
          data: points,
          color: colorForIndex(i),
        })),
        droppedRows: 0,
      };
    }

    const valueKey = config.y || "count";
    let dropped = 0;
    const points: ChartDataPoint[] = data.map((row) => {
      const point: ChartDataPoint = { [config.x]: row[xIndex] };
      const value = yIndex >= 0 ? parseNumericCell(row[yIndex]) : 1;
      if (yIndex >= 0 && value === null) dropped++;
      point[valueKey] = value ?? 0;
      return point;
    });

    // Aggregate duplicate category names first so sorting and the legend act on
    // the values actually drawn (pie slices are per category, not per row).
    const aggregated = Array.from(
      points
        .reduce((map, item) => {
          const name = String(item[config.x]);
          const value = Number(item[valueKey]) || 0;
          const existing = map.get(name);
          if (existing) existing.value += value;
          else map.set(name, { name, value });
          return map;
        }, new Map<string, { name: string; value: number }>())
        .values(),
    );

    return {
      series: [
        {
          name: config.x,
          data: sortPoints(aggregated, sort).map((d) => ({
            [config.x]: d.name,
            [valueKey]: d.value,
          })),
          color: config.color || colorForIndex(0),
        },
      ],
      droppedRows: dropped,
    };
  }

  if (categoryIndex >= 0) {
    // Group by category
    const categories = new Map<string, ChartDataPoint[]>();
    let dropped = 0;
    data.forEach((row) => {
      const cat = row[categoryIndex] || "Unknown";
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      const point: ChartDataPoint = { [config.x]: row[xIndex] };
      if (yIndex >= 0) {
        const value = parseNumericCell(row[yIndex]);
        if (value === null) dropped++;
        // `null` (not 0): recharts leaves a gap instead of drawing a fake zero.
        point[config.y!] = value === null ? (null as unknown as number) : value;
      }
      categories.get(cat)!.push(point);
    });

    return {
      series: Array.from(categories.entries()).map(([cat, points], i) => ({
        name: cat,
        data: points,
        color: colorForIndex(i),
      })),
      droppedRows: dropped,
    };
  }

  // Simple series
  let dropped = 0;
  const points: ChartDataPoint[] = data.map((row) => {
    const point: ChartDataPoint = { [config.x]: row[xIndex] };
    if (yIndex >= 0) {
      const value = parseNumericCell(row[yIndex]);
      if (value === null) dropped++;
      point[config.y!] = value === null ? (null as unknown as number) : value;
    }
    return point;
  });

  // A y column that exists but never parses is a data problem worth naming,
  // not an empty chart.
  if (yIndex >= 0 && dropped === data.length) {
    return {
      series: [],
      issue: {
        kind: "no_numeric_values",
        column: config.y!,
        totalRows: data.length,
        nonNumericRows: dropped,
      },
      droppedRows: dropped,
    };
  }

  return {
    series: [
      {
        name: config.y || config.x,
        data: points,
        color: config.color || colorForIndex(0),
      },
    ],
    droppedRows: dropped,
  };
}

/**
 * Backwards-compatible wrapper returning only the series.
 *
 * Existing callers and tests use this shape; the chart panel uses
 * `processChartDataWithIssues` so it can also explain failures.
 */
export function processChartData(
  headers: string[],
  data: string[][],
  config: ChartConfig,
  options: ChartProcessOptions = {},
): ChartSeries[] {
  return processChartDataWithIssues(headers, data, config, options).series;
}
