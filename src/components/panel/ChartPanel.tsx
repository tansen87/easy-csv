import { X, Maximize2, Minimize2, Download } from "lucide-react";
import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ChartConfig, ChartDataPoint, ChartSeries } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { useTheme } from "@/components/setting/ThemeProvider";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartPanelProps {
  config: ChartConfig;
  series: ChartSeries[];
  isVisible: boolean;
  onClose: () => void;
}

export const ChartPanel = React.memo(function ChartPanel({
  config,
  series,
  isVisible,
  onClose,
}: ChartPanelProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const rafRef = useRef<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [heatTooltip, setHeatTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    xVal: string;
    yVal: string;
    value: number;
  }>({ visible: false, x: 0, y: 0, xVal: "", yVal: "", value: 0 });

  useEffect(() => {
    setHiddenSeries(new Set());
  }, [series]);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const textColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";
  const tooltipBgColor = isDark ? "#1f2937" : "#ffffff";
  const tooltipBorderColor = isDark ? "#374151" : "#e5e7eb";

  const handleLegendClick = useCallback((name: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!panelRef.current) return;
    const chartContainer = panelRef.current.querySelector(".recharts-wrapper");
    const svg =
      chartContainer?.querySelector("svg") ||
      panelRef.current.querySelector(".recharts-surface");
    if (!svg) return;

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
      const bgRect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      bgRect.setAttribute("width", "100%");
      bgRect.setAttribute("height", "100%");
      bgRect.setAttribute("fill", "white");
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const encoder = new TextEncoder();
      const svgBytes = encoder.encode(svgData);

      const filePath = await save({
        filters: [{ name: "SVG Images", extensions: ["svg"] }],
        defaultPath: `chart-${config.chartType}-${config.x}.svg`,
      });

      if (filePath) {
        await writeFile(filePath, svgBytes);
      }
    } catch (error) {
      console.error("Failed to export chart:", error);
    }
  }, [config]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMaximized) return;
      e.preventDefault();
      isDraggingRef.current = true;

      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        dragStateRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          offsetX: rect.left,
          offsetY: rect.top,
        };
      }

      const panelWidth = panelRef.current?.offsetWidth || 640;
      const panelHeight = panelRef.current?.offsetHeight || 500;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !panelRef.current) return;

        const deltaX = e.clientX - dragStateRef.current.startX;
        const deltaY = e.clientY - dragStateRef.current.startY;

        let newX = dragStateRef.current.offsetX + deltaX;
        let newY = dragStateRef.current.offsetY + deltaY;

        newX = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
        newY = Math.max(56, Math.min(window.innerHeight - panelHeight, newY));

        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
        }
        rafRef.current = requestAnimationFrame(() => {
          panelRef.current!.style.left = `${newX}px`;
          panelRef.current!.style.top = `${newY}px`;
        });
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
    },
    [isMaximized],
  );

  useEffect(() => {
    if (isVisible && panelRef.current && !isMaximized) {
      const panelWidth = panelRef.current.offsetWidth || 640;
      const panelHeight = panelRef.current.offsetHeight || 500;
      const newX = Math.max(0, (window.innerWidth - panelWidth) / 2);
      const newY = Math.max(56, (window.innerHeight - panelHeight) / 2);
      panelRef.current.style.left = `${newX}px`;
      panelRef.current.style.top = `${newY}px`;
    }
  }, [isVisible, isMaximized]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, [isVisible]);

  if (!isVisible || !config) return null;

  const hasMultipleSeries = series.length > 1;

  const renderChart = () => {
    const chartWidth = isMaximized
      ? containerSize.width || "100%"
      : config.width || 600;
    const chartHeight = isMaximized
      ? containerSize.height || "100%"
      : config.height || 400;

    const commonMargin = { top: 20, right: 30, left: 20, bottom: 20 };

    const lineContent = (() => {
      if (hasMultipleSeries) {
        const mergedData = new Map<string, ChartDataPoint>();
        series.forEach((s) => {
          s.data.forEach((point) => {
            const xValue = String(point[config.x]);
            if (!mergedData.has(xValue)) {
              mergedData.set(xValue, { [config.x]: point[config.x] });
            }
            const existingPoint = mergedData.get(xValue)!;
            existingPoint[s.name] = point[config.y || config.x];
          });
        });

        const chartData = Array.from(mergedData.values());

        return (
          <LineChart data={chartData} margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={config.x}
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.xLabel
                  ? {
                      value: config.xLabel,
                      position: "bottom",
                      offset: 0,
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <YAxis
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.yLabel
                  ? {
                      value: config.yLabel,
                      angle: -90,
                      position: "insideLeft",
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: tooltipBgColor,
                borderColor: tooltipBorderColor,
              }}
            />
            {series.map((s) => {
              const isHidden = hiddenSeries.has(s.name);
              return (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  name={s.name}
                  stroke={isHidden ? "transparent" : s.color}
                  dot={isHidden ? false : { fill: s.color }}
                  activeDot={isHidden ? false : { r: 8 }}
                />
              );
            })}
          </LineChart>
        );
      }

      return (
        <LineChart data={series[0]?.data || []} margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey={config.x}
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.xLabel
                ? {
                    value: config.xLabel,
                    position: "bottom",
                    offset: 0,
                    fill: textColor,
                  }
                : undefined
            }
          />
          <YAxis
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.yLabel
                ? {
                    value: config.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: textColor,
                  }
                : undefined
            }
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: tooltipBgColor,
              borderColor: tooltipBorderColor,
            }}
          />
          <Line
            type="monotone"
            dataKey={config.y || config.x}
            name={series[0]?.name || config.y || config.x}
            stroke={series[0]?.color || config.color}
            dot={{ fill: series[0]?.color || config.color }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
      );
    })();

    const scatterContent = (() => {
      if (hasMultipleSeries) {
        const xKey = config.x;
        const yKey = config.y || config.x;

        return (
          <ScatterChart margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={xKey}
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.xLabel
                  ? {
                      value: config.xLabel,
                      position: "bottom",
                      offset: 0,
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <YAxis
              dataKey={yKey}
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.yLabel
                  ? {
                      value: config.yLabel,
                      angle: -90,
                      position: "insideLeft",
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: tooltipBgColor,
                borderColor: tooltipBorderColor,
              }}
            />
            {series.map((s) => {
              const isHidden = hiddenSeries.has(s.name);
              return (
                <Scatter
                  key={s.name}
                  name={s.name}
                  data={s.data.map((point) => ({
                    [xKey]: point[xKey],
                    [yKey]: point[yKey],
                  }))}
                  fill={isHidden ? "transparent" : s.color}
                  stroke={isHidden ? "transparent" : s.color}
                />
              );
            })}
          </ScatterChart>
        );
      }

      return (
        <ScatterChart margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey={config.x}
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.xLabel
                ? {
                    value: config.xLabel,
                    position: "bottom",
                    offset: 0,
                    fill: textColor,
                  }
                : undefined
            }
          />
          <YAxis
            dataKey={config.y}
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.yLabel
                ? {
                    value: config.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: textColor,
                  }
                : undefined
            }
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: tooltipBgColor,
              borderColor: tooltipBorderColor,
            }}
          />
          {series.map((s) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.data}
              fill={s.color}
              stroke={s.color}
            />
          ))}
        </ScatterChart>
      );
    })();

    const barContent = (() => {
      if (hasMultipleSeries) {
        const mergedData = new Map<string, ChartDataPoint>();
        series.forEach((s) => {
          s.data.forEach((point) => {
            const xValue = String(point[config.x]);
            if (!mergedData.has(xValue)) {
              mergedData.set(xValue, { [config.x]: point[config.x] });
            }
            const existingPoint = mergedData.get(xValue)!;
            existingPoint[s.name] = point[config.y || "count"];
          });
        });

        const chartData = Array.from(mergedData.values());

        return (
          <BarChart data={chartData} margin={commonMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={config.x}
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.xLabel
                  ? {
                      value: config.xLabel,
                      position: "bottom",
                      offset: 0,
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <YAxis
              tick={{ fill: textColor }}
              stroke={textColor}
              label={
                config.yLabel
                  ? {
                      value: config.yLabel,
                      angle: -90,
                      position: "insideLeft",
                      fill: textColor,
                    }
                  : undefined
              }
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: tooltipBgColor,
                borderColor: tooltipBorderColor,
              }}
            />
            {series.map((s) => {
              const isHidden = hiddenSeries.has(s.name);
              return (
                <Bar
                  key={s.name}
                  dataKey={s.name}
                  name={s.name}
                  fill={isHidden ? "transparent" : s.color}
                />
              );
            })}
          </BarChart>
        );
      }

      return (
        <BarChart data={series[0]?.data || []} margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey={config.x}
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.xLabel
                ? {
                    value: config.xLabel,
                    position: "bottom",
                    offset: 0,
                    fill: textColor,
                  }
                : undefined
            }
          />
          <YAxis
            tick={{ fill: textColor }}
            stroke={textColor}
            label={
              config.yLabel
                ? {
                    value: config.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    fill: textColor,
                  }
                : undefined
            }
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: tooltipBgColor,
              borderColor: tooltipBorderColor,
            }}
          />
          <Bar
            dataKey={config.y || "count"}
            name={series[0]?.name || config.y || "count"}
            fill={series[0]?.color || config.color}
          >
            {series[0]?.data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={series[0]?.color || config.color}
              />
            ))}
          </Bar>
        </BarChart>
      );
    })();

    const histogramContent = (
      <BarChart data={series[0]?.data || []} margin={commonMargin}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey={config.x}
          name={config.x}
          tick={{ fill: textColor }}
          stroke={textColor}
          label={
            config.xLabel
              ? {
                  value: config.xLabel,
                  position: "bottom",
                  offset: 0,
                  fill: textColor,
                }
              : {
                  value: config.x,
                  position: "bottom",
                  offset: 0,
                  fill: textColor,
                }
          }
        />
        <YAxis
          tick={{ fill: textColor }}
          stroke={textColor}
          label={
            config.yLabel
              ? {
                  value: config.yLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: textColor,
                }
              : {
                  value: "Count",
                  angle: -90,
                  position: "insideLeft",
                  fill: textColor,
                }
          }
        />
        <RechartsTooltip
          contentStyle={{
            backgroundColor: tooltipBgColor,
            borderColor: tooltipBorderColor,
          }}
        />
        <Bar dataKey="count" name="Count" fill={config.color}>
          {series[0]?.data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={config.color} />
          ))}
        </Bar>
      </BarChart>
    );

    const wordcloudContent = (() => {
      const wordColors = [
        "#8884d8",
        "#82ca9d",
        "#ffc658",
        "#ff7300",
        "#0088fe",
        "#00C49F",
        "#FFBB28",
        "#FF8042",
        "#313695",
        "#4575b4",
        "#74add1",
        "#abd9e9",
        "#e0f3f8",
        "#fee090",
        "#fdae61",
        "#f46d43",
        "#d73027",
        "#a50026",
      ];

      const wordData = (series[0]?.data || []).filter(
        (d) => !hiddenSeries.has(String(d.text)),
      );

      if (wordData.length === 0) {
        return <div>{t.noData}</div>;
      }

      const maxValue = Math.max(...wordData.map((d) => Number(d.value) || 1));
      const minFontSize = 12;
      const maxFontSize = 72;

      const getRandomAngle = () => {
        const angles = [0, 0, 0, 90, -90];
        return angles[Math.floor(Math.random() * angles.length)];
      };

      const layoutWords = () => {
        const placedWords: Array<{
          text: string;
          x: number;
          y: number;
          fontSize: number;
          color: string;
          angle: number;
        }> = [];

        const containerWidth = Number(chartWidth) - 40;
        const containerHeight = Number(chartHeight) - 40;

        wordData.forEach((d, i) => {
          const value = Number(d.value) || 1;
          const normalizedSize = value / maxValue;
          const fontSize =
            minFontSize + normalizedSize * (maxFontSize - minFontSize);
          const color = wordColors[i % wordColors.length];
          const angle = getRandomAngle();

          let x: number;
          let y: number;
          let attempts = 0;
          const maxAttempts = 50;

          do {
            x = 20 + Math.random() * (containerWidth - 100);
            y = 20 + Math.random() * (containerHeight - 30);
            attempts++;
          } while (
            attempts < maxAttempts &&
            placedWords.some(
              (placed) =>
                Math.abs(placed.x - x) < 60 &&
                Math.abs(placed.y - y) < fontSize,
            )
          );

          placedWords.push({
            text: String(d.text),
            x,
            y,
            fontSize,
            color,
            angle,
          });
        });

        return placedWords;
      };

      const words = layoutWords();

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg width="100%" height="100%">
            {words.map((word, i) => (
              <text
                key={`word-${i}`}
                x={word.x}
                y={word.y}
                fill={word.color}
                fontSize={word.fontSize}
                fontWeight={word.fontSize > 30 ? "bold" : "normal"}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${word.angle}, ${word.x}, ${word.y})`}
                style={{ cursor: "pointer", userSelect: "none" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.7";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                {word.text}
              </text>
            ))}
          </svg>
        </div>
      );
    })();

    const heatmapContent = (() => {
      const heatData = series[0]?.data || [];

      if (heatData.length === 0) {
        return <div>{t.noData}</div>;
      }

      const yCol = config.y || "count";
      const xValues = Array.from(
        new Set(heatData.map((d) => String(d[config.x]))),
      );
      const yValues = Array.from(new Set(heatData.map((d) => String(d[yCol]))));
      const maxValue = Math.max(
        ...heatData.map((d) => Number(d.value) || 0),
        1,
      );

      const cellWidth = Math.min(
        80,
        (Number(chartWidth) - 100) / xValues.length,
      );
      const cellHeight = Math.min(
        40,
        (Number(chartHeight) - 100) / yValues.length,
      );

      const getHeatColor = (value: number) => {
        const ratio = value / maxValue;
        if (ratio < 0.25)
          return `rgb(${Math.round(59 + ratio * 4 * 76)}, ${Math.round(130 - ratio * 4 * 60)}, ${Math.round(246 - ratio * 4 * 100)})`;
        if (ratio < 0.5)
          return `rgb(${Math.round(135 + (ratio - 0.25) * 4 * 120)}, ${Math.round(70 + (ratio - 0.25) * 4 * 130)}, ${Math.round(146 - (ratio - 0.25) * 4 * 100)})`;
        if (ratio < 0.75)
          return `rgb(${Math.round(255 - (ratio - 0.5) * 4 * 40)}, ${Math.round(200 - (ratio - 0.5) * 4 * 80)}, ${Math.round(46 + (ratio - 0.5) * 4 * 100)})`;
        return `rgb(${Math.round(215 - (ratio - 0.75) * 4 * 80)}, ${Math.round(48 + (ratio - 0.75) * 4 * 30)}, ${Math.round(39)})`;
      };

      const handleMouseEnter = (
        e: React.MouseEvent,
        xVal: string,
        yVal: string,
        value: number,
      ) => {
        const target = e.currentTarget as HTMLElement;
        const rect = target.getBoundingClientRect();
        const panelRect = panelRef.current?.getBoundingClientRect();
        if (panelRef.current) {
          setHeatTooltip({
            visible: true,
            x: rect.left - (panelRect?.left || 0) + rect.width / 2,
            y: rect.bottom - (panelRect?.top || 0) + 10,
            xVal,
            yVal,
            value,
          });
        }
      };

      const handleMouseLeave = () => {
        setHeatTooltip((prev) => ({ ...prev, visible: false }));
      };

      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "auto",
            padding: "10px",
            position: "relative",
          }}
        >
          {heatTooltip.visible && (
            <div
              style={{
                position: "absolute",
                left: heatTooltip.x,
                top: heatTooltip.y,
                transform: "translate(-50%, -75%)",
                backgroundColor: tooltipBgColor,
                border: `1px solid ${tooltipBorderColor}`,
                borderRadius: "4px",
                padding: "6px 10px",
                fontSize: "12px",
                color: textColor,
                whiteSpace: "nowrap",
                zIndex: 100,
                pointerEvents: "none",
              }}
            >
              <div style={{ fontWeight: "bold" }}>
                {heatTooltip.xVal} vs {heatTooltip.yVal}
              </div>
              <div>
                {config.x}: {heatTooltip.xVal}
              </div>
              <div>
                {yCol}: {heatTooltip.yVal}
              </div>
              <div>Count: {heatTooltip.value}</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginRight: "8px",
                paddingTop: "30px",
              }}
            >
              {yValues.map((yVal) => (
                <div
                  key={yVal}
                  style={{
                    height: cellHeight,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: "4px",
                    fontSize: "10px",
                    color: textColor,
                  }}
                >
                  {yVal}
                </div>
              ))}
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  marginBottom: "4px",
                }}
              >
                {xValues.map((xVal) => (
                  <div
                    key={xVal}
                    style={{
                      width: cellWidth,
                      textAlign: "center",
                      fontSize: "10px",
                      color: textColor,
                      transform: "rotate(-45deg)",
                      transformOrigin: "center",
                      height: "30px",
                    }}
                  >
                    {xVal}
                  </div>
                ))}
              </div>
              {yValues.map((yVal) => (
                <div key={yVal} style={{ display: "flex" }}>
                  {xValues.map((xVal) => {
                    const cell = heatData.find(
                      (d) =>
                        String(d[config.x]) === xVal &&
                        String(d[yCol]) === yVal,
                    );
                    const value = cell ? Number(cell.value) || 0 : 0;
                    const color = getHeatColor(value);
                    const isHidden = hiddenSeries.has(`${xVal}|${yVal}`);

                    return (
                      <div
                        key={`${xVal}|${yVal}`}
                        style={{
                          width: cellWidth,
                          height: cellHeight,
                          backgroundColor: isHidden ? "#e5e7eb" : color,
                          border: "1px solid #fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "9px",
                          color: value / maxValue > 0.5 ? "#fff" : "#000",
                          cursor: "pointer",
                          opacity: isHidden ? 0.3 : 1,
                        }}
                        onMouseEnter={(e) =>
                          handleMouseEnter(e, xVal, yVal, value)
                        }
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleLegendClick(`${xVal}|${yVal}`)}
                      >
                        {value > 0 ? value.toFixed(1) : ""}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    })();

    const pieContent = (() => {
      const pieColors = [
        "#8884d8",
        "#82ca9d",
        "#ffc658",
        "#ff7300",
        "#0088fe",
        "#00C49F",
        "#FFBB28",
        "#FF8042",
      ];

      if (hasMultipleSeries) {
        return (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
              justifyContent: "center",
              padding: "16px",
              width: "100%",
              height: "100%",
            }}
          >
            {series.map((s, seriesIndex) => {
              if (hiddenSeries.has(s.name)) return null;
              const pieData = s.data.map((d) => ({
                name: String(d[config.x]),
                value: Number(d[config.y || "count"]) || 1,
              }));
              const pieColor =
                s.color || pieColors[seriesIndex % pieColors.length];

              return (
                <div
                  key={s.name}
                  style={{
                    flex: "1 1 auto",
                    minWidth: "200px",
                    maxWidth: "300px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    border: `1px solid ${gridColor}`,
                    borderRadius: "8px",
                    padding: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      marginBottom: "8px",
                      color: textColor,
                    }}
                  >
                    {s.name}
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill={pieColor}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {pieData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={pieColors[index % pieColors.length]}
                          />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: tooltipBgColor,
                          borderColor: tooltipBorderColor,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        );
      }

      const pieData = (series[0]?.data || []).map((d) => ({
        name: String(d[config.x]),
        value: Number(d[config.y || "count"]) || 1,
      }));

      const aggregatedPieData = Array.from(
        pieData.reduce((map, item) => {
          const existing = map.get(item.name);
          if (existing) {
            existing.value += item.value;
          } else {
            map.set(item.name, { ...item });
          }
          return map;
        }, new Map<string, { name: string; value: number }>()),
      ).map(([, v]) => v);

      const visiblePieData = aggregatedPieData.filter(
        (d) => !hiddenSeries.has(d.name),
      );

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "8px",
              padding: "8px",
            }}
          >
            {aggregatedPieData.map((d, idx) => {
              const isHidden = hiddenSeries.has(d.name);
              return (
                <button
                  key={d.name}
                  onClick={() => handleLegendClick(d.name)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                  style={{
                    cursor: "pointer",
                    opacity: isHidden ? 0.5 : 1,
                    border: "none",
                    background: "transparent",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      backgroundColor: isHidden
                        ? "#9ca3af"
                        : pieColors[idx % pieColors.length],
                    }}
                  />
                  <span style={{ color: isHidden ? "#9ca3af" : textColor }}>
                    {d.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {visiblePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={visiblePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={
                      Math.min(Number(chartWidth), Number(chartHeight)) * 0.35
                    }
                    fill={config.color || "#8884d8"}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {visiblePieData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={pieColors[index % pieColors.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: tooltipBgColor,
                      borderColor: tooltipBorderColor,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: textColor,
                }}
              >
                {t.noData}
              </div>
            )}
          </div>
        </div>
      );
    })();

    let content: React.ReactNode;
    switch (config.chartType) {
      case "line":
        content = lineContent;
        break;
      case "scatter":
        content = scatterContent;
        break;
      case "bar":
        content = barContent;
        break;
      case "histogram":
        content = histogramContent;
        break;
      case "pie":
        content = pieContent;
        break;
      case "wordcloud":
        content = wordcloudContent;
        break;
      case "heatmap":
        content = heatmapContent;
        break;
      default:
        return <div>{t.noData}</div>;
    }

    return (
      <ResponsiveContainer width={chartWidth} height={chartHeight}>
        {content}
      </ResponsiveContainer>
    );
  };

  return (
    <div
      ref={panelRef}
      style={
        isMaximized
          ? {
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
            }
          : {
              left: 50,
              top: 100,
              width: `${(config.width || 600) + 40}px`,
              height: `${(config.height || 400) + 100}px`,
            }
      }
      className={`fixed flex flex-col bg-background border border-border/50 rounded-lg shadow-xl z-40 ${isDraggingRef ? "shadow-2xl" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/80 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">
            {config.title || `${t.chart}: ${config.chartType}`}
          </h3>
          {config.category && (
            <span className="text-xs text-muted-foreground">
              ({t.category}: {config.category})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content={t.download}>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleExport}
              className="px-2 font-medium"
            >
              <Download className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content={isMaximized ? t.restore : t.maximize}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsMaximized(!isMaximized)}
              className="px-2 font-medium"
            >
              {isMaximized ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </Tooltip>
          <Tooltip content={t.close}>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClose}
              className="px-2 font-medium"
            >
              <X className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
      {hasMultipleSeries && (
        <div
          className="flex justify-end gap-2 px-4 py-2 flex-wrap"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {series.map((s) => {
            const isHidden = hiddenSeries.has(s.name);
            return (
              <button
                key={s.name}
                onClick={() => handleLegendClick(s.name)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{
                  cursor: "pointer",
                  opacity: isHidden ? 0.5 : 1,
                  border: "none",
                  background: "transparent",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: isHidden ? "#9ca3af" : s.color,
                  }}
                />
                <span style={{ color: isHidden ? "#9ca3af" : textColor }}>
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div ref={chartContainerRef} className="flex-1 min-h-0 p-4">
        {renderChart()}
      </div>
    </div>
  );
});
