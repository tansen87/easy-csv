import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sendNotification } from "@tauri-apps/plugin-notification";

interface UseAppBootstrapArgs {
  /** XAN Check + Load Settings + Recently Used Files */
  initialize: () => Promise<void>;
  /** Session recovery, returning tabs that require preheating */
  restoreSession: () => Promise<{ id: string }[]>;
  /** Callback after version preheating is completed (such as session. markHydrated) */
  onRestoreComplete?: () => void;
  loadVersions: (tabId: string) => Promise<unknown> | void;
  selectedTabId: string;
  loadCsvData: (
    tabId: string,
    filePath: string,
    customDelimiter?: string,
  ) => Promise<void>;
  importPipelineFromPath: (filePath: string) => void | Promise<void>;
  showRefreshDialog: () => void;
  /** Whether to send a system notification upon completion (setting item) */
  systemNotification: boolean;
  isExecuting: boolean;
  tabs: { id: string; inputFile?: string }[];
  showToastRef: React.RefObject<
    (message: string, type?: "info" | "success" | "warning" | "error") => void
  >;
}

/**
 * App-level bootstrap and global listeners (019 §4.4 useAppBootstrap):
 * startup init + session restore, F12/F5 handling, drag-and-drop file open,
 * system notification on pipeline completion and the window title sync.
 */
export function useAppBootstrap({
  initialize,
  restoreSession,
  onRestoreComplete,
  loadVersions,
  selectedTabId,
  loadCsvData,
  importPipelineFromPath,
  showRefreshDialog,
  systemNotification,
  isExecuting,
  tabs,
  showToastRef,
}: UseAppBootstrapArgs) {
  // Startup: init + session restore + version warm-up
  useEffect(() => {
    const run = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };
    run().finally(() => {
      const restoreAndLoadVersions = async () => {
        const restoredTabs = await restoreSession();
        for (const tab of restoredTabs) {
          await loadVersions(tab.id);
        }
        onRestoreComplete?.();
      };
      restoreAndLoadVersions();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load versions when tab changes
  useEffect(() => {
    if (selectedTabId) {
      loadVersions(selectedTabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTabId]);

  // F12/F5 handling
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.key === "F12") {
        event.preventDefault();
        try {
          await invoke("toggle_devtools");
        } catch (error) {
          console.error("Failed to toggle DevTools:", error);
        }
      }
      if (event.key === "F5") {
        event.preventDefault();
        event.stopPropagation();
        showRefreshDialog();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [showRefreshDialog]);

  // Drag-and-drop file opening
  useEffect(() => {
    const webview = getCurrentWebview();
    let unlisten: (() => void) | undefined;

    const setupDragDrop = async () => {
      unlisten = await webview.onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length > 0) {
            const filePath = paths[0];
            const ext = filePath.split(".").pop()?.toLowerCase();
            if (ext === "xanflow") {
              void importPipelineFromPath(filePath);
            } else {
              void loadCsvData(selectedTabId, filePath);
            }
          }
        }
      });
    };

    setupDragDrop();
    return () => {
      unlisten?.();
    };
  }, [selectedTabId, loadCsvData, importPipelineFromPath]);

  // System notification on pipeline complete
  const prevExecutingRef = useRef(isExecuting);
  useEffect(() => {
    if (prevExecutingRef.current && !isExecuting && systemNotification) {
      const now = new Date();
      const time = now.toLocaleTimeString();
      sendNotification({
        title: "Easy CSV",
        body: `Pipeline execution completed at ${time}`,
      });
    }
    prevExecutingRef.current = isExecuting;
  }, [isExecuting, systemNotification]);

  // Window title
  useEffect(() => {
    const updateTitle = async () => {
      const currentTab = tabs.find((tab) => tab.id === selectedTabId);
      const inputFile = currentTab?.inputFile || "";
      try {
        const title = inputFile ? `${inputFile} - Easy Csv` : "Easy Csv";
        await invoke("set_window_title", { title });
      } catch (error) {
        showToastRef.current(`Failed to set window title: ${error}`, "error");
      }
    };
    updateTitle();
  }, [selectedTabId, tabs, showToastRef]);
}
