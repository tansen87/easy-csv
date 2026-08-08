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
