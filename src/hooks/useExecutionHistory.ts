import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExecutionHistoryEntry, ExecutionHistoryInput } from "@/types/xan";

const HISTORY_LIMIT = 100;

/** F6: persisted execution history access (SQLite via Tauri commands). */
export function useExecutionHistory() {
  const [history, setHistory] = useState<ExecutionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const content = await invoke<string>("load_execution_history", {
        limit: HISTORY_LIMIT,
      });
      setHistory(JSON.parse(content));
    } catch (error) {
      console.error("Failed to load execution history:", error);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveEntry = useCallback(async (entry: ExecutionHistoryInput) => {
    try {
      await invoke("save_execution_history", {
        entry: JSON.stringify(entry),
      });
    } catch (error) {
      console.error("Failed to save execution history:", error);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    try {
      await invoke("clear_execution_history");
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear execution history:", error);
      throw error;
    }
  }, []);

  return { history, loading, loadHistory, saveEntry, clearHistory };
}
