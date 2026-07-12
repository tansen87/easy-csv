import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useTheme } from "@/components/setting/ThemeProvider";
import { ToastContainer, ToastType } from "@/components/setting/Toast";
import { CommandList } from "@/components/CommandList";
import { LogPanel } from "@/components/panel/LogPanel";
import { SettingsDialog } from "@/components/setting/SettingsDialog";
import { HomeView } from "@/components/HomeView";
import { HelpDialog } from "@/components/help/HelpDialog";
import { getHelpContent } from "@/components/help/HelpContent";
import { UpdateDialog } from "@/components/dialog/UpdateDialog";
import { ConfirmDialog } from "@/components/dialog/ConfirmDialog";
import { BatchFilterDialog } from "@/components/dialog/BatchFilterDialog";
import { DataProfilePanel } from "@/components/panel/DataProfilePanel";
import { xanCommands } from "@/data/commands";
import { helpDocs, helpDocsZh } from "@/generated/help-docs";
import { MainMenu } from "@/components/menu/MainMenu";
import { MainMenuHooks } from "@/hooks/MainMenuHooks";
import { LanguageProvider, useLanguage } from "@/i18n";
import {
  PipelineStep,
  LogEntry,
  XanCommand,
  PipelineTab,
  HistoricalPipeline,
  PipelineEdge,
} from "@/types/xan";

function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function AppContent() {
  const { theme, setTheme } = useTheme();
  const { language, t } = useLanguage();
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [tabs, setTabs] = useState<PipelineTab[]>([
    {
      id: "tab-1",
      name: "Tab1",
      pipeline: [],
      created: formatDateTime(new Date()),
      updated: formatDateTime(new Date()),
    },
  ]);
  const [selectedTabId, setSelectedTabId] = useState<string>("tab-1");
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [defaultDelimiter, setDefaultDelimiter] = useState<string>(",");
  const [noHeaders, setNoHeaders] = useState<boolean>(false);
  const [systemNotification, setSystemNotification] = useState<boolean>(true);
  const [minimizeToTray, setMinimizeToTray] = useState<boolean>(true);
  const [historyLimit, setHistoryLimit] = useState<number>(100);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [helpContent, setHelpContent] = useState<string>("");
  const [helpCommandName, setHelpCommandName] = useState<string>("");
  const [showLogPanel, setShowLogPanel] = useState<boolean>(false);
  const [showCommandPanel, setShowCommandPanel] = useState<boolean>(false);
  const [historicalPipelines, setHistoricalPipelines] = useState<
    HistoricalPipeline[]
  >([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<
    "commands" | "history"
  >("commands");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toasts, setToasts] = useState<
    { id: string; message: string; type: ToastType }[]
  >([]);
  const [activeMenu, setActiveMenu] = useState<"file" | null>(null);
  const [isMenuActivated, setIsMenuActivated] = useState<boolean>(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(false);
  const [branchProgress, setBranchProgress] = useState<{
    current: number;
    total: number;
    name: string;
    status: "executing" | "completed" | "error";
  } | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState<boolean>(false);
  const [showDataProfile, setShowDataProfile] = useState<boolean>(false);
  const [showRefreshDialog, setShowRefreshDialog] = useState<boolean>(false);
  const [batchFilterDialog, setBatchFilterDialog] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    changelog: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentVersion = "0.2.1";

  // Undo/Redo history state
  const [undoStack, setUndoStack] = useState<
    Array<{
      pipeline: PipelineStep[];
      edges: PipelineEdge[];
      inputPosition?: { x: number; y: number };
    }>
  >([]);
  const [redoStack, setRedoStack] = useState<
    Array<{
      pipeline: PipelineStep[];
      edges: PipelineEdge[];
      inputPosition?: { x: number; y: number };
    }>
  >([]);

  const showToastRef = useRef<(message: string, type: ToastType) => void>(
    () => {},
  );
  const removeToastRef = useRef<(id: string) => void>(() => {});
  const headerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    showToastRef.current = showToast;
    removeToastRef.current = removeToast;
  }, [showToast, removeToast]);

  const isCsvFile = (filePath: string): boolean => {
    const ext = filePath.split(".").pop()?.toLowerCase();
    return ext ? ["csv", "txt", "tsv"].includes(ext) : false;
  };

  // Load CSV file for a specific tab
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
        setShowLogPanel(true);
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
    [defaultDelimiter],
  );

  // 当分割符变化时,自动重新加载当前tab的数据
  useEffect(() => {
    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (currentTab?.inputFile && isCsvFile(currentTab.inputFile)) {
      loadCsvData(selectedTabId, currentTab.inputFile);
    }
  }, [defaultDelimiter, selectedTabId]);

  const loadHistoricalPipelines = async () => {
    try {
      const content = await invoke<string>("load_history");
      const history: HistoricalPipeline[] = JSON.parse(content);

      // Reconstruct full PipelineStep from stored minimal format
      const reconstructed = history.map((item) => ({
        ...item,
        pipeline: item.pipeline
          .map((step: any) => {
            if (step.command) return step;
            const command = xanCommands.find(
              (cmd) => cmd.id === step.commandId,
            );
            if (!command) return null;
            return {
              id: step.id,
              command,
              parameters: step.parameters || {},
              alias: step.alias,
              position: step.position,
            };
          })
          .filter(Boolean),
      }));

      setHistoricalPipelines(reconstructed);
    } catch (error) {
      setHistoricalPipelines([]);
    }
  };

  // Save historical pipelines to file
  const saveHistoricalPipelines = async (history: HistoricalPipeline[]) => {
    try {
      await invoke("save_history", {
        history: JSON.stringify(history, null, 2),
        limit: historyLimit > 0 ? historyLimit : undefined,
      });
    } catch (error) {
      addLog("error", `Failed to save historical pipelines: ${error}`);
    }
  };

  // Update historical pipelines and save to file
  const updateHistoricalPipelines = (newHistory: HistoricalPipeline[]) => {
    setHistoricalPipelines(newHistory);
    saveHistoricalPipelines(newHistory);
  };

  // Recent files management
  const loadRecentFiles = async () => {
    try {
      const content = await invoke<string>("load_recent_files");
      const files = JSON.parse(content);
      setRecentFiles(files);
    } catch (error) {
      setRecentFiles([]);
    }
  };

  const saveRecentFiles = async (files: RecentFile[]) => {
    try {
      await invoke("save_recent_files", {
        recentFiles: JSON.stringify(files, null, 2),
      });
    } catch (error) {
      addLog("error", `Failed to save recent files: ${error}`);
    }
  };

  const loadDefaultDelimiter = async () => {
    try {
      const savedDelimiter = await invoke<string | null>(
        "get_default_delimiter",
      );
      if (savedDelimiter) {
        setDefaultDelimiter(savedDelimiter);
      }
    } catch (error) {
      showToastRef.current(
        `Failed to load default delimiter: ${error}`,
        "error",
      );
    }
  };

  const loadNoHeaders = async () => {
    try {
      const savedNoHeaders = await invoke<boolean | null>("get_no_headers");
      if (savedNoHeaders !== null) {
        setNoHeaders(savedNoHeaders);
      }
    } catch (error) {
      showToastRef.current(
        `Failed to load no headers setting: ${error}`,
        "error",
      );
    }
  };

  const loadSystemNotification = async () => {
    try {
      const saved = await invoke<boolean | null>(
        "get_system_notification",
      );
      if (saved !== null) {
        setSystemNotification(saved);
      }
    } catch (error) {
      showToastRef.current(
        `Failed to load notification setting: ${error}`,
        "error",
      );
    }
  };

  const loadMinimizeToTray = async () => {
    try {
      const saved = await invoke<boolean | null>("get_minimize_to_tray");
      if (saved !== null) {
        setMinimizeToTray(saved);
      }
    } catch (error) {
      showToastRef.current(
        `Failed to load minimize to tray setting: ${error}`,
        "error",
      );
    }
  };

  const loadHistoryLimit = async () => {
    try {
      const saved = await invoke<number | null>("get_history_limit");
      if (saved !== null) {
        setHistoryLimit(saved);
      }
    } catch (error) {
      showToastRef.current(`Failed to load history limit: ${error}`, "error");
    }
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const response = await fetch(
        "https://api.github.com/repos/tansen87/easy-csv/releases/latest",
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON response, got: ${contentType}`);
      }
      const data = await response.json();
      const latestVersionRaw = data.tag_name || "";
      const latestVersion = latestVersionRaw.replace(/^v/, "");
      const changelog = data.body || "";

      const hasUpdate =
        currentVersion && latestVersion && latestVersion !== currentVersion;

      setUpdateInfo({
        hasUpdate,
        latestVersion,
        changelog,
      });
      setShowUpdateDialog(true);
    } catch (error) {
      showToastRef.current(`Failed to check for updates: ${error}`, "error");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await invoke("check_xan_installed");
        await loadDefaultDelimiter();
        await loadNoHeaders();
        await loadSystemNotification();
        await loadMinimizeToTray();
        await loadHistoryLimit();
        await loadHistoricalPipelines();
        await loadRecentFiles();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };

    initializeApp();
  }, []);

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

      // Intercept F5 to show custom refresh dialog
      if (event.key === "F5") {
        event.preventDefault();
        event.stopPropagation();
        setShowRefreshDialog(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

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
              handleImportPipelineFromPath(filePath);
            } else {
              loadCsvData(selectedTabId, filePath);
            }
          }
        }
      });
    };

    setupDragDrop();
    return () => {
      unlisten?.();
    };
  }, [selectedTabId, loadCsvData]);

  // Send system notification when pipeline execution completes
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
  }, [selectedTabId, tabs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeMenu &&
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenu]);

  const getCurrentTab = () => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  };

  const getCurrentPipeline = () => {
    return getCurrentTab().pipeline;
  };

  const {
    undo,
    redo,
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleExportPipeline,
    handleImportPipeline,
    handleExecute,
  } = MainMenuHooks({
    tabs,
    selectedTabId,
    undoStack,
    redoStack,
    historicalPipelines,
    defaultDelimiter,
    setDefaultDelimiter,
    showToast,
    addLog,
    setTabs,
    setSelectedTabId,
    setUndoStack,
    setRedoStack,
    setSelectedStep,
    setIsExecuting,
    setShowLogPanel,
    setShowProgressBar,
    setBranchProgress,
    progressHideTimerRef,
    loadCsvData,
    updateHistoricalPipelines,
    formatDateTime,
  });

  const updateTabPipeline = (
    tabIdOrPipeline: string | PipelineStep[],
    newPipeline?: PipelineStep[],
    edges?: PipelineEdge[],
    inputPosition?: { x: number; y: number },
  ) => {
    // Capture current state for undo (only if not already capturing for redo)
    const currentTab =
      typeof tabIdOrPipeline === "string"
        ? tabs.find((t) => t.id === tabIdOrPipeline)
        : tabs.find((t) => t.id === selectedTabId);

    const newPipelineToSet =
      typeof tabIdOrPipeline === "string"
        ? newPipeline!
        : (tabIdOrPipeline as PipelineStep[]);
    const isStateChanged =
      currentTab &&
      (JSON.stringify(currentTab.pipeline) !==
        JSON.stringify(newPipelineToSet) ||
        JSON.stringify(currentTab.edges) !==
          JSON.stringify(edges ?? currentTab.edges) ||
        JSON.stringify(currentTab.inputPosition) !==
          JSON.stringify(inputPosition ?? currentTab.inputPosition));

    if (currentTab && isStateChanged) {
      setUndoStack((prev) => [
        ...prev,
        {
          pipeline: currentTab.pipeline,
          edges: currentTab.edges || [],
          inputPosition: currentTab.inputPosition,
        },
      ]);
      setRedoStack([]);
    }

    if (typeof tabIdOrPipeline === "string" && newPipeline) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabIdOrPipeline
            ? {
                ...tab,
                pipeline: newPipeline,
                edges: edges !== undefined ? edges : tab.edges,
                inputPosition:
                  inputPosition !== undefined
                    ? inputPosition
                    : tab.inputPosition,
                updatedAt: formatDateTime(new Date()),
              }
            : tab,
        ),
      );
    } else {
      const pipeline = tabIdOrPipeline as PipelineStep[];
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                pipeline: pipeline,
                edges: edges !== undefined ? edges : tab.edges,
                inputPosition:
                  inputPosition !== undefined
                    ? inputPosition
                    : tab.inputPosition,
                updatedAt: formatDateTime(new Date()),
              }
            : tab,
        ),
      );
    }
  };

  const removeTab = (tabId: string) => {
    if (tabs.length === 1) return;

    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));

    if (selectedTabId === tabId) {
      const remainingTab = tabs.find((tab) => tab.id !== tabId);
      if (remainingTab) {
        setSelectedTabId(remainingTab.id);
        setSelectedStep(null);
      }
    }
  };

  const renameTab = (tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, name: newName, updatedAt: formatDateTime(new Date()) }
          : tab,
      ),
    );
  };

  const handleCommandClick = (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => {
    const newStep: PipelineStep = {
      id: `${command.id}-${Date.now()}`,
      command,
      parameters: {},
      alias,
    };

    command.parameters.forEach((param) => {
      if (param.default !== undefined) {
        newStep.parameters[param.name] = param.default;
      }
    });

    if (initialParameters) {
      newStep.parameters = { ...newStep.parameters, ...initialParameters };
    }

    const currentPipeline = getCurrentPipeline();

    updateTabPipeline([...currentPipeline, newStep]);
    setSelectedStep(newStep);
  };

  const handleHelpClick = (command: XanCommand) => {
    setShowHelp(true);
    const docs = language === "zh" ? helpDocsZh : helpDocs;
    const helpText = docs[command.name];
    if (helpText) {
      setHelpContent(helpText);
      setHelpCommandName(command.name);
    } else {
      setHelpContent(`Help not found for command: ${command.name}`);
      setHelpCommandName(command.name);
    }
  };

  const handleStepClick = (step: PipelineStep) => {
    setSelectedStep(step);
  };

  const handleClearInputData = () => {
    if (!selectedTabId) return;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              data: undefined,
              headers: undefined,
              inputFile: undefined,
              updatedAt: formatDateTime(new Date()),
            }
          : tab,
      ),
    );
    setSelectedStep(null);
  };

  const handleStepRemove = (stepId: string | string[]) => {
    const stepIds = Array.isArray(stepId) ? stepId : [stepId];
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    const updatedPipeline = currentPipeline.filter(
      (s) => !stepIds.includes(s.id),
    );
    // 同时移除与被删除步骤相关的边
    const updatedEdges = (currentTab.edges || []).filter(
      (e) => !stepIds.includes(e.source) && !stepIds.includes(e.target),
    );
    updateTabPipeline(updatedPipeline, undefined, updatedEdges);

    // 如果当前选中的步骤在删除列表中,则取消选中
    if (selectedStep?.id && stepIds.includes(selectedStep.id)) {
      setSelectedStep(null);
    }
  };

  const handleStepUpdate = (
    stepId: string,
    parameters: Record<string, any>,
  ) => {
    const currentPipeline = getCurrentPipeline();
    const updatedPipeline = currentPipeline.map((step) =>
      step.id === stepId ? { ...step, parameters } : step,
    );
    updateTabPipeline(updatedPipeline);
    if (selectedStep?.id === stepId) {
      setSelectedStep({ ...selectedStep, parameters });
    }
  };

  const handleStepAliasUpdate = (stepId: string, alias: string) => {
    const currentPipeline = getCurrentPipeline();
    const updatedPipeline = currentPipeline.map((step) =>
      step.id === stepId ? { ...step, alias } : step,
    );
    updateTabPipeline(updatedPipeline);
    if (selectedStep?.id === stepId) {
      setSelectedStep({ ...selectedStep, alias });
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await openUrl(url);
    } catch (error) {
      showToastRef.current(`Failed to open URL: ${error}`, "error");
    }
  };

  const handleImportPipelineFromPath = async (filePath: string) => {
    try {
      const { readFile } = await import("@tauri-apps/plugin-fs");
      const { xanCommands: cmds } = await import("@/data/commands");
      const fileContent = await readFile(filePath);
      const jsonContent = new TextDecoder().decode(fileContent);
      const pipelineData = JSON.parse(jsonContent);

      if (!pipelineData.pipeline || !Array.isArray(pipelineData.pipeline)) {
        showToastRef.current("Invalid pipeline file format", "error");
        return;
      }

      const importedPipeline: PipelineStep[] = pipelineData.pipeline
        .map(
          (stepData: {
            id?: string;
            commandId: string;
            parameters?: Record<string, any>;
            alias?: string;
            position?: { x: number; y: number };
          }) => {
            const command = cmds.find((cmd) => cmd.id === stepData.commandId);
            if (!command) return null;
            return {
              id:
                stepData.id ||
                `${command.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              command,
              parameters: stepData.parameters || {},
              alias: stepData.alias,
              position: stepData.position,
            };
          },
        )
        .filter(
          (step: PipelineStep | null): step is PipelineStep => step !== null,
        );

      if (importedPipeline.length === 0) {
        showToastRef.current(
          "No valid commands found in pipeline file",
          "error",
        );
        return;
      }

      updateTabPipeline(
        importedPipeline,
        undefined,
        pipelineData.edges,
        pipelineData.inputPosition,
      );
      if (pipelineData.inputFile) {
        loadCsvData(
          selectedTabId,
          pipelineData.inputFile,
          pipelineData.defaultDelimiter,
        );
      }

      showToastRef.current(
        `Imported pipeline with ${importedPipeline.length} steps`,
        "success",
      );
    } catch (error) {
      showToastRef.current(`Failed to import pipeline: ${error}`, "error");
    }
  };

  return (
    <>
      {
        <div className="h-screen relative overflow-hidden">
          <header
            ref={headerRef}
            className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 gap-4 z-20"
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Left: Main Menu */}
            <MainMenu
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              isMenuActivated={isMenuActivated}
              setIsMenuActivated={setIsMenuActivated}
              undoStack={undoStack}
              redoStack={redoStack}
              onUndo={undo}
              onRedo={redo}
              onExecute={handleExecute}
              onOpenFile={handleOpenFile}
              onOpenNewTabWithFile={handleOpenNewTabWithFile}
              onSavePipeline={handleSavePipeline}
              onImportPipeline={handleImportPipeline}
              onExportPipeline={handleExportPipeline}
              onHelp={() => {
                setHelpCommandName(language === "zh" ? "帮助" : "Help");
                setHelpContent(getHelpContent(language));
                setShowHelp(true);
              }}
              onCheckUpdate={checkForUpdates}
              onShowSettings={() => setShowSettingsDialog(true)}
              isExecuting={isExecuting}
              isCheckingUpdate={isCheckingUpdate}
              currentPipelineLength={getCurrentPipeline().length}
              showCommandPanel={showCommandPanel}
              onToggleCommandPanel={() =>
                setShowCommandPanel(!showCommandPanel)
              }
              showLogPanel={showLogPanel}
              onToggleLogPanel={() => setShowLogPanel(!showLogPanel)}
              showDataProfile={showDataProfile}
              onToggleDataProfile={() => setShowDataProfile(!showDataProfile)}
              hasInputFile={!!getCurrentTab()?.inputFile}
            />
          </header>

          <main className="absolute inset-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <HomeView
                tabs={tabs}
                selectedTabId={selectedTabId}
                onTabChange={setSelectedTabId}
                onRemoveTab={removeTab}
                onRenameTab={renameTab}
                onAddCommand={handleCommandClick}
                onStepClick={handleStepClick}
                onStepUpdate={handleStepUpdate}
                onStepAliasUpdate={handleStepAliasUpdate}
                onStepDelete={handleStepRemove}
                onTableDelete={handleClearInputData}
                onPipelineReorder={updateTabPipeline}
                onEdgesChange={(tabId, edges) => {
                  setTabs((prev) =>
                    prev.map((tab) =>
                      tab.id === tabId
                        ? {
                            ...tab,
                            edges,
                            updatedAt: formatDateTime(new Date()),
                          }
                        : tab,
                    ),
                  );
                }}
                onInputPositionChange={(tabId, position) => {
                  setTabs((prev) =>
                    prev.map((tab) =>
                      tab.id === tabId
                        ? {
                            ...tab,
                            inputPosition: position,
                            updatedAt: formatDateTime(new Date()),
                          }
                        : tab,
                    ),
                  );
                }}
                onOpenFile={handleOpenFile}
                onImportPipeline={handleImportPipeline}
                onOpenBatchFilter={(x, y) => setBatchFilterDialog({ x, y })}
                onOpenUrl={handleOpenUrl}
                branchProgress={branchProgress}
                showProgressBar={showProgressBar}
                recentFiles={recentFiles}
                onOpenRecentFile={(filePath) =>
                  loadCsvData(selectedTabId, filePath)
                }
              />
            </div>
          </main>

          {/* Floating Command Panel */}
          <CommandList
            commands={xanCommands}
            onCommandClick={handleCommandClick}
            onHelpClick={handleHelpClick}
            selectedCommandId={selectedStep?.command.id}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isVisible={showCommandPanel}
            onClose={() => setShowCommandPanel(false)}
            activePanel={activeLeftPanel}
            onActivePanelChange={setActiveLeftPanel}
            historicalPipelines={historicalPipelines}
            onNewTabFromHistory={(history) => {
              const newTabId = `tab-${Date.now()}`;
              const newTab: PipelineTab = {
                id: newTabId,
                name: `${history.name}`,
                pipeline: history.pipeline,
                edges: history.edges || [],
                inputPosition: history.inputPosition,
                inputFile: history.inputFile,
                defaultDelimiter: history.defaultDelimiter,
                created: formatDateTime(new Date()),
                updated: formatDateTime(new Date()),
              };
              setTabs((prev) => [...prev, newTab]);
              setSelectedTabId(newTabId);

              if (history.inputFile) {
                loadCsvData(newTabId, history.inputFile);
              }
              if (history.defaultDelimiter) {
                setDefaultDelimiter(history.defaultDelimiter);
              }
            }}
            onDeleteHistory={(history) => {
              const updatedHistory = historicalPipelines.filter(
                (h) => h.id !== history.id,
              );
              updateHistoricalPipelines(updatedHistory);
            }}
          />

          <LogPanel
            logs={logs}
            onClear={handleClearLogs}
            isVisible={showLogPanel}
            onClose={() => setShowLogPanel(false)}
          />

          <HelpDialog
            isOpen={showHelp}
            onClose={() => setShowHelp(false)}
            commandName={helpCommandName}
            content={helpContent}
          />

          <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />

          <SettingsDialog
            isOpen={showSettingsDialog}
            onClose={() => setShowSettingsDialog(false)}
            theme={theme}
            onThemeChange={setTheme}
            defaultDelimiter={defaultDelimiter}
            onDefaultDelimiterChange={setDefaultDelimiter}
            noHeaders={noHeaders}
            onNoHeadersChange={setNoHeaders}
            systemNotification={systemNotification}
            onSystemNotificationChange={setSystemNotification}
            minimizeToTray={minimizeToTray}
            onMinimizeToTrayChange={setMinimizeToTray}
            historyLimit={historyLimit}
            onHistoryLimitChange={setHistoryLimit}
            onSave={async () => {
              try {
                await invoke("set_default_delimiter", {
                  delimiter: defaultDelimiter,
                });
                await invoke("set_no_headers", { noHeaders });
                await invoke("set_system_notification", {
                  show: systemNotification,
                });
                await invoke("set_minimize_to_tray", {
                  minimize: minimizeToTray,
                });
                await invoke("set_history_limit", { limit: historyLimit });
                showToastRef.current("Settings saved successfully", "success");
              } catch (error) {
                showToastRef.current(
                  `Failed to save settings: ${error}`,
                  "error",
                );
              }
            }}
          />

          <UpdateDialog
            isOpen={showUpdateDialog}
            onClose={() => setShowUpdateDialog(false)}
            updateInfo={updateInfo}
            currentVersion={currentVersion}
          />

          <ConfirmDialog
            isOpen={showRefreshDialog}
            title={t.refreshTitle}
            message={t.refreshMessage}
            onConfirm={() => {
              setShowRefreshDialog(false);
              window.location.reload();
            }}
            onCancel={() => setShowRefreshDialog(false)}
          />

          {batchFilterDialog && (
            <BatchFilterDialog
              state={batchFilterDialog}
              headers={getCurrentTab()?.headers || []}
              onAddCommand={handleCommandClick}
              onClose={() => setBatchFilterDialog(null)}
            />
          )}

          <DataProfilePanel
            filePath={getCurrentTab()?.inputFile || ""}
            delimiter={defaultDelimiter}
            isVisible={showDataProfile}
            onClose={() => setShowDataProfile(false)}
          />
        </div>
      }
    </>
  );
}

export default App;
