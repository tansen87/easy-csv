import {
  Trash2,
  TextQuote,
  FileText,
  Copy,
  Check,
  X,
  Maximize2,
  Minimize2,
  ArrowDown,
  Filter,
} from "lucide-react";
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LogEntry } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  onRemoveLog: (id: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

export const LogPanel = React.memo(function LogPanel({
  logs,
  onClear,
  onRemoveLog,
  isVisible,
  onClose,
}: LogPanelProps) {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [panelLeft, setPanelLeft] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [activeFilter, setActiveFilter] = useState<LogEntry["type"] | "all">(
    "all",
  );
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

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return "text-blue-500";
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
    }
  };

  const getLogBgColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return "bg-blue-500/10 border-blue-500/20";
      case "success":
        return "bg-green-500/10 border-green-500/20";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20";
      case "error":
        return "bg-red-500/10 border-red-500/20";
    }
  };

  const filteredLogs = useMemo(() => {
    if (activeFilter === "all") return logs;
    return logs.filter((log) => log.type === activeFilter);
  }, [logs, activeFilter]);

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

  const formatTimestamp = (ts: Date) => {
    const now = new Date();
    const sameDay =
      ts.getFullYear() === now.getFullYear() &&
      ts.getMonth() === now.getMonth() &&
      ts.getDate() === now.getDate();
    return sameDay ? ts.toLocaleTimeString() : ts.toLocaleString();
  };

  const chipClass = (active: boolean, type: LogEntry["type"] | "all") => {
    const base =
      "flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border transition-colors";
    if (!active) {
      return `${base} bg-transparent border-border/50 text-muted-foreground/70 hover:bg-muted`;
    }
    if (type === "all") {
      return `${base} bg-primary/15 border-primary/30 text-primary font-medium`;
    }
    return `${base} ${getLogBgColor(type)} font-medium ${getLogColor(type)}`;
  };

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
        setPanelLeft(panelRef.current.getBoundingClientRect().left);
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
      const newX = window.innerWidth - panelWidth;
      setPanelLeft(newX);
    }
  }, [isVisible]);

  useLayoutEffect(() => {
    if (isMaximized || !panelRef.current) return;
    panelRef.current.style.top = "";
    panelRef.current.style.bottom = "0";
    const panelWidth = panelRef.current.offsetWidth || 600;
    setPanelLeft(window.innerWidth - panelWidth);
  }, [isMaximized]);

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
              bottom: 0,
              height: 300,
            }
      }
      className={`fixed flex flex-col bg-background border border-border/50 rounded-lg shadow-xl z-40 ${isMaximized ? "w-screen h-screen" : "w-[min(600px,calc(100vw-32px))]"} ${isDragging ? "shadow-2xl" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="p-2 border-b bg-card/80 flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-sm cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <FileText className="h-3.5 w-3.5" />
          {t.logs}
        </div>
        {logs.length > 0 && (
          <div
            className="flex-1 min-w-0 flex items-center justify-center gap-1 overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={chipClass(activeFilter === "all", "all")}
            >
              {t.allLogs}
              <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold rounded-full bg-primary/15 text-primary/80 leading-none">
                {logs.length}
              </span>
            </button>
            {(["info", "success", "warning", "error"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setActiveFilter(type)}
                className={chipClass(activeFilter === type, type)}
              >
                {type}
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold rounded-full bg-primary/15 text-primary/80 leading-none">
                  {typeCounts[type]}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <Tooltip content={t.aiClear}>
            <Button
              variant="ghost"
              size="xs"
              onClick={onClear}
              disabled={logs.length === 0}
              className="px-2 font-medium"
            >
              <Trash2 className="h-4 w-4" />
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
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-3">
          {filteredLogs.length === 0 ? (
            logs.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                  <TextQuote className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">
                  {t.noLogsYet}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t.executePipelineHint}
                </p>
              </div>
            ) : (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-muted/50 rounded-xl flex items-center justify-center">
                  <Filter className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t.noMatchingLogs}
                </p>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <Card
                  key={log.id}
                  className={`p-3 border group ${getLogBgColor(log.type)} hover:shadow-sm transition-all duration-200`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider ${getLogColor(log.type)}`}
                        >
                          {log.type}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <Tooltip
                          content={copiedLogId === log.id ? t.copied : t.copy}
                        >
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyLogMessage(log);
                            }}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10"
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
                            size="xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveLog(log.id);
                            }}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </Tooltip>
                      </div>
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90 font-mono">
                        {log.message}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
      {!atBottom && filteredLogs.length > 0 && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 right-4 z-10 h-8 w-8 rounded-full border border-border/50 shadow-lg flex items-center justify-center hover:bg-accent transition-all"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
