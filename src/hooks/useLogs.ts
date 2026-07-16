import { useState, useCallback } from "react";
import { LogEntry } from "@/types/xan";

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, addLog, clearLogs };
}
