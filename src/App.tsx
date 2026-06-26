import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/components/ThemeProvider";
import { ToastContainer, ToastType } from "@/components/Toast";
import { NotificationPanel, NotificationType } from "@/components/PersistentNotification";
import {
  X,
  Loader2,
  Terminal,
  ChevronUp,
  ChevronRight,
  Map as MapIcon,
  ChevronDown,
  FileText,
} from "lucide-react";
import { CommandList } from "@/components/CommandList";
import { LogPanel } from "@/components/LogPanel";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SpreadsheetView } from "@/components/SpreadsheetView";
import { xanCommands } from "@/data/commands";
import { MainMenu } from "@/components/MainMenu";
import { MainMenuHooks } from "@/hooks/MainMenuHooks";
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
  const [isXanInstalled, setIsXanInstalled] = useState<boolean | null>(null);
  const [xanVersion, setXanVersion] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [defaultDelimiter, setDefaultDelimiter] = useState<string>(",");
  const [_xanPath, setXanPath] = useState<string>("");
  const [noQuoting, setNoQuoting] = useState<boolean>(false);
  const [noHeaders, setNoHeaders] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [helpContent, setHelpContent] = useState<string>("");
  const [helpCommandName, setHelpCommandName] = useState<string>("");
  const [isHelpLoading, setIsHelpLoading] = useState<boolean>(false);
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
  const [activeMenu, setActiveMenu] = useState<"file" | "settings" | null>(null);
  const [isMenuActivated, setIsMenuActivated] = useState<boolean>(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState<boolean>(false);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(false);
  const [branchProgress, setBranchProgress] = useState<{ current: number; total: number; name: string; status: "executing" | "completed" | "error" } | null>(null);
  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const loadXanPath = async () => {
    try {
      const savedPath = await invoke<string | null>("get_xan_path");
      if (savedPath) {
        setXanPath(savedPath);
      }
    } catch (error) {
      showToastRef.current(`Failed to load xan path: ${error}`, 'error');
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
      showToastRef.current(`Failed to load default delimiter: ${error}`, 'error');
    }
  };

  const loadNoQuoting = async () => {
    try {
      const savedNoQuoting = await invoke<boolean | null>("get_no_quoting");
      if (savedNoQuoting !== null) {
        setNoQuoting(savedNoQuoting);
      }
    } catch (error) {
      showToastRef.current(`Failed to load no quoting setting: ${error}`, 'error');
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

  const checkXanInstallation = async () => {
    try {
      const installed = await invoke<boolean>("check_xan_installed");
      setIsXanInstalled(installed);

      if (installed) {
        const version = await invoke<string>("get_xan_version");
        setXanVersion(version);
      }
    } catch (error) {
      setIsXanInstalled(false);
      showToastRef.current(`Failed to check xan installation: ${error}`, 'error');
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
    checkXanInstallation();
    loadXanPath();
    loadDefaultDelimiter();
    loadNoQuoting();
    loadNoHeaders();
    loadHistoricalPipelines();
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
  ) => {
    const newStep: PipelineStep = {
      id: `${command.id}-${Date.now()}`,
      command,
      parameters: {},
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

  const handleHelpClick = async (command: XanCommand) => {
    setShowHelp(true);
    setIsHelpLoading(true);
    try {
      const helpText = await invoke<string>("get_xan_help", {
        commandName: command.name,
      });
      setHelpContent(helpText);
      setHelpCommandName(command.name);
    } catch (error) {
      showToastRef.current(`Failed to get help for ${command.name}: ${error}`, 'error');
    } finally {
      setIsHelpLoading(false);
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
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <header ref={headerRef} className="h-14 border-b bg-card shadow-sm flex items-center justify-between px-4 gap-4 relative z-10" onContextMenu={(e) => e.preventDefault()}>
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
          onOpenSettings={() => setShowSettingsDialog(true)}
          isExecuting={isExecuting}
          currentPipelineLength={getCurrentPipeline().length}
        />

        {/* Center: Empty */}
        <div className="flex-1" />

        <div className="flex items-center gap-2">
          {isXanInstalled === null ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Checking...</span>
            </div>
          ) : isXanInstalled ? (
            <button
              onClick={async () => {
                const file = await openDialog({
                  multiple: false,
                  filters: [
                    { name: "Executable Files", extensions: ["exe"] },
                  ],
                });
                if (file) {
                  setXanPath(file as string);
                  try {
                    await invoke("set_xan_path", { path: file });
                    await checkXanInstallation();
                    showToastRef.current("Xan path updated successfully", 'success');
                  } catch (error) {
                    showToastRef.current(`Failed to update xan path: ${error}`, 'error');
                  }
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-600 rounded-lg text-xs font-medium border border-green-500/20 hover:bg-green-500/20 transition-colors cursor-pointer"
            >
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              <span className="hidden sm:inline">xan{xanVersion ? ` ${xanVersion.trim()}` : ""}</span>
            </button>
          ) : (
            <button
              onClick={async () => {
                const file = await openDialog({
                  multiple: false,
                  filters: [
                    { name: "Executable Files", extensions: ["exe"] },
                  ],
                });
                if (file) {
                  setXanPath(file as string);
                  try {
                    await invoke("set_xan_path", { path: file });
                    await checkXanInstallation();
                    showToastRef.current("Xan path updated successfully", 'success');
                  } catch (error) {
                    showToastRef.current(`Failed to update xan path: ${error}`, 'error');
                  }
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-600 rounded-lg text-sm font-medium border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              <span className="hidden sm:inline">xan missing</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <SpreadsheetView
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
      </div>

      {/* Command Panel Toggle Button */}
      <Button
        onClick={() => setShowCommandPanel(!showCommandPanel)}
        onContextMenu={(e) => e.preventDefault()}
        className="fixed bottom-4 left-4 z-30 h-10 w-10 rounded-full shadow-md"
        variant="secondary"
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
        variant="secondary"
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
        variant="secondary"
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

      {/* Floating Log Panel */}
      <LogPanel
        logs={logs}
        onClear={handleClearLogs}
        isVisible={showLogPanel}
        onClose={() => setShowLogPanel(false)}
      />

      {/* Help Dialog */}
      {showHelp && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg shadow-xl p-4 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg">{helpCommandName}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHelp(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {isHelpLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 h-0">
                <div className="text-sm whitespace-pre-wrap bg-muted/30 p-2 rounded-lg text-foreground/90 leading-relaxed font-mono">
                  {helpContent}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />
      <NotificationPanel notifications={notifications} onDismiss={removeNotificationRef.current} onDismissAll={dismissAllNotifications} />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        theme={theme}
        onThemeChange={setTheme}
        defaultDelimiter={defaultDelimiter}
        onDefaultDelimiterChange={setDefaultDelimiter}
        noQuoting={noQuoting}
        onNoQuotingChange={setNoQuoting}
        noHeaders={noHeaders}
        onNoHeadersChange={setNoHeaders}
        onSave={async () => {
          setIsSavingSettings(true);
          try {
            const savePromises: Promise<void>[] = [];
            savePromises.push(
              invoke("set_default_delimiter", { delimiter: defaultDelimiter })
            );
            savePromises.push(
              invoke("set_no_quoting", { noQuoting })
            );
            savePromises.push(
              invoke("set_no_headers", { noHeaders })
            );
            await Promise.all(savePromises);
            showToastRef.current("Settings saved successfully", 'success');
          } catch (error) {
            showToastRef.current(`Failed to save settings: ${error}`, 'error');
          } finally {
            setIsSavingSettings(false);
          }
        }}
        isSaving={isSavingSettings}
      />
    </div>
  );
}

export default App;
