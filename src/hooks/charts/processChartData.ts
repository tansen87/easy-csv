import type { ChartConfig, ChartDataPoint, ChartSeries } from "@/types/xan";

/**
 * Transform raw tabular data (headers + string cells) into recharts series
 * according to the chart config. Pure function — no React, no IO.
 */
export function processChartData(
  headers: string[],
  data: string[][],
  config: ChartConfig,
): ChartSeries[] {
  const xIndex = headers.indexOf(config.x);
  if (xIndex === -1) return [];

  const categoryIndex = config.category ? headers.indexOf(config.category) : -1;
  const yIndex = config.y ? headers.indexOf(config.y) : -1;

  if (config.chartType === "histogram") {
    // For histogram, we need numeric values from x column
    const values = data
      .map((row) => parseFloat(row[xIndex]))
      .filter((v) => !isNaN(v));

    const bins = config.bins || 10;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;

    const histogramData: ChartDataPoint[] = [];
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = values.filter(
        (v) => v >= binStart && (i === bins - 1 ? v <= binEnd : v < binEnd),
      ).length;
      histogramData.push({
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        count,
      });
    }

    return [
      {
        name: config.x,
        data: histogramData,
        color: config.color || "#8884d8",
      },
    ];
  }

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
          yIndex >= 0 ? parseFloat(row[yIndex]) || 0 : 1;
        categories.get(cat)!.push(point);
      });

      const colors = [
        "#8884d8",
        "#82ca9d",
        "#ffc658",
        "#ff7300",
        "#0088fe",
        "#00C49F",
        "#FFBB28",
        "#FF8042",
      ];
      let colorIndex = 0;

      return Array.from(categories.entries()).map(([cat, points]) => ({
        name: cat,
        data: points,
        color: colors[colorIndex++ % colors.length],
      }));
    }

    const valueKey = config.y || "count";
    const points: ChartDataPoint[] = data.map((row) => {
      const point: ChartDataPoint = { [config.x]: row[xIndex] };
      point[valueKey] = yIndex >= 0 ? parseFloat(row[yIndex]) || 0 : 1;
      return point;
    });

    return [
      {
        name: config.x,
        data: points,
        color: config.color || "#8884d8",
      },
    ];
  }

  if (config.chartType === "wordcloud") {
    const wordCounts = new Map<string, number>();

    data.forEach((row) => {
      const text = row[xIndex] || "";
      const words = text.toLowerCase().split(/\s+/).filter(Boolean);
      const weight = yIndex >= 0 ? parseFloat(row[yIndex]) || 1 : 1;

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
      .sort((a, b) => b.value - a.value)
      .slice(0, 200);

    return [
      {
        name: config.x,
        data: wordData,
        color: config.color || "#8884d8",
      },
    ];
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
    xArray.forEach((xVal) => {
      yArray.forEach((yVal) => {
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

    return [
      {
        name: `${config.x} vs ${yCol}`,
        data: heatData,
        color: config.color || "#8884d8",
      },
    ];
  }

  if (categoryIndex >= 0) {
    // Group by category
    const categories = new Map<string, ChartDataPoint[]>();
    data.forEach((row) => {
      const cat = row[categoryIndex] || "Unknown";
      if (!categories.has(cat)) {
        categories.set(cat, []);
      }
      const point: ChartDataPoint = { [config.x]: row[xIndex] };
      if (yIndex >= 0) {
        point[config.y!] = parseFloat(row[yIndex]) || 0;
      }
      categories.get(cat)!.push(point);
    });

    const colors = [
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff7300",
      "#0088fe",
      "#00C49F",
      "#FFBB28",
      "#FF8042",
    ];
    let colorIndex = 0;

    return Array.from(categories.entries()).map(([cat, points]) => ({
      name: cat,
      data: points,
      color: colors[colorIndex++ % colors.length],
    }));
  }

  // Simple series
  const points: ChartDataPoint[] = data.map((row) => {
    const point: ChartDataPoint = { [config.x]: row[xIndex] };
    if (yIndex >= 0) {
      point[config.y!] = parseFloat(row[yIndex]) || 0;
    }
    return point;
  });

  return [
    {
      name: config.y || config.x,
      data: points,
      color: config.color || "#8884d8",
    },
  ];
}
