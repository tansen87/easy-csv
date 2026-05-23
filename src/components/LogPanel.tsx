import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/ui/resize-handle";
import { Trash2, Info, CheckCircle, AlertCircle, XCircle, TextQuote, Table, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { LogEntry } from "@/types/xan";

interface LogPanelProps {
  logs: LogEntry[];
  resultData: string | null;
  onClear: () => void;
  initialActiveTab?: "logs" | "result";
  executeTarget?: "result" | "logs";
}

export function LogPanel({ logs, resultData, onClear, initialActiveTab = "logs", executeTarget }: LogPanelProps) {
  const [height, setHeight] = useState<number>(50);
  const [activeTab, setActiveTab] = useState<"logs" | "result">(initialActiveTab);

  useEffect(() => {
    if (resultData) {
      setActiveTab("result");
    } else if (executeTarget === "logs") {
      setActiveTab("logs");
    }
  }, [resultData, executeTarget]);

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

  // Parse CSV result into table data
  const parseCsv = (csv: string) => {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return { headers: [], rows: [] };
    
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
    
    return { headers, rows };
  };

  const csvData = resultData ? parseCsv(resultData) : null;

  return (
    <div style={{ height: `${height}%` }} className="relative flex flex-col bg-gradient-to-b from-background to-muted/10 border-t border-border/50 min-h-[100px]">
      <ResizeHandle
        direction="vertical"
        onResize={handleResize}
        className="absolute -top-1 left-0 right-0 z-10"
      />
      <div className="p-1 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "logs"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                <FileText className="h-3.5 w-3.5" />
                Logs ({logs.length})
              </button>
              <button
                onClick={() => setActiveTab("result")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === "result"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                <Table className="h-3.5 w-3.5" />
                Result
              </button>
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
      </div>
      <ScrollArea className="flex-1">
        {activeTab === "logs" ? (
          <div className="p-3">
            {logs.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                  <TextQuote className="h-8 w-8 text-muted-foreground/50" />
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
        ) : (
          <div className="p-3">
            {!resultData ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                  <Table className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1">No result data</p>
                <p className="text-xs text-muted-foreground/70">
                  Execute a pipeline to see results
                </p>
              </div>
            ) : csvData && csvData.headers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {csvData.headers.map((header, index) => (
                        <th key={index} className="px-3 py-2 text-left font-semibold text-muted-foreground bg-muted/30">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border/30 hover:bg-muted/20">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2 font-mono text-sm">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.rows.length === 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No rows in result
                  </div>
                )}
              </div>
            ) : (
              <div className="font-mono text-sm whitespace-pre-wrap break-all">
                {resultData}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}