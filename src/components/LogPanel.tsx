import { LogEntry } from "@/types/xan";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Trash2, Info, CheckCircle, AlertCircle, XCircle, Terminal } from "lucide-react";
import { useState } from "react";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const [height, setHeight] = useState<number>(50); // Initial height: 50%

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
    const containerHeight = window.innerHeight;
    const percentDelta = (delta / containerHeight) * 100;
    const newHeight = Math.max(10, Math.min(90, height - percentDelta));
    setHeight(newHeight);
  };

  return (
    <div style={{ height: `${height}%` }} className="relative flex flex-col bg-gradient-to-b from-background to-muted/10 border-t border-border/50 min-h-[100px]">
      <ResizeHandle 
        direction="vertical" 
        onResize={handleResize} 
        className="absolute -top-1 left-0 right-0 z-10" 
      />
      <div className="p-3 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-primary/5 rounded-lg flex items-center justify-center border border-primary/20">
            <Terminal className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Output Logs
            </h3>
            <p className="text-xs text-muted-foreground">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={logs.length === 0}
          className="h-7 px-3 text-xs font-medium hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3 w-3 mr-1.5" />
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3">
          {logs.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                <Terminal className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">No logs yet</p>
              <p className="text-xs text-muted-foreground/70">
                Execute a pipeline to see output
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <Card 
                  key={log.id} 
                  className={`p-3 border ${getLogBgColor(log.type)} hover:shadow-sm transition-all duration-200`}
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
                      </div>
                      <p className="text-sm leading-relaxed break-words font-mono whitespace-pre-wrap text-foreground/90">
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
    </div>
  );
}
