import {
  Trash2,
  Copy,
  Check,
  X,
  Maximize2,
  Minimize2,
  ArrowDown,
  History,
  Hand,
} from "lucide-react";
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Tooltip } from "@/components/ui/Tooltip";
import { LogEntry, PanelDockState } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onRemoveLog: (id: string) => void;
  isVisible: boolean;
  onClose: () => void;
  onShowHistory?: () => void;
  /** Persisted docking state. */
  dockState?: PanelDockState;
  /** Report position changes for persistence. */
  onDockChange?: (patch: Partial<PanelDockState>) => void;
  /** Raise the docked bottom edge to avoid the expanded AI panel. */
  bottomOffset?: number | string;
  /** Current tab, for the 「仅当前标签页」 log scope. */
  selectedTabId?: string;
  /** Tab id → name, used for the per-line badge. */
  tabs?: { id: string; name: string }[];
}

/** Severity dot, the only place colour appears in the list. */
const LOG_DOT_CLASS: Record<LogEntry["type"], string> = {
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
};

const pad2 = (value: number) => String(value).padStart(2, "0");

/** `HH:mm:ss` for today, `MM-DD` for older lines; the full value goes in a tooltip. */
function formatLogTime(ts: Date): { short: string; full: string } {
  const now = new Date();
  const sameDay =
    ts.getFullYear() === now.getFullYear() &&
    ts.getMonth() === now.getMonth() &&
    ts.getDate() === now.getDate();
  const short = sameDay
    ? `${pad2(ts.getHours())}:${pad2(ts.getMinutes())}:${pad2(ts.getSeconds())}`
    : `${pad2(ts.getMonth() + 1)}-${pad2(ts.getDate())}`;
  return { short, full: ts.toLocaleString() };
}

export const LogPanel = React.memo(function LogPanel({
  logs,
  onClear,
  onRemoveLog,
  isVisible,
  onClose,
  onShowHistory,
  dockState,
  onDockChange,
  bottomOffset = 0,
  selectedTabId,
  tabs,
}: LogPanelProps) {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [panelLeft, setPanelLeft] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LogEntry["type"] | "all">(
    "all",
  );
  /** 「全部」or 「仅当前标签页」. */
  const [tabScope, setTabScope] = useState<"all" | "current">("all");
  const [atBottom, setAtBottom] = useState(true);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const tabNameById = useMemo(
    () => new Map((tabs ?? []).map((tab) => [tab.id, tab.name])),
    [tabs],
  );

  const filteredLogs = useMemo(() => {
    const byType =
      activeFilter === "all"
        ? logs
        : logs.filter((log) => log.type === activeFilter);
    // Lines carry their tab id; scope to the selected tab only when asked.
    if (tabScope === "all" || !selectedTabId) return byType;
    return byType.filter((log) => log.tabId === selectedTabId);
  }, [logs, activeFilter, tabScope, selectedTabId]);

  const typeCounts = useMemo(() => {
    const counts: Record<LogEntry["type"], number> = {
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
    };
    logs.forEach((log) => {
      counts[log.type] += 1;
    });
    return counts;
  }, [logs]);

  const getViewport = () =>
    scrollAreaRef.current?.querySelector<HTMLElement>(
      "[data-radix-scroll-area-viewport]",
    );

  const copyLogMessage = async (log: LogEntry) => {
    try {
      await navigator.clipboard.writeText(log.message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = log.message;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(textarea);
    }
    setCopiedLogId(log.id);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedLogId(null), 3000);
  };

  const jumpToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    setAtBottom(true);
  }, []);

  const handleViewportScroll = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;
    const nearBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 40;
    setAtBottom(nearBottom);
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    const viewport = getViewport();
    if (!viewport) return;
    viewport.addEventListener("scroll", handleViewportScroll);
    return () => viewport.removeEventListener("scroll", handleViewportScroll);
  }, [isVisible, handleViewportScroll]);

  useEffect(() => {
    if (!isVisible || !atBottom) return;
    const viewport = getViewport();
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [isVisible, filteredLogs.length, atBottom]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    setIsDragging(true);

    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: rect.left,
        offsetY: rect.top,
      };
    }

    const toolbarHeight = 56;
    const panelWidth = panelRef.current?.offsetWidth || 600;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;

      let newX = dragStateRef.current.offsetX + deltaX;
      let newY = dragStateRef.current.offsetY + deltaY;

      newX = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
      newY = Math.max(toolbarHeight, Math.min(window.innerHeight - 300, newY));

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        panelRef.current!.style.left = `${newX}px`;
        panelRef.current!.style.top = `${newY}px`;
        panelRef.current!.style.bottom = "auto";
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (panelRef.current) {
        const left = panelRef.current.getBoundingClientRect().left;
        setPanelLeft(left);
        onDockChange?.({ x: left });
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
  };

  useEffect(() => {
    if (isVisible) {
      const panelWidth = panelRef.current?.offsetWidth || 600;
      // Persisted x wins; otherwise dock to the right edge.
      const newX =
        dockState?.x !== undefined
          ? dockState.x
          : window.innerWidth - panelWidth;
      setPanelLeft(newX);
    }
  }, [isVisible, dockState?.x]);

  useLayoutEffect(() => {
    if (isMaximized || !panelRef.current) return;
    panelRef.current.style.top = "";
    panelRef.current.style.bottom =
      typeof bottomOffset === "number" ? `${bottomOffset}px` : bottomOffset;
    const panelWidth = panelRef.current.offsetWidth || 600;
    const newX =
      dockState?.x !== undefined ? dockState.x : window.innerWidth - panelWidth;
    setPanelLeft(newX);
  }, [isMaximized, bottomOffset, dockState?.x]);

  useEffect(() => {
    const handleResize = () => {
      if (panelRef.current && !isMaximized) {
        const panelWidth = panelRef.current.offsetWidth || 600;
        const newX = window.innerWidth - panelWidth;
        setPanelLeft(newX);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMaximized]);

  if (!isVisible) return null;

  const levelLabel: Record<LogEntry["type"], string> = {
    info: t.logLevelInfo,
    success: t.logLevelSuccess,
    warning: t.logLevelWarning,
    error: t.logLevelError,
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
              left: panelLeft,
              bottom: bottomOffset,
              height: 300,
            }
      }
      className={`fixed z-floating flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg ${isMaximized ? "h-screen w-screen" : "w-[min(600px,calc(100vw-32px))]"} ${isDragging ? "shadow-xl" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Title bar: drag region on the left, filters next to it, actions on the right */}
      <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-border px-3">
        <div
          className="flex cursor-grab select-none items-center gap-2.5 active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <Hand className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[13px] font-medium text-foreground">
            {t.logs}
          </span>
          <span className="font-mono text-[10.5px] text-muted-foreground tabular-nums">
            {logs.length}
            {t.logCountUnit ? ` ${t.logCountUnit}` : ""}
          </span>
        </div>

        {logs.length > 0 && (
          <>
            <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 112 }}>
              <Select
                value={activeFilter}
                onChange={(value) =>
                  setActiveFilter(value as LogEntry["type"] | "all")
                }
                options={[
                  { label: `${t.allLogs} (${logs.length})`, value: "all" },
                  ...(["info", "success", "warning", "error"] as const).map(
                    (type) => ({
                      label: `${levelLabel[type]} (${typeCounts[type]})`,
                      value: type,
                    }),
                  ),
                ]}
                height="h-7"
                ariaLabel={t.logLevelFilter}
              />
            </div>
            <div
              className="flex items-center gap-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                data-scope="current"
                onClick={() => setTabScope("current")}
                className={`h-7 rounded-md px-2 text-[11px] transition-colors ${
                  tabScope === "current"
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.logFilterCurrent}
              </button>
              <span className="h-3 w-px bg-border" />
              <button
                type="button"
                data-scope="all"
                onClick={() => setTabScope("all")}
                className={`h-7 rounded-md px-2 text-[11px] transition-colors ${
                  tabScope === "all"
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.logFilterAll}
              </button>
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {onShowHistory && (
            <Tooltip content={t.historyButton}>
              <Button
                variant="ghost"
                size="xs"
                aria-label={t.historyButton}
                onClick={onShowHistory}
                className="h-7 w-7 p-0"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t.aiClear}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.aiClear}
              onClick={onClear}
              disabled={logs.length === 0}
              className="h-7 w-7 p-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
          <Tooltip content={isMaximized ? t.restore : t.maximize}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={isMaximized ? t.restore : t.maximize}
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-7 w-7 p-0"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>
          <Tooltip content={t.close}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.close}
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1">
        {filteredLogs.length === 0 ? (
          <div className="px-4 pt-6">
            <p className="text-[12.5px] font-medium text-muted-foreground">
              {logs.length === 0 ? t.noLogsYet : t.noMatchingLogs}
            </p>
            {logs.length === 0 && (
              <p className="mt-0.5 text-[11.5px] text-muted-foreground/70">
                {t.executePipelineHint}
              </p>
            )}
          </div>
        ) : (
          <ul>
            {filteredLogs.map((log) => {
              const time = formatLogTime(log.timestamp);
              return (
                <li
                  key={log.id}
                  className="group border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
                    <span
                      className="w-14 shrink-0 font-mono text-[10.5px] tabular-nums"
                      title={time.full}
                    >
                      {time.short}
                    </span>
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${LOG_DOT_CLASS[log.type]}`}
                    />
                    <span className="w-8 shrink-0 text-[11px] text-muted-foreground">
                      {levelLabel[log.type]}
                    </span>
                    {log.tabId && (
                      <span className="min-w-0 max-w-[140px] truncate font-mono text-[10.5px]">
                        {tabNameById.get(log.tabId) ?? log.tabId}
                      </span>
                    )}
                    <div className="ml-auto flex shrink-0 items-center gap-2">
                      <Tooltip
                        content={copiedLogId === log.id ? t.copied : t.copy}
                      >
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.copy}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyLogMessage(log);
                          }}
                          className="h-[16px] w-[16px] opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
                        >
                          {copiedLogId === log.id ? (
                            <Check className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                      </Tooltip>
                      <Tooltip content={t.remove}>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.remove}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveLog(log.id);
                          }}
                          className="h-[16px] w-[16px] text-muted-foreground opacity-0 pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100 hover:text-destructive focus-visible:pointer-events-auto focus-visible:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                  <p className="ml-[78px] mt-0.5 whitespace-pre-wrap break-words font-mono text-xs leading-[18px] text-foreground">
                    {log.message}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>

      {!atBottom && filteredLogs.length > 0 && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-3 right-3 z-10 flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11px] text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {t.logJumpToLatest}
        </button>
      )}
    </div>
  );
});
