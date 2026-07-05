import { Trash2, Info, CheckCircle, AlertCircle, XCircle, TextQuote, FileText, Copy, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { LogEntry } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  isVisible: boolean;
  onClose: () => void;
}

export function LogPanel({ logs, onClear, isVisible, onClose }: LogPanelProps) {
  const { t } = useLanguage();
  const [height, setHeight] = useState<number>(300);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return <Info className="h-3.5 w-3.5 text-blue-500" />;
      case "success":
        return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    }
  };

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

  const handleResize = (delta: number) => {
    const newHeight = Math.max(150, Math.min(600, height + delta));
    setHeight(newHeight);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
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

    const toolbarHeight = 56;
    const panelWidth = 600;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !panelRef.current) return;

      const deltaX = e.clientX - dragStateRef.current.startX;
      const deltaY = e.clientY - dragStateRef.current.startY;

      let newX = dragStateRef.current.offsetX + deltaX;
      let newY = dragStateRef.current.offsetY + deltaY;

      newX = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
      newY = Math.max(toolbarHeight, Math.min(window.innerHeight - height, newY));

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
  };

  useEffect(() => {
    if (isVisible && panelRef.current) {
      const panelWidth = 600;
      const newX = window.innerWidth - panelWidth;
      panelRef.current.style.left = `${newX}px`;
      panelRef.current.style.top = `100px`;
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      style={{
        left: window.innerWidth - 600,
        top: 100,
        height: height
      }}
      className={`fixed w-[600px] flex flex-col bg-background border border-border/50 rounded-lg shadow-xl z-40 ${isDraggingRef ? "shadow-2xl" : ""}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="p-2 border-b bg-card/80 cursor-move flex items-center justify-between"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground shadow-sm">
            <FileText className="h-3.5 w-3.5" />
            {t.logs} ({logs.length})
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={onClear}
            disabled={logs.length === 0}
            className="px-2 font-medium"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClose}
            className="px-2 font-medium"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                <TextQuote className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{t.noLogsYet}</p>
              <p className="text-xs text-muted-foreground/70">
                {t.executePipelineHint}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card
                  key={log.id}
                  className={`p-3 border group ${getLogBgColor(log.type)} hover:shadow-sm transition-all duration-200`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">{getLogIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold uppercase tracking-wider ${getLogColor(log.type)}`}>
                          {log.type}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(log.message);
                            setCopiedLogId(log.id);
                            setTimeout(() => setCopiedLogId(null), 3000);
                          }}
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-primary/10"
                        >
                          {copiedLogId === log.id ? (
                            <>
                              <Check className="text-green-500" />
                            </>
                          ) : (
                            <>
                              <Copy className="text-muted-foreground" />
                            </>
                          )}
                        </Button>
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
      <ResizeHandle
        direction="vertical"
        onResize={handleResize}
        className="absolute -bottom-1 left-0 right-0 z-10"
      />
    </div>
  );
}