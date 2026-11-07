import { useEffect, useMemo, useRef, useState } from "react";
import { X, RefreshCw, ChevronDown, ChevronRight, Search, Hand } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { ExecutionHistoryEntry, ExecutionHistoryStatus } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { formatBytes } from "@/utils/format";

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

const STATUS_DOT_CLASS: Record<ExecutionHistoryStatus, string> = {
  success: "bg-success",
  error: "bg-danger",
  cancelled: "bg-warning",
};

function statusLabel(
  t: { historyStatusSuccess: string; historyStatusError: string; historyStatusCancelled: string },
  status: ExecutionHistoryStatus,
): string {
  switch (status) {
    case "success":
      return t.historyStatusSuccess;
    case "error":
      return t.historyStatusError;
    case "cancelled":
      return t.historyStatusCancelled;
  }
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** `MM-DD HH:mm:ss` this year, `YY-MM-DD HH:mm` for older runs. */
function formatStartedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const minutes = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (date.getFullYear() !== new Date().getFullYear()) {
    return `${String(date.getFullYear()).slice(-2)}-${month}-${day} ${minutes}`;
  }
  return `${month}-${day} ${minutes}:${pad2(date.getSeconds())}`;
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return history;
    return history.filter((entry) => {
      const text = [
        entry.tabName,
        entry.tabId,
        entry.versionId ?? "",
        statusLabel(t, entry.status),
        entry.startedAt,
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [history, searchQuery, t]);

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
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery("");
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayedCount = searchQuery.trim()
    ? filteredHistory.length
    : history.length;

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
        className="relative flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl outline-none"
        onContextMenu={(e) => e.preventDefault()}
        style={{ left: offset.x, top: offset.y }}
      >
        <div
          className="relative flex h-[52px] shrink-0 cursor-grab items-center gap-2.5 border-b border-border px-5 select-none active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <Hand className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[15px] font-medium text-foreground">
            {t.executionHistory}
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
            {displayedCount}
            {t.historyCountUnit ? ` ${t.historyCountUnit}` : ""}
          </span>

          {history.length > 0 && (
            <div
              className="absolute left-1/2 top-1/2 w-[240px] -translate-x-1/2 -translate-y-1/2"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.historySearchPlaceholder}
                aria-label={t.historySearchPlaceholder}
                className="h-7 w-full rounded-md border border-transparent bg-muted pl-[26px] pr-2 text-[11px] text-foreground outline-none focus:border-primary"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip content={t.historyRefresh}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.historyRefresh}
                onClick={onRefresh}
                disabled={loading}
                className="h-7 w-7 p-0"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </Tooltip>
            <Tooltip content={t.close}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.close}
                onClick={onClose}
                className="h-7 w-7 p-0"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-1">
            {loading && history.length === 0 ? (
              <p className="px-5 py-6 text-[12.5px] text-muted-foreground">
                {t.historyLoading}
              </p>
            ) : history.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-[12.5px] font-medium text-muted-foreground">
                  {t.noHistoryYet}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground/70">
                  {t.historyEmptyHint}
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-[12.5px] font-medium text-muted-foreground">
                  {t.historyNoMatches}
                </p>
              </div>
            ) : (
              filteredHistory.map((entry) => {
                const expanded = expandedId === entry.id;
                const summary = parseSummary(entry.outputSummary);
                return (
                  <div
                    key={entry.id}
                    className="relative border-b border-border last:border-b-0"
                  >
                    {expanded && (
                      <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                    )}
                    <button
                      type="button"
                      className="flex h-14 w-full items-center gap-2 px-5 text-left transition-colors hover:bg-muted/30"
                      onClick={() =>
                        setExpandedId(expanded ? null : entry.id)
                      }
                    >
                      <span className="w-7 shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums">
                        {String(entry.id).padStart(3, "0")}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[entry.status]}`}
                      />
                      <span className="w-16 shrink-0 text-[11px] text-muted-foreground">
                        {statusLabel(t, entry.status)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                        {entry.tabName || entry.tabId}
                      </span>
                      <span className="w-[92px] shrink-0 font-mono text-[10.5px] text-muted-foreground tabular-nums">
                        {formatStartedAt(entry.startedAt)}
                      </span>
                      <span className="w-12 shrink-0 text-right font-mono text-[10.5px] text-muted-foreground tabular-nums">
                        {formatDuration(entry.durationMs)}
                      </span>
                      <span className="w-[72px] shrink-0 text-right font-mono text-[10.5px] text-muted-foreground tabular-nums">
                        {entry.rows.toLocaleString()} {t.historyRowsUnit}
                      </span>
                      <span className="grid w-5 shrink-0 place-items-center text-muted-foreground">
                        {expanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </button>

                    {expanded && (
                      <div className="border-t border-border bg-muted/20 px-5 pb-4 pl-12 pt-3">
                        <div className="mb-3.5 flex gap-7">
                          {[
                            { key: t.historyDuration, value: formatDuration(entry.durationMs) },
                            {
                              key: t.historyVersion,
                              value: entry.versionId
                                ? entry.versionId.slice(0, 6)
                                : "—",
                              title: entry.versionId ?? undefined,
                            },
                            { key: t.historyColumns, value: String(summary.columns) },
                            { key: t.historyRows, value: summary.rows.toLocaleString() },
                            { key: t.historyBytes, value: formatBytes(summary.bytes) },
                          ].map((cell) => (
                            <div key={cell.key} className="flex flex-col gap-0.5">
                              <span className="text-[10.5px] text-muted-foreground">
                                {cell.key}
                              </span>
                              <span
                                className="font-mono text-[12.5px] text-foreground tabular-nums"
                                title={cell.title}
                              >
                                {cell.value}
                              </span>
                            </div>
                          ))}
                        </div>
                        {summary.preview.length > 0 && (
                          <>
                            <p className="mb-1 text-[10.5px] text-muted-foreground">
                              {t.historyOutputPreview.replace(
                                "{n}",
                                String(summary.preview.length),
                              )}
                            </p>
                            <pre className="m-0 whitespace-pre-wrap break-words rounded-md border border-border bg-card p-2 font-mono text-[11px] leading-[18px] text-foreground">
                              {summary.preview.join("\n")}
                            </pre>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
