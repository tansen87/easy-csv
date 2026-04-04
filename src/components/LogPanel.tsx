import { LogEntry } from "@/types/xan";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Trash2, Info, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useState } from "react";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

export function LogPanel({ logs, onClear }: LogPanelProps) {
  const [height, setHeight] = useState<number>(192); // Initial height: h-48 = 192px

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
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

  const handleResize = (delta: number) => {
    // Ensure minimum height of 64px and maximum height of 800px
    const newHeight = Math.max(64, Math.min(800, height - delta));
    setHeight(newHeight);
  };

  return (
    <div style={{ height: `${height}px` }} className="relative flex flex-col bg-background border-t">
      <ResizeHandle 
        direction="vertical" 
        onResize={handleResize} 
        className="absolute top-0 left-0 right-0" 
      />
      <div className="p-2 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold">Output Logs</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={logs.length === 0}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-xs">No logs yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <Card key={log.id} className="p-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{getLogIcon(log.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${getLogColor(log.type)}`}>
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1 break-words font-mono whitespace-pre-wrap">
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
