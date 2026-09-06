import { useRef, useState } from "react";
import { X, History, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutionHistoryEntry, ExecutionHistoryStatus } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface ExecutionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: ExecutionHistoryEntry[];
  loading: boolean;
  onRefresh: () => void;
}

interface ParsedSummary {
  columns: number;
  rows: number;
  bytes: number;
  preview: string[];
}

function parseSummary(raw: string): ParsedSummary {
  try {
    const parsed = JSON.parse(raw || "{}");
    return {
      columns: Number(parsed.columns) || 0,
      rows: Number(parsed.rows) || 0,
      bytes: Number(parsed.bytes) || 0,
      preview: Array.isArray(parsed.preview) ? parsed.preview : [],
    };
  } catch {
    return { columns: 0, rows: 0, bytes: 0, preview: [] };
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusClass(status: ExecutionHistoryStatus): string {
  switch (status) {
    case "success":
      return "bg-green-500/10 border-green-500/30 text-green-600";
    case "error":
      return "bg-red-500/10 border-red-500/30 text-red-600";
    case "cancelled":
      return "bg-yellow-500/10 border-yellow-500/30 text-yellow-600";
  }
}

function statusLabel(t: any, status: ExecutionHistoryStatus): string {
  switch (status) {
    case "success":
      return t.historyStatusSuccess;
    case "error":
      return t.historyStatusError;
    case "cancelled":
      return t.historyStatusCancelled;
  }
}

/** F6: persisted execution history viewer (time/status/duration/version +
 *  compact output summary). Opened from the log panel header. */
export function ExecutionHistoryDialog({
  isOpen,
  onClose,
  history,
  loading,
  onRefresh,
}: ExecutionHistoryDialogProps) {
  const { t } = useLanguage();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      setOffset({
        x: dragStart.current.offsetX + (ev.clientX - dragStart.current.x),
        y: dragStart.current.offsetY + (ev.clientY - dragStart.current.y),
      });
    };
    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-card border rounded-xl shadow-xl w-full max-w-2xl flex flex-col outline-none max-h-[80vh]"
        onContextMenu={(e) => e.preventDefault()}
        style={{ left: offset.x, top: offset.y }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b select-none cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4" />
            {t.executionHistory}
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={onRefresh}
              disabled={loading}
              className="px-2"
              aria-label={t.historyButton}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClose}
              className="px-2"
              aria-label={t.close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3">
            {loading && history.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {t.historyLoading}
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-14 h-14 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                  <History className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t.noHistoryYet}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t.executePipelineHint}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground/70 px-1">
                  {t.historySummaryHint}
                </p>
                {history.map((entry) => {
                  const expanded = expandedId === entry.id;
                  const summary = parseSummary(entry.outputSummary);
                  return (
                    <div
                      key={entry.id}
                      className="border rounded-lg overflow-hidden bg-muted/20"
                    >
                      <button
                        type="button"
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50 transition-colors"
                        onClick={() =>
                          setExpandedId(expanded ? null : entry.id)
                        }
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${statusClass(entry.status)}`}
                        >
                          {statusLabel(t, entry.status)}
                        </span>
                        <span className="text-sm font-medium min-w-0 truncate flex-1">
                          {entry.tabName || entry.tabId}
                        </span>
                        <span className="text-xs text-muted-foreground/70 flex-shrink-0 hidden sm:inline">
                          {entry.startedAt}
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-4 pb-3 pt-1 border-t bg-background/40">
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mb-2">
                            <span>
                              {t.historyDuration}:{" "}
                              {entry.durationMs >= 1000
                                ? `${(entry.durationMs / 1000).toFixed(1)}s`
                                : `${entry.durationMs}ms`}
                            </span>
                            <span>
                              {t.historyVersion}: {entry.versionId || "—"}
                            </span>
                            <span>
                              {t.historyColumns}: {summary.columns}
                            </span>
                            <span>
                              {t.historyRows}: {summary.rows}
                            </span>
                            <span>
                              {t.historyBytes}: {formatBytes(summary.bytes)}
                            </span>
                          </div>
                          {summary.preview.length > 0 && (
                            <pre className="text-[11px] leading-relaxed font-mono bg-muted/40 rounded-md p-2 overflow-x-auto text-foreground/80 whitespace-pre-wrap break-words">
                              {summary.preview.join("\n")}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
