import { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "reactflow";
import { X, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";

export interface ResultTableNodeData {
  headers: string[];
  rows: string[][];
  label: string;
  totalRows: number;
  truncated: boolean;
  onClose: () => void;
}

export function ResultTableNode({
  data,
}: {
  data: ResultTableNodeData;
  selected?: boolean;
}) {
  const { headers, rows, label, totalRows, truncated, onClose } = data;
  const { t } = useLanguage();
  const [copied, setCopied] = useState<"csv" | "md" | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Row virtualization: only render the visible window of rows so vertical
  // scrolling stays smooth even with many rows.
  const ROW_H = 28;
  const VIEW_H = 160;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - 8);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + VIEW_H) / ROW_H) + 8,
  );
  const visibleRows = rows.slice(startIndex, endIndex);

  useEffect(() => {
    setScrollTop(0);
  }, [rows.length]);

  // Track vertical scroll on the radix ScrollArea viewport for virtualization.
  useEffect(() => {
    const viewport = scrollRef.current?.closest(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;
    const onScroll = () => setScrollTop(viewport.scrollTop);
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [rows.length]);

  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const toCsv = () =>
    [
      headers.join(","),
      ...rows.map((r) =>
        r
          .map((v) =>
            v.includes(",") || v.includes('"') || v.includes("\n")
              ? `"${v.replace(/"/g, '""')}"`
              : v,
          )
          .join(","),
      ),
    ].join("\n");

  const toMarkdown = () => {
    const esc = (v: string) => v.replace(/\|/g, "\\|").replace(/\n/g, " ");
    const head = `| ${headers.map(esc).join(" | ")} |`;
    const sep = `| ${headers.map(() => "---").join(" | ")} |`;
    const body = rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
    return [head, sep, body].join("\n");
  };

  const copy = async (type: "csv" | "md") => {
    const text = type === "csv" ? toCsv() : toMarkdown();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 3000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div
      className={`result-node flex w-[560px] flex-col overflow-hidden rounded-md border border-border/60 bg-background shadow-sm ${
        truncated ? "h-[426px]" : "h-[400px]"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="result-left-target"
        className="opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <div className="result-node-header flex h-10 shrink-0 items-center gap-2 bg-muted/50 px-3 select-none cursor-grab active:cursor-grabbing">
        <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
        <span className="ml-auto whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
          {t.inputRowsCols
            .replace("{rows}", String(totalRows))
            .replace("{cols}", String(headers.length))}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copy("csv");
            }}
            aria-label={`${t.copy} CSV`}
            className="nodrag h-6 rounded px-1 font-mono text-[10.5px] font-normal text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied === "csv" ? (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              "CSV"
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              copy("md");
            }}
            aria-label={`${t.copy} MD`}
            className="nodrag h-6 rounded px-1 font-mono text-[10.5px] font-normal text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied === "md" ? (
              <Check className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              "MD"
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="nodrag flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-primary/10"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      {truncated && (
        <div
          className="flex h-[26px] shrink-0 items-center border-b border-border/40 bg-amber-500/10 px-3 font-mono text-[11px] text-amber-600 dark:text-amber-400"
          title={t.resultTruncated}
        >
          <span className="truncate">{t.resultTruncated}</span>
        </div>
      )}
      <ScrollArea className="nodrag nowheel min-h-0 flex-1 cursor-default">
        <div
          ref={scrollRef}
          className="min-w-max"
          onMouseDown={stop}
          onMouseMove={stop}
          onMouseUp={stop}
        >
          <table
            className="border-collapse"
            style={{
              width:
                headers.length <= 5
                  ? 520
                  : headers.length * 100,
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              {headers.map((_, i) => (
                <col
                  key={i}
                  style={{
                    width:
                      headers.length <= 5
                        ? 520 / Math.max(headers.length, 1)
                        : 100,
                  }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-10 bg-muted/40 border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {startIndex > 0 && <tr style={{ height: startIndex * ROW_H }} />}
              {visibleRows.map((row, ri) => {
                const i = startIndex + ri;
                return (
                  <tr key={i} className="group">
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-border/30 px-2 py-1 text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {endIndex < rows.length && (
                <tr style={{ height: (rows.length - endIndex) * ROW_H }} />
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}
