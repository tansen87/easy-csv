import {
  X,
  Maximize2,
  Minimize2,
  Download,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Copy,
  Check,
} from "lucide-react";
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  ChartDataPoint,
  ChartSeries,
  ChartType,
  PanelDockState,
} from "@/types/xan";
import type { TabChartState } from "@/types/execution";
import { useLanguage } from "@/i18n";
import type { Translations } from "@/i18n/translations/types";
import { useTheme } from "@/components/setting/ThemeProvider";
import { clampPanelPosition } from "@/utils/panelDock";
import { formatNumber } from "@/utils/format";
import {
  defaultSortFor,
  type ChartSort,
} from "@/hooks/charts/processChartData";
import {
  ChartLegend,
  ChartTooltip,
  CategoryFilter,
  type LegendEntry,
  type TooltipRow,
} from "@/modules/data-preview/charts/ChartPrimitives";
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

/** Category colours resolved by index so hiding a series keeps others stable. */
const CATEGORY_COLORS = [
  "#4f46e5",
  "#0d9488",
  "#d97706",
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#15803d",
  "#be185d",
];

/** Heatmap ramp (low → high) used by both the cells and the scale legend. */
const HEAT_RAMP = ["#93c5fd", "#3b82f6", "#a78bfa", "#fbbf24", "#dc2626"];

const heatColor = (ratio: number): string => {
  const clamped = Math.max(0, Math.min(1, ratio));
  const scaled = clamped * (HEAT_RAMP.length - 1);
  const index = Math.min(Math.floor(scaled), HEAT_RAMP.length - 2);
  const local = scaled - index;
  const from = HEAT_RAMP[index];
  const to = HEAT_RAMP[index + 1];
  const mix = (hex: string, other: string, t: number) => {
    const a = parseInt(hex.slice(1), 16);
    const b = parseInt(other.slice(1), 16);
    const ch = (shift: number) =>
      Math.round(
        ((a >> shift) & 255) +
          (((b >> shift) & 255) - ((a >> shift) & 255)) * t,
      );
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
  };
  return mix(from, to, local);
};

/** Shared empty array so `heatData` keeps a stable reference between renders. */
const EMPTY_HEAT_DATA: ChartDataPoint[] = [];

/** Gap between the hovered cell and the heat tooltip. */
const HEAT_TOOLTIP_GAP = 12;
/** Rough single-row `ChartTooltip` height used for the bottom-edge flip. */
const HEAT_TOOLTIP_EST_HEIGHT = 72;

interface HeatmapCellsProps {
  xValues: string[];
  yValues: string[];
  cellMap: Map<string, number>;
  maxValue: number;
  cellWidth: number;
  cellHeight: number;
  showCellValue: boolean;
  hiddenSeries: Set<string>;
  textColor: string;
  onCellEnter: (
    e: React.MouseEvent,
    xVal: string,
    yVal: string,
    value: number,
  ) => void;
  onCellLeave: () => void;
  onCellClick: (name: string) => void;
}

/**
 * The heat grid proper. Memoised so hover-driven tooltip updates (owned by
 * `HeatmapView`) never re-render the cell matrix — with hundreds of cells
 * that full re-render was what made the tooltip feel sluggish.
 */
const HeatmapCells = React.memo(function HeatmapCells({
  xValues,
  yValues,
  cellMap,
  maxValue,
  cellWidth,
  cellHeight,
  showCellValue,
  hiddenSeries,
  textColor,
  onCellEnter,
  onCellLeave,
  onCellClick,
}: HeatmapCellsProps) {
  return (
    <div style={{ width: "max-content", padding: "4px 10px 10px" }}>
      <div style={{ display: "flex" }}>
        <div
          style={{
            width: 56,
            flex: "none",
          }}
        />
        <div
          style={{
            display: "flex",
            height: 34,
            marginBottom: 2,
          }}
        >
          {xValues.map((xVal) => (
            <div
              key={xVal}
              style={{
                width: cellWidth,
                fontSize: 10,
                color: textColor,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                overflow: "hidden",
                whiteSpace: "nowrap",
                transform: "rotate(-45deg)",
                transformOrigin: "center",
              }}
            >
              {xVal}
            </div>
          ))}
        </div>
      </div>
      {yValues.map((yVal) => (
        <div key={yVal} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 56,
              flex: "none",
              fontSize: 10,
              color: textColor,
              textAlign: "right",
              paddingRight: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={yVal}
          >
            {yVal}
          </div>
          {xValues.map((xVal) => {
            // O(1) map lookup instead of a linear scan per cell.
            const value = cellMap.get(`${xVal}|${yVal}`) ?? 0;
            const ratio = maxValue > 0 ? value / maxValue : 0;
            const isHidden = hiddenSeries.has(`${xVal}|${yVal}`);

            return (
              <div
                key={`${xVal}|${yVal}`}
                style={{
                  width: cellWidth,
                  height: cellHeight,
                  backgroundColor: isHidden
                    ? "transparent"
                    : heatColor(ratio),
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9.5,
                  color: ratio > 0.55 ? "#fff" : "#1f2937",
                  cursor: "pointer",
                  opacity: isHidden ? 0.25 : 1,
                }}
                onMouseEnter={(e) => onCellEnter(e, xVal, yVal, value)}
                onMouseLeave={onCellLeave}
                onClick={() => onCellClick(`${xVal}|${yVal}`)}
              >
                {/* Integers used to render as `12.0` via a fixed toFixed(1). */}
                {showCellValue && value > 0
                  ? formatNumber(value, "integer")
                  : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

interface HeatmapViewProps {
  heatData: ChartDataPoint[];
  xKey: string;
  yKey: string;
  chartWidth: number;
  chartHeight: number;
  hiddenSeries: Set<string>;
  textColor: string;
  countLabel: string;
  onCellClick: (name: string) => void;
}

/**
 * Owns the hover tooltip so entering a cell no longer re-renders the whole
 * `ChartPanel` (every content IIFE and recharts chart) per mouse move — the
 * main source of the tooltip lag. The grid lives in a memoised child.
 */
function HeatmapView({
  heatData,
  xKey,
  yKey,
  chartWidth,
  chartHeight,
  hiddenSeries,
  textColor,
  countLabel,
  onCellClick,
}: HeatmapViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [heatTooltip, setHeatTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    /** Shown above the cell (bottom flip) instead of below it. */
    above: boolean;
    xVal: string;
    yVal: string;
    value: number;
    share: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    above: false,
    xVal: "",
    yVal: "",
    value: 0,
    share: 0,
  });

  const xValues = useMemo(
    () => Array.from(new Set(heatData.map((d) => String(d[xKey])))),
    [heatData, xKey],
  );
  const yValues = useMemo(
    () => Array.from(new Set(heatData.map((d) => String(d[yKey])))),
    [heatData, yKey],
  );
  const maxValue = useMemo(
    () => Math.max(...heatData.map((d) => Number(d.value) || 0), 1),
    [heatData],
  );
  const total = useMemo(
    () => heatData.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
    [heatData],
  );
  /** Keyed "x|y" → value lookup for the cell matrix, built once per data. */
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of heatData) {
      map.set(`${String(d[xKey])}|${String(d[yKey])}`, Number(d.value) || 0);
    }
    return map;
  }, [heatData, xKey, yKey]);

  const cellWidth = Math.min(
    80,
    Math.max(28, (Number(chartWidth) - 100) / Math.max(xValues.length, 1)),
  );
  const cellHeight = Math.min(
    40,
    Math.max(20, (Number(chartHeight) - 120) / Math.max(yValues.length, 1)),
  );

  const showCellValue = cellWidth >= 34 && cellHeight >= 22;

  const handleCellEnter = useCallback(
    (e: React.MouseEvent, xVal: string, yVal: string, value: number) => {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const wrapRect = wrapRef.current?.getBoundingClientRect();
      if (!wrapRect) return;
      // Sit just below the hovered cell so the tooltip never covers the
      // cursor (it used to be centred on the cell, blocking the mouse);
      // flip above when there is no room left below the cell.
      const y = rect.top - wrapRect.top;
      const below = rect.bottom - wrapRect.top + HEAT_TOOLTIP_GAP;
      const above = below + HEAT_TOOLTIP_EST_HEIGHT > wrapRect.height;
      setHeatTooltip({
        visible: true,
        x: rect.left - wrapRect.left + rect.width / 2,
        y: above ? y - HEAT_TOOLTIP_GAP : below,
        above,
        xVal,
        yVal,
        value,
        share: total > 0 ? value / total : 0,
      });
    },
    [total],
  );

  const handleCellLeave = useCallback(() => {
    setHeatTooltip((prev) =>
      prev.visible ? { ...prev, visible: false } : prev,
    );
  }, []);

  if (heatData.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", height: "100%", position: "relative" }}
    >
      {heatTooltip.visible && (
        <div
          style={{
            position: "absolute",
            left: heatTooltip.x,
            top: heatTooltip.y,
            transform: heatTooltip.above
              ? "translate(-50%, -100%)"
              : "translate(-50%, 0)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          <ChartTooltip
            title={`${heatTooltip.xVal} x ${heatTooltip.yVal}`}
            rows={[
              {
                name: countLabel,
                value: heatTooltip.value,
                display: formatNumber(heatTooltip.value, "integer"),
                share: heatTooltip.share,
              },
            ]}
          />
        </div>
      )}
      <ScrollArea className="h-full w-full">
        <HeatmapCells
          xValues={xValues}
          yValues={yValues}
          cellMap={cellMap}
          maxValue={maxValue}
          cellWidth={cellWidth}
          cellHeight={cellHeight}
          showCellValue={showCellValue}
          hiddenSeries={hiddenSeries}
          textColor={textColor}
          onCellEnter={handleCellEnter}
          onCellLeave={handleCellLeave}
          onCellClick={onCellClick}
        />
      </ScrollArea>
    </div>
  );
}

/** i18n key holding the user-facing name of a chart type. */
const CHART_TYPE_KEYS: Record<ChartType, keyof Translations> = {
  line: "chartTypeLine",
  scatter: "chartTypeScatter",
  bar: "chartTypeBar",
  histogram: "chartTypeHistogram",
  pie: "chartTypePie",
  wordcloud: "chartTypeWordcloud",
  heatmap: "chartTypeHeatmap",
};

interface ChartPanelProps {
  config: {
    chartType: ChartType;
    x: string;
    y?: string;
    category?: string;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    bins?: number;
    color?: string;
    width?: number;
    height?: number;
  } | null;
  series: ChartSeries[];
  isVisible: boolean;
  onClose: () => void;
  /** Persisted docking state. */
  dockState?: PanelDockState;
  /** Report position/collapse changes for persistence. */
  onDockChange?: (patch: Partial<PanelDockState>) => void;
  /** Top-right stack offset for the collapsed capsule. */
  capsuleY?: number;
  /** Diagnostics from the chart branch: rows, drop count, issue, truncation. */
  chartState?: TabChartState | null;
}

export const ChartPanel = React.memo(function ChartPanel({
  config,
  series,
  isVisible,
  onClose,
  dockState,
  onDockChange,
  capsuleY,
  chartState,
}: ChartPanelProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(
    dockState?.collapsed ?? false,
  );
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 50, y: 100 });
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<ChartSort | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const [copied, setCopied] = useState(false);
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
    setSort(null);
  }, [series]);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const textColor = isDark ? "#e5e7eb" : "#374151";
  const gridColor = isDark ? "#374151" : "#e5e7eb";

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

  /** Bulk show/hide from the category filter dropdown. */
  const handleSetHidden = useCallback(
    (hidden: boolean) => {
      setHiddenSeries(hidden ? new Set(series.map((s) => s.name)) : new Set());
    },
    [series],
  );

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
      // Exports land in documents and slides, so they always use the light
      // "document" palette. Copying on-screen colours produced near-white text
      // on a white background when the app ran in dark mode.
      clonedSvg.querySelectorAll("text").forEach((node) => {
        node.setAttribute("fill", "#1f2937");
      });
      clonedSvg.querySelectorAll("line").forEach((node) => {
        node.setAttribute("stroke", "#d8d8d8");
      });

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
        defaultPath: `chart-${config?.chartType ?? "chart"}-${config?.x ?? ""}.svg`,
      });

      if (filePath) {
        await writeFile(filePath, svgBytes);
      }
    } catch (error) {
      console.error("Failed to export chart:", error);
    }
  }, [config]);

  const handleCopyTable = useCallback(async () => {
    const rows = chartState?.rows ?? [];
    const headers = chartState?.headers ?? [];
    if (headers.length === 0) return;
    const escape = (cell: string) =>
      /[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
    const csv = [
      headers.map(escape).join(","),
      ...rows.map((row) => row.map((cell) => escape(cell ?? "")).join(",")),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy chart data:", error);
    }
  }, [chartState]);

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
        if (panelRef.current) {
          const rect = panelRef.current.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.top });
          onDockChange?.({ x: rect.left, y: rect.top });
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
    [isMaximized, onDockChange],
  );

  useEffect(() => {
    if (isVisible && panelRef.current && !isMaximized) {
      const panelWidth = panelRef.current.offsetWidth || 640;
      const panelHeight = panelRef.current.offsetHeight || 500;
      // Persisted position wins; otherwise center in the viewport.
      const clamped = clampPanelPosition(dockState, {
        width: panelWidth,
        height: panelHeight,
      });
      setPos({ x: clamped.x, y: clamped.y });
    }
  }, [isVisible, isMaximized, dockState?.x, dockState?.y]);

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

  // collapsed capsule (edge pill) with one-click restore.
  if (collapsed && !isMaximized) {
    return (
      <div
        className="fixed z-floating flex items-center gap-1.5 px-3 py-2 bg-background border border-border/50 rounded-full shadow-xl cursor-pointer select-none"
        style={{ top: capsuleY ?? 56, right: 8 }}
        role="button"
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          setCollapsed(false);
          onDockChange?.({ collapsed: false });
        }}
      >
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium max-w-[160px] truncate">
          {config.title ||
            `${t.chart}: ${t[CHART_TYPE_KEYS[config.chartType]]}`}
        </span>
        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    );
  }

  const issue = chartState?.issue;
  const effectiveSort = sort ?? defaultSortFor(config.chartType);

  /** Series actually drawn: hidden ones are removed, not made transparent. */
  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.name));

  const valueKey = config.y || "count";

  /** Order the category axis without touching x-ordered charts. */
  const orderedSeries = visibleSeries.map((s) => {
    if (
      effectiveSort === "none" ||
      config.chartType === "line" ||
      config.chartType === "scatter"
    ) {
      return s;
    }
    const ordered = [...s.data].sort((a, b) => {
      const av = Number(a.value ?? a[valueKey] ?? a[config.y || ""] ?? 0);
      const bv = Number(b.value ?? b[valueKey] ?? b[config.y || ""] ?? 0);
      return effectiveSort === "desc" ? bv - av : av - bv;
    });
    return { ...s, data: ordered };
  });

  /** Total per series, used for the tooltip share column. */
  const seriesTotal = (s: ChartSeries) =>
    s.data.reduce((acc, point) => {
      const v = Number(
        point.value ?? point[valueKey] ?? point[config.y || ""] ?? 0,
      );
      return acc + (Number.isFinite(v) ? v : 0);
    }, 0);

  /**
   * recharts calls a function `content` with the **whole tooltip props object**
   * (`{active, payload, label, …}`), not with `(payload, label)` positionally.
   * Reading them positionally handed `payload` the props object, so
   * `payload.map` threw `payload.map is not a function` and took the whole
   * chart down with it.
   */
  const makeTooltip =
    (colorBySeriesIndex: (i: number) => string) =>
    (props: {
      active?: boolean;
      payload?: readonly {
        name?: string;
        value?: unknown;
        color?: string;
        dataKey?: string | number;
      }[];
      label?: unknown;
    }) => {
      const payload = props?.payload;
      if (!props?.active || !Array.isArray(payload) || payload.length === 0) {
        return null;
      }
      const rows: TooltipRow[] = payload.map((entry, i) => {
        const raw = Number(entry.value);
        const value = Number.isFinite(raw) ? raw : null;
        const total = seriesTotal(visibleSeries[i] ?? visibleSeries[0]);
        return {
          name: String(entry.name ?? entry.dataKey ?? ""),
          value,
          color: entry.color || colorBySeriesIndex(i),
          share:
            entry.dataKey === config.x || total <= 0 || value === null
              ? undefined
              : value / total,
        };
      });
      return <ChartTooltip title={String(props.label ?? "")} rows={rows} />;
    };

  const defaultTooltip = makeTooltip(
    (i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  );

  const axisTick = { fill: textColor, fontSize: 11 } as const;

  /**
   * Rough text width: CJK chars are full-width, latin ≈ 0.56em. Same model as
   * the word-cloud layout, so the two agree about how wide a label is.
   */
  const estimateTextWidth = (text: string, fontSize: number) => {
    let units = 0;
    for (const ch of text) {
      units += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 1 : 0.56;
    }
    return units * fontSize;
  };

  /** Long labels or many categories overlap when left horizontal (§4.5). */
  const needsAngledTicks = (labels: string[]) => {
    const longest = labels.reduce(
      (max: number, v) => Math.max(max, estimateTextWidth(v, 11)),
      0,
    );
    return labels.length > 6 || longest > 42;
  };

  /**
   * Height for the x-axis band.
   *
   * The SVG clips (`overflow: hidden`), so the band must be tall enough for the
   * *rotated* labels: an angled label slants down from its tick by
   * `width · sin(30°)`, and a fixed 56px silently cut long labels (histogram
   * bins are ~97px wide → only a sliver was visible). The axis title is
   * rendered as HTML below the chart instead, so it needs its own room here.
   */
  const xAxisHeight = (labels: string[], angled: boolean) => {
    const longestPx = labels.reduce(
      (max: number, v) => Math.max(max, estimateTextWidth(v, 11)),
      0,
    );
    const tickRoom = angled
      ? Math.ceil(longestPx * Math.SQRT1_2) + 11 + 8
      : 22;
    return Math.min(140, Math.max(angled ? 60 : 30, Math.ceil(tickRoom + 18)));
  };

  const categoryAxis = (data: ChartDataPoint[], key: string) => {
    const labels = data.map((d) => String(d[key] ?? ""));
    const angled = needsAngledTicks(labels);
    return (
      <XAxis
        dataKey={key}
        tick={axisTick}
        stroke={textColor}
        interval="preserveStartEnd"
        angle={angled ? -30 : 0}
        textAnchor={angled ? "end" : "middle"}
        height={xAxisHeight(labels, angled)}
      />
    );
  };

  /** Y axis labels the plotted column even when the user typed no label. */
  const valueAxis = (label?: string) => (
    <YAxis
      tick={axisTick}
      stroke={textColor}
      width={64}
      tickFormatter={(v) => formatNumber(Number(v), "compact")}
      label={
        label
          ? {
              value: label,
              angle: -90,
              position: "insideLeft",
              fill: textColor,
              fontSize: 11,
            }
          : undefined
      }
    />
  );

  const yAxisLabel = config.yLabel || config.y || undefined;
  const xAxisLabel = config.xLabel || config.x;
  /** Only the cartesian charts have an x axis to title. */
  const hasAxes = ["line", "scatter", "bar", "histogram"].includes(
    config.chartType,
  );

  const chartMargin = { top: 12, right: 24, left: 8, bottom: 4 };

  const renderChart = () => {
    /**
     * Always positive numbers.
     *
     * recharts' `validateWidthHeight` returns null (rendering *nothing at all*)
     * unless both are numbers > 0, so a `"100%"` fallback silently produces a
     * blank chart. In maximized mode the ResizeObserver measurement can still be
     * 0 on the first paint, hence the config fallback.
     */
    /**
     * The plot is sized by `ResponsiveContainer width/height="100%"`, so these
     * are the *measured* container size (falling back to the config for the
     * first paint). Config width/height remain the panel's size hint.
     */
    const chartWidth = containerSize.width || config.width || 600;
    const chartHeight = containerSize.height || config.height || 400;

    const lineContent = (() => {
      if (visibleSeries.length > 1) {
        const mergedData = new Map<string, ChartDataPoint>();
        visibleSeries.forEach((s) => {
          s.data.forEach((point) => {
            const xValue = String(point[config.x]);
            if (!mergedData.has(xValue)) {
              mergedData.set(xValue, { [config.x]: point[config.x] });
            }
            const existingPoint = mergedData.get(xValue)!;
            existingPoint[s.name] = point[config.y || config.x] as number;
          });
        });
        const chartData = Array.from(mergedData.values());

        return (
          <LineChart data={chartData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            {categoryAxis(chartData, config.x)}
            {valueAxis(yAxisLabel)}
            <RechartsTooltip
              content={defaultTooltip as never}
              contentStyle={{
                backgroundColor: "transparent",
                border: "none",
                padding: 0,
              }}
            />
            {visibleSeries.map((s) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                name={s.name}
                stroke={s.color}
                dot={{ fill: s.color }}
                activeDot={{ r: 6 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        );
      }

      const only = orderedSeries[0];
      return (
        <LineChart data={only?.data || []} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {categoryAxis(only?.data || [], config.x)}
          {valueAxis(yAxisLabel)}
          <RechartsTooltip
            content={defaultTooltip as never}
            contentStyle={{
              backgroundColor: "transparent",
              border: "none",
              padding: 0,
            }}
          />
          <Line
            type="monotone"
            dataKey={config.y || config.x}
            name={only?.name || config.y || config.x}
            stroke={only?.color || config.color}
            dot={{ fill: only?.color || config.color }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      );
    })();

    const scatterContent = (() => {
      const xKey = config.x;
      const yKey = config.y || config.x;

      return (
        <ScatterChart margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {categoryAxis(visibleSeries[0]?.data || [], xKey)}
          {valueAxis(yAxisLabel)}
          <RechartsTooltip
            content={defaultTooltip as never}
            contentStyle={{
              backgroundColor: "transparent",
              border: "none",
              padding: 0,
            }}
          />
          {visibleSeries.map((s) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={
                visibleSeries.length > 1
                  ? s.data.map((point) => ({
                      [xKey]: point[xKey],
                      [yKey]: point[yKey],
                    }))
                  : s.data
              }
              fill={s.color}
              stroke={s.color}
            />
          ))}
        </ScatterChart>
      );
    })();

    const barContent = (() => {
      if (visibleSeries.length > 1) {
        const mergedData = new Map<string, ChartDataPoint>();
        visibleSeries.forEach((s) => {
          s.data.forEach((point) => {
            const xValue = String(point[config.x]);
            if (!mergedData.has(xValue)) {
              mergedData.set(xValue, { [config.x]: point[config.x] });
            }
            const existingPoint = mergedData.get(xValue)!;
            existingPoint[s.name] = point[config.y || "count"] as number;
          });
        });
        const chartData = Array.from(mergedData.values());

        return (
          <BarChart data={chartData} margin={chartMargin}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            {categoryAxis(chartData, config.x)}
            {valueAxis(yAxisLabel)}
            <RechartsTooltip
              content={defaultTooltip as never}
              contentStyle={{
                backgroundColor: "transparent",
                border: "none",
                padding: 0,
              }}
            />
            {visibleSeries.map((s) => (
              <Bar key={s.name} dataKey={s.name} name={s.name} fill={s.color} />
            ))}
          </BarChart>
        );
      }

      const only = orderedSeries[0];
      return (
        <BarChart data={only?.data || []} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          {categoryAxis(only?.data || [], config.x)}
          {valueAxis(yAxisLabel)}
          <RechartsTooltip
            content={defaultTooltip as never}
            contentStyle={{
              backgroundColor: "transparent",
              border: "none",
              padding: 0,
            }}
          />
          <Bar
            dataKey={valueKey}
            name={only?.name || valueKey}
            fill={only?.color || config.color}
          >
            {only?.data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={only?.color || config.color} />
            ))}
          </Bar>
        </BarChart>
      );
    })();

    const histogramContent = (
      <BarChart data={orderedSeries[0]?.data || []} margin={chartMargin}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="range"
          tick={axisTick}
          stroke={textColor}
          interval="preserveStartEnd"
          angle={-30}
          textAnchor="end"
          height={xAxisHeight(
            (orderedSeries[0]?.data || []).map((d) => String(d.range ?? "")),
            true,
          )}
        />
        <YAxis
          tick={axisTick}
          stroke={textColor}
          width={64}
          tickFormatter={(v) => formatNumber(Number(v), "compact")}
          label={{
            value: config.yLabel || t.chartHeatmapCount,
            angle: -90,
            position: "insideLeft",
            fill: textColor,
            fontSize: 11,
          }}
        />
        <RechartsTooltip
          content={defaultTooltip as never}
          contentStyle={{
            backgroundColor: "transparent",
            border: "none",
            padding: 0,
          }}
        />
        <Bar
          dataKey="count"
          name={t.chartHeatmapCount}
          fill={config.color || CATEGORY_COLORS[0]}
        />
      </BarChart>
    );

    /**
     * Deterministic word cloud.
     *
     * The previous version called `Math.random()` during render, so the layout
     * was recomputed — and reshuffled — on every theme change or legend click,
     * and its collision test gave up after 50 tries.
     */
    const wordcloudContent = (() => {
      const wordData = (orderedSeries[0]?.data || []).filter(
        (d) => !hiddenSeries.has(String(d.text)),
      );

      if (wordData.length === 0) return null;

      const maxValue = Math.max(...wordData.map((d) => Number(d.value) || 1));
      const minFontSize = 12;
      const maxFontSize = 72;

      const estimateWidth = (text: string, fontSize: number) => {
        let units = 0;
        for (const ch of text) {
          units += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)
            ? 1
            : 0.56;
        }
        return units * fontSize;
      };

      const width = Number(chartWidth) || 600;
      const height = Number(chartHeight) || 400;
      const cx = width / 2;
      const cy = height / 2;

      const placed: Array<{
        text: string;
        x: number;
        y: number;
        fontSize: number;
        color: string;
      }> = [];

      wordData.forEach((d, i) => {
        const value = Number(d.value) || 1;
        const fontSize =
          minFontSize + (value / maxValue) * (maxFontSize - minFontSize);
        const text = String(d.text);
        const boxW = estimateWidth(text, fontSize) + 8;
        const boxH = fontSize * 1.15 + 4;
        const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];

        // Archimedean spiral out from the centre: deterministic, so the same
        // data always yields the same picture.
        for (let step = 0; step < 2000; step++) {
          const angle = step * 0.45;
          const radius = 1.6 * step * 0.45;
          const left = cx + radius * Math.cos(angle) - boxW / 2;
          const top = cy + radius * Math.sin(angle) * 0.6 - boxH / 2;
          if (
            left < 2 ||
            top < 2 ||
            left + boxW > width - 2 ||
            top + boxH > height - 2
          ) {
            continue;
          }
          const collides = placed.some((p) => {
            const pw = estimateWidth(p.text, p.fontSize) + 8;
            const ph = p.fontSize * 1.15 + 4;
            return (
              left < p.x - pw / 2 + pw &&
              left + boxW > p.x - pw / 2 &&
              top < p.y - ph / 2 + ph &&
              top + boxH > p.y - ph / 2
            );
          });
          if (collides) continue;
          placed.push({
            text,
            x: left + boxW / 2,
            y: top + boxH / 2,
            fontSize,
            color,
          });
          break;
        }
      });

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
            {placed.map((word, i) => (
              <text
                key={`word-${i}`}
                x={word.x}
                y={word.y}
                fill={word.color}
                fontSize={word.fontSize}
                fontWeight={word.fontSize > 30 ? "bold" : "normal"}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                {word.text}
              </text>
            ))}
          </svg>
        </div>
      );
    })();

    const heatmapContent = (
      <HeatmapView
        heatData={orderedSeries[0]?.data || EMPTY_HEAT_DATA}
        xKey={config.x}
        yKey={config.y || "count"}
        chartWidth={Number(chartWidth) || 600}
        chartHeight={Number(chartHeight) || 400}
        hiddenSeries={hiddenSeries}
        textColor={textColor}
        countLabel={t.chartHeatmapCount}
        onCellClick={handleLegendClick}
      />
    );

    const pieContent = (() => {
      const only = orderedSeries[0];
      const pieData = (only?.data || []).map((d) => ({
        name: String(d[config.x]),
        value: Number(d[valueKey]) || 0,
      }));
      const total = pieData.reduce((acc, d) => acc + d.value, 0);

      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={
                Math.min(Number(chartWidth), Number(chartHeight)) * 0.35
              }
              label={({ name, percent }) =>
                `${String(name).slice(0, 12)}: ${((percent ?? 0) * 100).toFixed(0)}%`
              }
            >
              {pieData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              content={
                ((props: {
                  active?: boolean;
                  payload?: readonly { name?: string; value?: unknown }[];
                }) => {
                  const payload = props?.payload;
                  if (
                    !props?.active ||
                    !Array.isArray(payload) ||
                    payload.length === 0
                  ) {
                    return null;
                  }
                  const rows: TooltipRow[] = payload.map((entry, i) => {
                    const value = Number(entry.value);
                    return {
                      name: String(entry.name ?? ""),
                      value: Number.isFinite(value) ? value : null,
                      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      share:
                        total > 0 && Number.isFinite(value)
                          ? value / total
                          : undefined,
                    };
                  });
                  return <ChartTooltip title={config.x} rows={rows} />;
                }) as never
              }
              contentStyle={{
                backgroundColor: "transparent",
                border: "none",
                padding: 0,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    })();

    switch (config.chartType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height="100%">
            {lineContent}
          </ResponsiveContainer>
        );
      case "scatter":
        return (
          <ResponsiveContainer width="100%" height="100%">
            {scatterContent}
          </ResponsiveContainer>
        );
      case "bar":
        return (
          <ResponsiveContainer width="100%" height="100%">
            {barContent}
          </ResponsiveContainer>
        );
      case "histogram":
        return (
          <ResponsiveContainer width="100%" height="100%">
            {histogramContent}
          </ResponsiveContainer>
        );
      case "pie":
        return (
          <ResponsiveContainer width="100%" height="100%">
            {pieContent}
          </ResponsiveContainer>
        );
      case "wordcloud":
        return <div className="w-full h-full">{wordcloudContent}</div>;
      case "heatmap":
        return <div className="w-full h-full">{heatmapContent}</div>;
      default:
        return (
          <div className="text-sm text-muted-foreground p-4">{t.noData}</div>
        );
    }
  };

  /** Legend entries: one per series, including the single-series case. */
  const legendEntries: LegendEntry[] = (() => {
    if (config.chartType === "heatmap") {
      return [];
    }
    if (config.chartType === "wordcloud") {
      return [];
    }
    if (series.length === 1) {
      return [
        {
          name: series[0].name,
          color: series[0].color || CATEGORY_COLORS[0],
          role: t.chartLegendY,
        },
      ];
    }
    return series.map((s, i) => ({
      name: s.name,
      color: s.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      hidden: hiddenSeries.has(s.name),
    }));
  })();

  const heatScale =
    config.chartType === "heatmap"
      ? {
          from: HEAT_RAMP[0],
          to: HEAT_RAMP[HEAT_RAMP.length - 1],
          lowLabel: t.chartHeatmapScaleLow,
          highLabel: t.chartHeatmapScaleHigh,
          unit: t.chartHeatmapScaleUnit,
        }
      : undefined;

  const showSortControl =
    config.chartType === "bar" ||
    config.chartType === "pie" ||
    config.chartType === "heatmap";

  /**
   * The bulk filter only earns its place when there is more than one category:
   * with a single series the legend chip (and there being nothing to compare)
   * makes it noise.
   */
  const showFilter = series.length > 1;

  const hasRows = (chartState?.rows?.length ?? 0) > 0 || series.length > 0;

  /** Explain an empty/error chart instead of drawing a blank axis (§3.4/§4.8). */
  const renderIssue = () => {
    if (allSeriesHidden) {
      return (
        <div className="flex items-center justify-center h-full px-4 text-center text-xs text-muted-foreground">
          <div>
            <div className="font-medium text-foreground mb-1">
              {t.chartAllHiddenTitle}
            </div>
            {t.chartAllHiddenHint}
          </div>
        </div>
      );
    }
    if (!issue) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          {t.noData}
        </div>
      );
    }
    if (issue.kind === "column_not_found") {
      return (
        <div className="m-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs">
          <div className="font-medium text-destructive mb-1">
            {t.chartColumnNotFoundTitle.replace("{column}", issue.column)}
          </div>
          <div className="text-muted-foreground mb-2">
            {t.chartColumnNotFoundHint}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {issue.available.slice(0, 24).map((col) => (
              <span
                key={col}
                className="font-mono rounded bg-muted px-1.5 py-0.5 text-[11px]"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      );
    }
    if (issue.kind === "no_numeric_values") {
      return (
        <div className="m-3 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3 text-xs">
          <div className="font-medium mb-1 text-amber-700 dark:text-amber-400">
            {t.chartNoNumericTitle.replace("{column}", issue.column)}
          </div>
          <div className="text-muted-foreground">
            {t.chartNoNumericHint
              .replace("{total}", String(issue.totalRows))
              .replace("{dropped}", String(issue.nonNumericRows))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-full px-4 text-center text-xs text-muted-foreground">
        <div>
          <div className="font-medium text-foreground mb-1">
            {t.chartNoRowsTitle}
          </div>
          {t.chartNoRowsHint}
        </div>
      </div>
    );
  };

  /** Raw rows behind the chart, so the numbers stay reachable. */
  const renderTable = () => {
    const headers = chartState?.headers ?? [];
    const rows = chartState?.rows ?? [];
    if (headers.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          {t.noData}
        </div>
      );
    }
    return (
      // `min-w-full` (not `w-full`): the table must be able to grow past the
      // panel width so a many-column table scrolls horizontally. `w-full` would
      // pin it to the container, squeeze the columns and never show the
      // horizontal bar.
      <ScrollArea className="h-full">
        <table className="min-w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left font-medium text-muted-foreground px-2 py-1.5 border-b border-border whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 2000).map((row, i) => (
              <tr key={i} className="hover:bg-accent/40">
                {headers.map((_h, c) => (
                  <td
                    key={c}
                    className="px-2 py-1 border-b border-border/50 font-mono tabular-nums whitespace-nowrap"
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    );
  };

  /**
   * Hiding every category must not leave a blank plot: with no visible series
   * recharts would still draw bare axes and look broken. Heatmap / word cloud
   * key their hidden set differently (cell coordinates, words), so they never
   * land here.
   */
  const allSeriesHidden =
    series.length > 0 && series.every((s) => hiddenSeries.has(s.name));

  /**
   * `hasContent` gates the plot only. The legend and the toolbar (which hosts
   * the filter) must survive "everything hidden" — otherwise the user would
   * have no way back.
   */
  const canInteract = hasRows && !issue;
  const hasContent = canInteract && !allSeriesHidden;

  return (
    <div
      ref={panelRef}
      style={
        isMaximized
          ? { left: 0, top: 0, width: "100vw", height: "100vh" }
          : {
              left: pos.x,
              top: pos.y,
              width: `${(config.width || 600) + 40}px`,
              height: `${(config.height || 400) + 140}px`,
            }
      }
      className={`fixed flex flex-col bg-background border border-border/50 rounded-lg shadow-xl z-floating ${
        isDraggingRef ? "shadow-2xl" : ""
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/80 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-medium truncate">
            {config.title ||
              `${t.chart}: ${t[CHART_TYPE_KEYS[config.chartType]]}`}
          </h3>
          {config.category && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
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
          <Tooltip content={t.collapsePanel}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setCollapsed(true);
                onDockChange?.({ collapsed: true });
              }}
              disabled={isMaximized}
              className="px-2 font-medium"
            >
              <ChevronDown className="h-4 w-4" />
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

      {/* View switch + sort control */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView("chart")}
            aria-pressed={view === "chart"}
            className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
              view === "chart"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {t.chartViewChart}
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            disabled={!hasRows}
            className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
              view === "table"
                ? "bg-accent text-foreground"
                : hasRows
                  ? "text-muted-foreground hover:bg-accent/50"
                  : "text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            {t.chartViewTable}
          </button>
        </div>

        {view === "table" && hasRows && (
          <button
            type="button"
            onClick={handleCopyTable}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? t.chartCopied : t.chartCopyCsv}
          </button>
        )}

        {view === "chart" && canInteract && (showSortControl || showFilter) && (
          <div className="ml-auto flex items-center gap-2">
            {showSortControl && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="whitespace-nowrap">{t.chartSort}</span>
                <Select
                  value={effectiveSort}
                  onChange={(value) => setSort(value as ChartSort)}
                  options={[
                    { label: t.chartSortDesc, value: "desc" },
                    { label: t.chartSortAsc, value: "asc" },
                    { label: t.chartSortNone, value: "none" },
                  ]}
                  size="sm"
                  width={108}
                  ariaLabel={t.chartSort}
                />
              </div>
            )}
            {showFilter && (
              <CategoryFilter
                options={series.map((s, i) => ({
                  name: s.name,
                  color: s.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                }))}
                hidden={hiddenSeries}
                onToggle={handleLegendClick}
                onSetHidden={handleSetHidden}
                labels={{
                  filter: t.chartFilter,
                  selectAll: t.chartSelectAll,
                  deselectAll: t.chartDeselectAll,
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Partial-data and dropped-row notices */}
      {(chartState?.truncated || (chartState?.droppedRows ?? 0) > 0) && (
        <div className="px-3 pt-2 flex flex-col gap-1">
          {chartState?.truncated && (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
              {t.chartTruncated
                .replace("{shown}", String(chartState.rows?.length ?? 0))
                .replace("{total}", String(chartState.totalRows ?? 0))}
            </div>
          )}
          {(chartState?.droppedRows ?? 0) > 0 && (
            <div className="rounded border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
              {t.chartDroppedRows.replace(
                "{count}",
                String(chartState?.droppedRows ?? 0),
              )}
            </div>
          )}
        </div>
      )}

      {view === "chart" && canInteract && (
        <div className="px-3 pt-2">
          <ChartLegend
            entries={legendEntries}
            onToggle={series.length > 1 ? handleLegendClick : undefined}
            hint={
              config.chartType === "wordcloud"
                ? t.chartWordcloudHint
                : undefined
            }
            scale={heatScale}
          />
        </div>
      )}

      <div ref={chartContainerRef} className="flex-1 min-h-0 px-3 pb-1 pt-1">
        {view === "table"
          ? renderTable()
          : hasContent
            ? renderChart()
            : renderIssue()}
      </div>
      {/* The x-axis title renders as HTML *below* the SVG. recharts would place
          it at the bottom edge of the axis band, where the SVG's
          `overflow: hidden` clipped it entirely. */}
      {view === "chart" && hasContent && hasAxes && (
        <div className="px-3 pb-2 text-center text-[11px] text-muted-foreground">
          {xAxisLabel}
        </div>
      )}
    </div>
  );
});
