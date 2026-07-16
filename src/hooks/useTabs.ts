import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PipelineTab } from "@/types/xan";
import { formatDateTime } from "@/utils/format";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

function isCsvFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase();
  return ext ? ["csv", "txt", "tsv"].includes(ext) : false;
}

export function useTabs(
  defaultDelimiter: string,
  addLog: (
    type: "info" | "success" | "error" | "warning",
    message: string,
  ) => void,
) {
  const [tabs, setTabs] = useState<PipelineTab[]>([
    {
      id: "tab-1",
      name: "Tab1",
      pipeline: [],
      created: formatDateTime(new Date()),
      updated: formatDateTime(new Date()),
    },
  ]);
  const [selectedTabId, setSelectedTabId] = useState("tab-1");
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const getCurrentTab = useCallback(() => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  }, [tabs, selectedTabId]);

  const getCurrentPipeline = useCallback(() => {
    return getCurrentTab().pipeline;
  }, [getCurrentTab]);

  const addTab = useCallback(() => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: PipelineTab = {
      id: newTabId,
      name: `Tab${tabs.length + 1}`,
      pipeline: [],
      created: formatDateTime(new Date()),
      updated: formatDateTime(new Date()),
    };
    setTabs((prev) => [...prev, newTab]);
    setSelectedTabId(newTabId);
    return newTabId;
  }, [tabs.length]);

  const removeTab = useCallback(
    (tabId: string) => {
      if (tabs.length === 1) return;
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    },
    [tabs.length],
  );

  const renameTab = useCallback((tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, name: newName, updatedAt: formatDateTime(new Date()) }
          : tab,
      ),
    );
  }, []);

  const saveRecentFiles = useCallback(
    async (files: RecentFile[]) => {
      try {
        await invoke("save_recent_files", {
          recentFiles: JSON.stringify(files, null, 2),
        });
      } catch (error) {
        addLog("error", `Failed to save recent files: ${error}`);
      }
    },
    [addLog],
  );

  const loadRecentFiles = useCallback(async () => {
    try {
      const content = await invoke<string>("load_recent_files");
      const files = JSON.parse(content);
      setRecentFiles(files);
    } catch (error) {
      setRecentFiles([]);
    }
  }, []);

  const loadCsvData = useCallback(
    async (tabId: string, filePath: string, customDelimiter?: string) => {
      if (!filePath) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  data: [],
                  headers: [],
                  inputFile: "",
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
        return;
      }

      // Add to recent files
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      setRecentFiles((prev) => {
        const updated = [
          {
            path: filePath,
            name: fileName,
            openedAt: formatDateTime(new Date()),
          },
          ...prev.filter((f) => f.path !== filePath),
        ].slice(0, 10);
        saveRecentFiles(updated);
        return updated;
      });

      if (!isCsvFile(filePath)) {
        const ext = filePath.split(".").pop();
        addLog(
          "info",
          `Non-CSV file selected. Use "from" command in Flow panel to convert ${ext} to CSV.`,
        );
        // Set the inputFile even for non-CSV files so the UI doesn't show empty state
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  inputFile: filePath,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
        return;
      }

      try {
        const data = await invoke<{ headers: string[]; rows: string[][] }>(
          "read_csv_file",
          {
            filePath,
            delimiter: customDelimiter || defaultDelimiter,
            limit: 31,
          },
        );
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  data: data.rows,
                  headers: data.headers,
                  inputFile: filePath,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      } catch (error) {
        addLog("error", `Failed to read CSV: ${error}`);
      }
    },
    [defaultDelimiter, addLog, saveRecentFiles],
  );

  // 当分割符变化时,自动重新加载当前tab的数据
  const defaultDelimiterRef = useRef(defaultDelimiter);
  defaultDelimiterRef.current = defaultDelimiter;

  useEffect(() => {
    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (currentTab?.inputFile && isCsvFile(currentTab.inputFile)) {
      loadCsvData(selectedTabId, currentTab.inputFile);
    }
  }, [defaultDelimiter, selectedTabId]);

  // 初始化时加载最近文件
  useEffect(() => {
    loadRecentFiles();
  }, []);

  // 自动选中第一个 tab
  useEffect(() => {
    if (tabs.length > 0 && !tabs.find((t) => t.id === selectedTabId)) {
      setSelectedTabId(tabs[0].id);
    }
  }, [tabs, selectedTabId]);

  return {
    tabs,
    setTabs,
    selectedTabId,
    setSelectedTabId,
    recentFiles,
    setRecentFiles,
    getCurrentTab,
    getCurrentPipeline,
    addTab,
    removeTab,
    renameTab,
    loadCsvData,
    loadRecentFiles,
  };
}
