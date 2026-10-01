import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DuckdbTableInfo, PipelineTab, TabularReadResult } from "@/types/xan";
import { formatDateTime } from "@/utils/format";
import {
  detectTabularFormat,
  duckdbTableName,
  listDuckdbTables,
} from "@/utils/fileFormat";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

export function useTabs(
  defaultDelimiter: string,
  addLog: (
    type: "info" | "success" | "error" | "warning",
    message: string,
  ) => void,
  /**
   * The delimiter master switch (settings page). `true` detects the delimiter
   * of every opened file; `false` reads every file with `defaultDelimiter`.
   * Shared with the input node's badge, so both sides stay in sync.
   */
  autoDetectDelimiter = true,
  /**
   * Injected `.duckdb` table picker: called when the database
   * holds several tables, so the hook stays UI-free and testable. Return
   * `null` to abort the open.
   */
  requestTableSelection?: (
    filePath: string,
    tables: DuckdbTableInfo[],
  ) => Promise<string | null>,
  /**
   * Surface open failures of tabular (non-CSV) inputs to the user, e.g. a
   * toast — `addLog` alone leaves the welcome page up with no visible
   * feedback. The backend's "DuckDB plugin is required" message gets
   * localized by the caller.
   */
  onOpenError?: (message: string) => void,
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
      console.log(error);
    }
  }, []);

  /**
   * Read a CSV file into a tab.
   *
   * The delimiter comes from the app-wide mode: auto-detected when the
   * auto-detection switch is on, otherwise the configured delimiter.
   * `forcedDelimiter` is a one-shot override carried in by an imported pipeline
   * or template (that read only — the next reload follows the global mode
   * again).
   */
  const loadCsvData = useCallback(
    async (tabId: string, filePath: string, forcedDelimiter?: string) => {
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

      const format = detectTabularFormat(filePath);
      if (!format) {
        const ext = filePath.split(".").pop();
        addLog(
          "info",
          `Non-tabular file selected. Use "from" command in Flow panel to convert ${ext} to CSV.`,
        );
        // Set the inputFile even for unknown files so the UI doesn't show empty state
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  inputFile: filePath,
                  inputFormat: undefined,
                  sourceTable: undefined,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
        return;
      }

      // A `.duckdb` database must be read through a concrete table: a
      // single table is picked automatically, several ones ask via the
      // injected callback.
      let sourceTable: string | undefined;
      if (format === "duckdb") {
        let tables: DuckdbTableInfo[];
        try {
          tables = await listDuckdbTables(filePath);
        } catch (error) {
          const message = `Failed to open DuckDB database: ${error}`;
          addLog("error", message);
          onOpenError?.(String(error));
          return;
        }
        if (tables.length === 0) {
          const message = `No tables found in ${fileName}`;
          addLog("error", message);
          onOpenError?.(message);
          return;
        }
        if (tables.length === 1) {
          sourceTable = duckdbTableName(tables[0]);
        } else if (requestTableSelection) {
          const picked = await requestTableSelection(filePath, tables);
          if (!picked) return;
          sourceTable = picked;
        } else {
          addLog(
            "error",
            `Multiple tables found in ${fileName}; please choose one.`,
          );
          return;
        }
      }

      // An explicit argument (import / template) wins for this read; otherwise
      // the global mode decides: detect, or lock to the configured delimiter.
      const explicit = forcedDelimiter?.trim() ? forcedDelimiter : undefined;
      const locked =
        explicit ?? (autoDetectDelimiter ? undefined : defaultDelimiter);

      try {
        const data = await invoke<TabularReadResult>("read_tabular_file", {
          filePath,
          table: format === "duckdb" ? (sourceTable ?? null) : null,
          delimiter: locked ?? null,
          fallbackDelimiter: defaultDelimiter,
          limit: 31,
        });
        const resolvedDelimiter = data.delimiter || locked || defaultDelimiter;
        const isCsv = data.format === "csv";
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? {
                  ...tab,
                  data: data.rows,
                  headers: data.headers,
                  inputFile: filePath,
                  inputFormat: data.format,
                  sourceTable: data.source_table ?? sourceTable,
                  // Delimiter bookkeeping is a CSV-only concept.
                  defaultDelimiter: isCsv ? resolvedDelimiter : undefined,
                  delimiterSource: isCsv ? data.delimiter_source : undefined,
                  delimiterConfidence: isCsv
                    ? data.delimiter_confidence
                    : undefined,
                  delimiterMode: isCsv ? (locked ?? "auto") : undefined,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      } catch (error) {
        const message = `Failed to read ${format} file: ${error}`;
        addLog("error", message);
        // CSV failures keep the log-only behaviour; tabular opens must be visible.
        if (format !== "csv") {
          onOpenError?.(String(error));
        }
      }
    },
    [
      defaultDelimiter,
      autoDetectDelimiter,
      addLog,
      saveRecentFiles,
      requestTableSelection,
      onOpenError,
    ],
  );

  // Reload the current tab's data when the app-wide delimiter mode changes
  // (either from the settings page or from the input node's badge) or when the
  // selected tab changes. Both controls edit the same state, so every tab
  // follows it: no per-tab divergence to reconcile. Delimiters are a CSV-only
  // concept, so non-CSV tabs (parquet / duckdb) are never re-read here.
  useEffect(() => {
    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (
      !currentTab?.inputFile ||
      detectTabularFormat(currentTab.inputFile) !== "csv"
    )
      return;
    loadCsvData(selectedTabId, currentTab.inputFile);
  }, [defaultDelimiter, autoDetectDelimiter, selectedTabId]);

  // Load recent files during initialization
  useEffect(() => {
    loadRecentFiles();
  }, []);

  // Automatically select the first tab
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
