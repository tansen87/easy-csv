import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/setting/ThemeProvider";
import { ToastContainer, ToastType } from "@/components/setting/Toast";
import { NotificationPanel, NotificationType } from "@/components/setting/PersistentNotification";
import {
  Terminal,
  ChevronUp,
  ChevronRight,
  Map as MapIcon,
  ChevronDown,
  FileText,
  CloudDownload,
  RefreshCw,
  Settings,
} from "lucide-react";
import { CommandList } from "@/components/CommandList";
import { LogPanel } from "@/components/panel/LogPanel";
import { SettingsDialog } from "@/components/setting/SettingsDialog";
import { HomeView } from "@/components/HomeView";
import { HelpDialog } from "@/components/help/HelpDialog";
import { UpdateDialog } from "@/components/dialog/UpdateDialog";
import { xanCommands } from "@/data/commands";
import { helpDocs } from "@/generated/help-docs";
import { MainMenu } from "@/components/menu/MainMenu";
import { MainMenuHooks } from "@/hooks/MainMenuHooks";
import { SplashScreen } from "@/components/help/SplashScreen";
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

function App() {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>("Initializing...");
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
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [helpContent, setHelpContent] = useState<string>("");
  const [helpCommandName, setHelpCommandName] = useState<string>("");
  const [showLogPanel, setShowLogPanel] = useState<boolean>(false);
  const [showCommandPanel, setShowCommandPanel] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [historicalPipelines, setHistoricalPipelines] = useState<
    HistoricalPipeline[]
  >([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<
    "commands" | "history"
  >("commands");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; message: string; type: NotificationType }[]>([]);
  const [activeMenu, setActiveMenu] = useState<"file" | null>(null);
  const [isMenuActivated, setIsMenuActivated] = useState<boolean>(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(false);
  const [branchProgress, setBranchProgress] = useState<{ current: number; total: number; name: string; status: "executing" | "completed" | "error" } | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    changelog: string;
  } | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentVersion = "0.1.0";

  // Undo/Redo history state
  const [undoStack, setUndoStack] = useState<Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>>([]);

  const showToastRef = useRef<(message: string, type: ToastType) => void>(() => { });
  const removeToastRef = useRef<(id: string) => void>(() => { });
  const addNotificationRef = useRef<(message: string, type: NotificationType) => void>(() => { });
  const removeNotificationRef = useRef<(id: string) => void>(() => { });
  const headerRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addNotification = useCallback((message: string, type: NotificationType = "info") => {
    setNotifications((prev) => {
      // Check if notification with same message already exists
      if (prev.some(n => n.message === message)) {
        return prev;
      }
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return [...prev, { id, message, type }];
    });
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    showToastRef.current = showToast;
    removeToastRef.current = removeToast;
    addNotificationRef.current = addNotification;
    removeNotificationRef.current = removeNotification;
  }, [showToast, removeToast, addNotification, removeNotification]);

  const isCsvFile = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? ['csv', 'txt', 'tsv'].includes(ext) : false;
  };

  // Load CSV file for a specific tab
  const loadCsvData = useCallback(
    async (tabId: string, filePath: string, customDelimiter?: string) => {
      if (!filePath) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? { ...tab, data: [], headers: [], inputFile: "", updatedAt: formatDateTime(new Date()) }
              : tab,
          ),
        );
        return;
      }

      if (!isCsvFile(filePath)) {
        const ext = filePath.split('.').pop();
        addLog("info", `Non-CSV file selected. Use "from" command in Flow panel to convert ${ext} to CSV.`);
        setShowLogPanel(true);
        // Set the inputFile even for non-CSV files so the UI doesn't show empty state
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId
              ? { ...tab, inputFile: filePath, updatedAt: formatDateTime(new Date()) }
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
              ? { ...tab, data: data.rows, headers: data.headers, inputFile: filePath, updatedAt: formatDateTime(new Date()) }
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
    const currentTab = tabs.find(t => t.id === selectedTabId);
    if (currentTab?.inputFile && isCsvFile(currentTab.inputFile)) {
      loadCsvData(selectedTabId, currentTab.inputFile);
    }
  }, [defaultDelimiter, selectedTabId]);

  const loadHistoricalPipelines = async () => {
    try {
      const content = await invoke<string>("load_history");
      const history = JSON.parse(content);
      setHistoricalPipelines(history);
    } catch (error) {
      setHistoricalPipelines([]);
    }
  };

  // Save historical pipelines to file
  const saveHistoricalPipelines = async (history: HistoricalPipeline[]) => {
    try {
      await invoke("save_history", {
        history: JSON.stringify(history, null, 2),
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

  const loadDefaultDelimiter = async () => {
    try {
      const savedDelimiter = await invoke<string | null>(
        "get_default_delimiter",
      );
      if (savedDelimiter) {
        setDefaultDelimiter(savedDelimiter);
      }
    } catch (error) {
      showToastRef.current(`Failed to load default delimiter: ${error}`, 'error');
    }
  };

  const loadNoHeaders = async () => {
    try {
      const savedNoHeaders = await invoke<boolean | null>("get_no_headers");
      if (savedNoHeaders !== null) {
        setNoHeaders(savedNoHeaders);
      }
    } catch (error) {
      showToastRef.current(`Failed to load no headers setting: ${error}`, 'error');
    }
  };

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    try {
      const response = await fetch("https://api.github.com/repos/tansen87/easy-csv/releases/latest");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got: ${contentType}`);
      }
      const data = await response.json();
      const latestVersionRaw = data.tag_name || "";
      const latestVersion = latestVersionRaw.replace(/^v/, "");
      const changelog = data.body || "";

      const hasUpdate = currentVersion && latestVersion && latestVersion !== currentVersion;

      setUpdateInfo({
        hasUpdate,
        latestVersion,
        changelog,
      });
      setShowUpdateDialog(true);
    } catch (error) {
      showToastRef.current(`Failed to check for updates: ${error}`, 'error');
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
        setLoadingText("Loading configuration...");
        await invoke("check_xan_installed");
        await loadDefaultDelimiter();
        await loadNoHeaders();
        await loadHistoricalPipelines();
        setIsLoading(false);
      } catch (error) {
        console.error("Initialization failed:", error);
        setIsLoading(false);
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const updateTitle = async () => {
      const currentTab = tabs.find((tab) => tab.id === selectedTabId);
      const inputFile = currentTab?.inputFile || "";
      try {
        const title = inputFile ? `${inputFile} - Easy Csv` : "Easy Csv";
        await invoke("set_window_title", { title });
      } catch (error) {
        showToastRef.current(`Failed to set window title: ${error}`, 'error');
      }
    };
    updateTitle();
  }, [selectedTabId, tabs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenu && headerRef.current && !headerRef.current.contains(event.target as Node)) {
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

  const updateTabPipeline = (tabIdOrPipeline: string | PipelineStep[], newPipeline?: PipelineStep[], edges?: PipelineEdge[], inputPosition?: { x: number; y: number }) => {
    // Capture current state for undo (only if not already capturing for redo)
    const currentTab = typeof tabIdOrPipeline === 'string'
      ? tabs.find(t => t.id === tabIdOrPipeline)
      : tabs.find(t => t.id === selectedTabId);

    const newPipelineToSet = typeof tabIdOrPipeline === 'string' ? newPipeline! : tabIdOrPipeline as PipelineStep[];
    const isStateChanged = currentTab &&
      (JSON.stringify(currentTab.pipeline) !== JSON.stringify(newPipelineToSet) ||
        JSON.stringify(currentTab.edges) !== JSON.stringify(edges ?? currentTab.edges) ||
        JSON.stringify(currentTab.inputPosition) !== JSON.stringify(inputPosition ?? currentTab.inputPosition));

    if (currentTab && isStateChanged) {
      setUndoStack(prev => [...prev, {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition
      }]);
      setRedoStack([]);
    }

    if (typeof tabIdOrPipeline === 'string' && newPipeline) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabIdOrPipeline
            ? {
              ...tab,
              pipeline: newPipeline,
              edges: edges !== undefined ? edges : tab.edges,
              inputPosition: inputPosition !== undefined ? inputPosition : tab.inputPosition,
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
              inputPosition: inputPosition !== undefined ? inputPosition : tab.inputPosition,
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

  // Validate output step placement
  const validateOutputStepOnAdd = (currentPipeline: PipelineStep[]) => {
    // Build execution branches to check output placement
    const executableSteps = currentPipeline.filter(step => step.command.id !== "output");
    if (executableSteps.length === 0) {
      addNotificationRef.current("Output requires at least one other step before it", 'warning');
    }
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

    // Validate output step placement
    if (command.id === "output") {
      validateOutputStepOnAdd(currentPipeline);
    }

    updateTabPipeline([...currentPipeline, newStep]);
    setSelectedStep(newStep);
  };

  const handleHelpClick = (command: XanCommand) => {
    setShowHelp(true);
    const helpText = helpDocs[command.name];
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

  const handleStepRemove = (stepId: string) => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    const removedStep = currentPipeline.find(s => s.id === stepId);

    // If removing an output step, clear all output-related notifications
    if (removedStep?.command.id === "output") {
      setNotifications((prev) =>
        prev.filter(n => !n.message.startsWith("Output"))
      );
    }

    const updatedPipeline = currentPipeline.filter((s) => s.id !== stepId);
    // Also remove edges connected to the removed step
    const updatedEdges = (currentTab.edges || []).filter(
      (e) => e.source !== stepId && e.target !== stepId
    );
    updateTabPipeline(updatedPipeline, undefined, updatedEdges);
    if (selectedStep?.id === stepId) {
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
      showToastRef.current(`Failed to open URL: ${error}`, 'error');
    }
  };

  return (
    <>
      {isLoading ? (
        <SplashScreen loadingText={loadingText} />
      ) : (
        <div className="h-screen relative overflow-hidden">
          <header ref={headerRef} className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 gap-4 z-20" onContextMenu={(e) => e.preventDefault()}>
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
              isExecuting={isExecuting}
              currentPipelineLength={getCurrentPipeline().length}
            />

            {/* Center: Empty */}
            <div className="flex-1" />

            <div className="flex items-center rounded-md p-0.5">
              <button
                onClick={checkForUpdates}
                disabled={isCheckingUpdate}
                className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isCheckingUpdate
                  ? "text-primary opacity-70"
                  : "text-primary hover:bg-primary/10"
                  }`}
              >
                {isCheckingUpdate ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudDownload className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => setShowSettingsDialog(true)}
                className="flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
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
                onPipelineReorder={updateTabPipeline}
                onEdgesChange={(tabId, edges) => {
                  // Validate output connections when edges change
                  const tab = tabs.find(t => t.id === tabId);
                  if (tab) {
                    // Remove all output-related notifications first
                    setNotifications((prev) =>
                      prev.filter(n => !n.message.startsWith("Output"))
                    );

                    const outputSteps = tab.pipeline.filter(s => s.command.id === "output");
                    outputSteps.forEach(outputStep => {
                      // Check if output is connected as source (wrong direction)
                      const outputAsSource = edges.filter(e => e.source === outputStep.id);
                      if (outputAsSource.length > 0) {
                        addNotificationRef.current("Output should be at the end of a branch", 'error');
                      }
                      // Check if output has no incoming connections and no outgoing connections
                      const outputAsTarget = edges.filter(e => e.target === outputStep.id);
                      if (outputAsTarget.length === 0 && outputAsSource.length === 0) {
                        addNotificationRef.current("Output is not connected", 'warning');
                      }
                    });
                  }

                  setTabs((prev) =>
                    prev.map((tab) =>
                      tab.id === tabId
                        ? { ...tab, edges, updatedAt: formatDateTime(new Date()) }
                        : tab,
                    ),
                  );
                }}
                onInputPositionChange={(tabId, position) => {
                  setTabs((prev) =>
                    prev.map((tab) =>
                      tab.id === tabId
                        ? { ...tab, inputPosition: position, updatedAt: formatDateTime(new Date()) }
                        : tab,
                    ),
                  );
                }}
                onOpenFile={handleOpenFile}
                onImportPipeline={handleImportPipeline}
                onOpenUrl={handleOpenUrl}
                showMinimap={showMinimap}
                branchProgress={branchProgress}
                showProgressBar={showProgressBar}
              />
            </div>
          </main>

          {/* Command Panel Toggle Button */}
          <Button
            onClick={() => setShowCommandPanel(!showCommandPanel)}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed bottom-4 left-4 z-30 h-10 w-10 rounded-full shadow-md"
            variant="ghost"
            size="icon"
          >
            {showCommandPanel ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <Terminal className="h-4 w-4" />
            )}
          </Button>

          {/* Log Panel Toggle Button */}
          <Button
            onClick={() => setShowLogPanel(!showLogPanel)}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed bottom-4 left-16 z-30 h-10 w-10 rounded-full shadow-md"
            variant="ghost"
            size="icon"
          >
            {showLogPanel ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>

          {/* Minimap Toggle Button */}
          <Button
            onClick={() => setShowMinimap(!showMinimap)}
            onContextMenu={(e) => e.preventDefault()}
            className="fixed bottom-4 left-28 z-30 h-10 w-10 rounded-full shadow-md"
            variant="ghost"
            size="icon"
          >
            {showMinimap ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <MapIcon className="h-4 w-4" />
            )}
          </Button>

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
              const updatedHistory = historicalPipelines.filter((h) => h.id !== history.id);
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
          <NotificationPanel notifications={notifications} onDismiss={removeNotificationRef.current} onDismissAll={dismissAllNotifications} />

          <SettingsDialog
            isOpen={showSettingsDialog}
            onClose={() => setShowSettingsDialog(false)}
            theme={theme}
            onThemeChange={setTheme}
            defaultDelimiter={defaultDelimiter}
            onDefaultDelimiterChange={setDefaultDelimiter}
            noHeaders={noHeaders}
            onNoHeadersChange={setNoHeaders}
            onSave={async () => {
              try {
                await invoke("set_default_delimiter", { delimiter: defaultDelimiter });
                await invoke("set_no_headers", { noHeaders });
                showToastRef.current("Settings saved successfully", 'success');
              } catch (error) {
                showToastRef.current(`Failed to save settings: ${error}`, 'error');
              }
            }}
          />

          <UpdateDialog
            isOpen={showUpdateDialog}
            onClose={() => setShowUpdateDialog(false)}
            updateInfo={updateInfo}
            currentVersion={currentVersion}
          />
        </div>
      )}
    </>
  );
}

export default App;
