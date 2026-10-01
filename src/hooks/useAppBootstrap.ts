import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sendNotification } from "@tauri-apps/plugin-notification";
import type { RunSession } from "@/types/execution";

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
  tabs: { id: string; inputFile?: string }[];
  showToastRef: React.RefObject<
    (message: string, type?: "info" | "success" | "warning" | "error") => void
  >;
}

/**
 * App-level bootstrap and global listeners (useAppBootstrap):
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

/**
 * System notification per finished run.
 *
 * Driven by each run's own state transition rather than a global "is anything
 * executing" falling edge: with several tabs running at once, the old global
 * boolean would miss finishes or report them for the wrong tab. The tab name is
 * included so the user knows which one is done.
 */
export function useRunCompletionNotification(
  runs: Record<string, RunSession>,
  enabled: boolean,
  tabs: { id: string; name: string }[],
) {
  const prevRunsRef = useRef<Record<string, RunSession>>(runs);

  useEffect(() => {
    if (enabled) {
      for (const session of Object.values(runs)) {
        const prev = prevRunsRef.current[session.tabId];
        const wasActive =
          prev?.state === "running" || prev?.state === "preparing";
        const isFinished =
          session.state === "done" ||
          session.state === "error" ||
          session.state === "cancelled";
        if (!wasActive || !isFinished) continue;
        const tab = tabs.find((item) => item.id === session.tabId);
        const name = tab?.name ?? "Pipeline";
        sendNotification({
          title: "Easy CSV",
          body: `${name} execution completed at ${new Date().toLocaleTimeString()}`,
        });
      }
    }
    prevRunsRef.current = runs;
  }, [runs, enabled, tabs]);
}
