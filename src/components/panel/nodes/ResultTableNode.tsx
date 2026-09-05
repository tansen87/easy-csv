import { useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "reactflow";
import { Table, X, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <div className="result-node rounded-md border border-border/60 bg-background shadow-sm">
      <Handle
        type="target"
        position={Position.Left}
        id="result-left-target"
        className="opacity-0"
        style={{ opacity: 0, pointerEvents: "none" }}
      />
      <div className="result-node-header px-2 py-1 bg-muted/50 flex items-center gap-2 select-none cursor-grab">
        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500/25 to-indigo-500/10 rounded-md flex items-center justify-center">
          <Table className="h-3 w-3 text-indigo-600" />
        </div>
        <span className="font-semibold text-sm truncate">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {totalRows} rows x {headers.length} cols
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copy("csv");
            }}
            className="nodrag w-6 h-6 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-md transition-colors flex items-center justify-center"
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
            className="nodrag w-6 h-6 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-primary/10 rounded-md transition-colors flex items-center justify-center"
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
            className="nodrag w-6 h-6 rounded-md flex items-center justify-center hover:bg-primary/10 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      {truncated && (
        <div className="px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border-b border-border/40">
          {t.resultTruncated}
        </div>
      )}
      <ScrollArea className="nodrag nowheel cursor-default h-[360px]">
        <div
          ref={scrollRef}
          className="min-w-max"
          onMouseDown={stop}
          onMouseMove={stop}
          onMouseUp={stop}
        >
          <table
            className="border-collapse"
            style={{ width: headers.length * 100, tableLayout: "fixed" }}
          >
            <colgroup>
              {headers.map((_, i) => (
                <col key={i} style={{ width: 100 }} />
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
