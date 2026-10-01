import { ChevronDown } from "lucide-react";
import * as React from "react";
import { useEffect, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatNumber, type NumberFormatMode } from "@/utils/format";

export interface LegendEntry {
  name: string;
  color: string;
  /** Hidden via the legend (the caller drops it from the rendered data). */
  hidden?: boolean;
  /** Optional role hint such as "Y axis". */
  role?: string;
}

interface ChartLegendProps {
  entries: LegendEntry[];
  onToggle?: (name: string) => void;
  /** Shown instead of `entries` for charts with no series (word cloud). */
  hint?: string;
  /** Heatmap-style continuous scale legend. */
  scale?: {
    from: string;
    to: string;
    lowLabel: string;
    highLabel: string;
    unit?: string;
  };
  className?: string;
}

/**
 * One legend for every chart type.
 *
 * The chips sit in a **single horizontally scrollable row**: with a `category`
 * column every distinct value becomes a chip, and wrapping them over several
 * lines used to eat the fixed-height panel's vertical space and squeeze the
 * plot (design 029 follow-up). Radix's content wrapper (`min-width:100%`) keeps
 * the row at least as wide as the box, so the underline still spans it when
 * there are only a few entries.
 */
export const ChartLegend = React.memo(function ChartLegend({
  entries,
  onToggle,
  hint,
  scale,
  className,
}: ChartLegendProps) {
  if (entries.length === 0 && !hint && !scale) return null;

  return (
    <ScrollArea className={cn("px-1 pb-2 mb-2 border-b border-border/60", className)}>
      <div className="flex flex-nowrap items-center gap-x-3 w-max min-w-full">
        {entries.map((entry) => (
          <button
            key={entry.name}
            type="button"
            onClick={onToggle ? () => onToggle(entry.name) : undefined}
            aria-pressed={onToggle ? !entry.hidden : undefined}
            className={cn(
              "flex items-center gap-1.5 text-xs px-1 py-0.5 rounded transition-colors whitespace-nowrap flex-none",
              onToggle ? "cursor-pointer hover:bg-accent/60" : "cursor-default",
            )}
          >
            <span
              className="inline-block w-3 h-3 rounded-sm flex-none"
              style={{ backgroundColor: entry.hidden ? "#9ca3af" : entry.color }}
            />
            <span className={entry.hidden ? "text-muted-foreground/60" : "text-foreground"}>
              {entry.name}
            </span>
            {entry.role && (
              <span className="text-muted-foreground/70 text-[10px]">
                ({entry.role})
              </span>
            )}
          </button>
        ))}

        {hint && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{hint}</span>
        )}

        {scale && (
          <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-muted-foreground whitespace-nowrap">
            {scale.lowLabel}
            <span
              className="inline-block w-24 h-2.5 rounded-sm"
              style={{
                background: `linear-gradient(90deg, ${scale.from}, ${scale.to})`,
              }}
            />
            {scale.highLabel}
            {scale.unit ? ` · ${scale.unit}` : ""}
          </span>
        )}
      </div>
    </ScrollArea>
  );
});

export interface TooltipRow {
  name: string;
  value: number | null | undefined;
  color?: string;
  /** Pre-formatted value; when absent `formatNumber` is applied. */
  display?: string;
  /** Share of the total, e.g. 0.341 for 34.1%. */
  share?: number;
}

interface ChartTooltipProps {
  title: string;
  rows: TooltipRow[];
  format?: NumberFormatMode;
}

/**
 * Shared chart tooltip.
 *
 * Previously each of the 9 recharts `<Tooltip>`s passed only `contentStyle`
 * with background/border colours — never a text colour — which left the dark
 * theme with a low-contrast tooltip, and the heatmap hand-rolled its own
 * English-only box (design 029 §4.4).
 */
export const ChartTooltip = React.memo(function ChartTooltip({
  title,
  rows,
  format = "auto",
}: ChartTooltipProps) {
  const { t } = useLanguage();

  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg min-w-[160px]">
      <div className="font-medium mb-1.5">{title}</div>
      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={`${row.name}-${i}`} className="flex items-center gap-2">
            {row.color && (
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto font-mono tabular-nums">
              {row.display ?? formatNumber(row.value, format)}
            </span>
            {row.share !== undefined && Number.isFinite(row.share) && (
              <span className="font-mono tabular-nums text-muted-foreground text-[11px]">
                {(row.share * 100).toFixed(1)}%
              </span>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-muted-foreground">{t.noData}</div>
        )}
      </div>
    </div>
  );
});

export interface CategoryFilterProps {
  /** Every category, in display order, with its series colour. */
  options: { name: string; color: string }[];
  /** Names currently hidden. */
  hidden: ReadonlySet<string>;
  onToggle: (name: string) => void;
  /** Show every category (`false`) or hide them all (`true`). */
  onSetHidden: (hidden: boolean) => void;
  labels: { filter: string; selectAll: string; deselectAll: string };
}

/**
 * Multi-select dropdown over the chart's categories.
 *
 * Clicking legend chips one by one does not scale to dozens of categories, so
 * this adds bulk show/hide with 全选 / 取消全选. It drives the same
 * `hiddenSeries` set the legend chips do, so the two stay in sync.
 */
export const CategoryFilter = React.memo(function CategoryFilter({
  options,
  hidden,
  onToggle,
  onSetHidden,
  labels,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const total = options.length;
  const shown = options.filter((o) => !hidden.has(o.name)).length;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors whitespace-nowrap"
      >
        {labels.filter}
        <span className="font-mono tabular-nums">
          {shown}/{total}
        </span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 w-56 border rounded-md bg-background shadow-lg"
        >
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-border">
            <button
              type="button"
              role="menuitem"
              onClick={() => onSetHidden(false)}
              className="text-xs text-foreground hover:bg-accent/60 rounded px-1.5 py-0.5 transition-colors"
            >
              {labels.selectAll}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => onSetHidden(true)}
              className="text-xs text-muted-foreground hover:bg-accent/60 rounded px-1.5 py-0.5 transition-colors"
            >
              {labels.deselectAll}
            </button>
          </div>
          <ScrollArea className="max-h-56">
            <div className="py-1">
              {options.map((option) => {
                const visible = !hidden.has(option.name);
                return (
                  <label
                    key={option.name}
                    className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-accent/50"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => onToggle(option.name)}
                      style={{ accentColor: "var(--primary)" }}
                      className="h-3.5 w-3.5 flex-none cursor-pointer"
                    />
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm flex-none"
                      style={{ backgroundColor: option.color }}
                    />
                    <span
                      className={cn(
                        "truncate",
                        visible ? "text-foreground" : "text-muted-foreground/60",
                      )}
                      title={option.name}
                    >
                      {option.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
});
