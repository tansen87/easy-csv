import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/components/ThemeProvider";
import { ToastContainer, ToastType } from "@/components/Toast";
import {
  Settings,
  X,
  FileText,
  Loader2,
  Sun,
  Moon,
  Terminal,
  History,
  Search,
  FolderOpen,
  Play,
  Download,
  Upload,
} from "lucide-react";
import { CommandList } from "@/components/CommandList";
import { LogPanel } from "@/components/LogPanel";
import { SpreadsheetView } from "@/components/SpreadsheetView";
import { xanCommands } from "@/data/commands";
import {
  PipelineStep,
  LogEntry,
  XanCommand,
  PipelineTab,
  HistoricalPipeline,
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
      createdAt: formatDateTime(new Date()),
      updatedAt: formatDateTime(new Date()),
    },
  ]);
  const [selectedTabId, setSelectedTabId] = useState<string>("tab-1");
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isXanInstalled, setIsXanInstalled] = useState<boolean | null>(null);
  const [xanVersion, setXanVersion] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<string>("");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [defaultDelimiter, setDefaultDelimiter] = useState<string>(",");
  const [xanPath, setXanPath] = useState<string>("");
  const [noQuoting, setNoQuoting] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [themeTransition, setThemeTransition] = useState<{
    x: number;
    y: number;
    active: boolean;
  }>({ x: 0, y: 0, active: false });
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [helpContent, setHelpContent] = useState<string>("");
  const [helpCommandName, setHelpCommandName] = useState<string>("");
  const [historicalPipelines, setHistoricalPipelines] = useState<
    HistoricalPipeline[]
  >([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<
    "commands" | "history"
  >("commands");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
  const showToastRef = useRef<(message: string, type: ToastType) => void>(() => {});
  const removeToastRef = useRef<(id: string) => void>(() => {});

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    showToastRef.current = showToast;
    removeToastRef.current = removeToast;
  }, [showToast, removeToast]);

  const [csvData, setCsvData] = useState<{
    headers: string[];
    rows: string[][];
  }>({ headers: [], rows: [] });

  // Load CSV file
  const loadCsvData = useCallback(
    async (filePath: string) => {
      if (!filePath) {
        setCsvData({ headers: [], rows: [] });
        return;
      }

      try {
        const data = await invoke<{ headers: string[]; rows: string[][] }>(
          "read_csv_file",
          {
            filePath,
            delimiter: defaultDelimiter,
            limit: 100,
          },
        );
        setCsvData(data);
      } catch (error) {
        addLog("error", `Failed to read CSV: ${error}`);
        setCsvData({ headers: [], rows: [] });
      }
    },
    [defaultDelimiter],
  );

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
      addLog("error", `Failed to check xan installation: ${error}`);
    }
  };

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
    loadHistoricalPipelines();
  }, []);

  useEffect(() => {
    loadCsvData(inputFile);
  }, [inputFile, defaultDelimiter, loadCsvData]);

  useEffect(() => {
    const updateTitle = async () => {
      try {
        const title = inputFile ? `${inputFile} - Easy Csv` : "Easy Csv";
        await invoke("set_window_title", { title });
      } catch (error) {
        showToastRef.current(`Failed to set window title: ${error}`, 'error');
      }
    };
    updateTitle();
  }, [inputFile]);

  useEffect(() => {
    if (csvData.headers.length > 0 && selectedTabId) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
              ...tab,
              data: csvData.rows,
              headers: csvData.headers,
              inputFile: inputFile,
              updatedAt: formatDateTime(new Date()),
            }
            : tab,
        ),
      );
    }
  }, [csvData, inputFile, selectedTabId]);

  const getCurrentTab = () => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  };

  const getCurrentPipeline = () => {
    return getCurrentTab().pipeline;
  };

  const updateTabPipeline = (tabIdOrPipeline: string | PipelineStep[], newPipeline?: PipelineStep[]) => {
    if (typeof tabIdOrPipeline === 'string' && newPipeline) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabIdOrPipeline
            ? {
              ...tab,
              pipeline: newPipeline,
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
              updatedAt: formatDateTime(new Date()),
            }
            : tab,
        ),
      );
    }
  };

  const addNewTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: PipelineTab = {
      id: newTabId,
      name: `Tab${tabs.length + 1}`,
      pipeline: [],
      createdAt: formatDateTime(new Date()),
      updatedAt: formatDateTime(new Date()),
    };
    setTabs((prev) => [...prev, newTab]);
    setSelectedTabId(newTabId);
    setSelectedStep(null);
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

  const removeAllTabsExcept = (keepTabId: string) => {
    const keepTab = tabs.find((tab) => tab.id === keepTabId);
    if (keepTab) {
      setTabs([keepTab]);
      setSelectedTabId(keepTabId);
      setSelectedStep(null);
      showToastRef.current("Cleared all pipeline tabs except the current one", 'info');
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
    updateTabPipeline([...currentPipeline, newStep]);
    setSelectedStep(newStep);
  };

  const handleHelpClick = async (command: XanCommand) => {
    try {
      const helpText = await invoke<string>("get_xan_help", {
        commandName: command.name,
      });
      setHelpContent(helpText);
      setHelpCommandName(command.name);
      setShowHelp(true);
    } catch (error) {
      addLog("error", `Failed to get help for ${command.name}: ${error}`);
    }
  };

  const handleStepClick = (step: PipelineStep) => {
    setSelectedStep(step);
  };

  const handleStepRemove = (stepId: string) => {
    const currentPipeline = getCurrentPipeline();
    const updatedPipeline = currentPipeline.filter((s) => s.id !== stepId);
    updateTabPipeline(updatedPipeline);
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

  const handleExecute = async () => {
    const currentPipeline = getCurrentPipeline();
    if (currentPipeline.length === 0) {
      showToastRef.current("No steps in pipeline to execute", 'warning');
      return;
    }

    if (!inputFile) {
      showToastRef.current("No input file selected", 'warning');
      return;
    }

    setIsExecuting(true);

    try {
      const commands = currentPipeline.map((step) => ({
        name: step.command.name,
        parameters: step.command.parameters.map((param) => ({
          name: param.name,
          value: String(step.parameters[param.name] || param.default || ""),
          isPositional: param.isPositional,
        })),
      }));

      const result = await invoke<any>("execute_xan_pipeline", {
        commands,
        inputFile,
        defaultDelimiter,
      });

      // Save to history
      const currentTabName = getCurrentTab().name;
      const existingHistoryIndex = historicalPipelines.findIndex(
        (h) => h.name === currentTabName,
      );

      const historicalPipeline: HistoricalPipeline = {
        id:
          existingHistoryIndex >= 0
            ? historicalPipelines[existingHistoryIndex].id
            : `history-${Date.now()}`,
        name: currentTabName,
        pipeline: currentPipeline,
        inputFile,
        defaultDelimiter,
        executedAt: formatDateTime(new Date()),
        success: result.success,
        output: result.output || undefined,
      };

      let updatedHistory: HistoricalPipeline[];
      if (existingHistoryIndex >= 0) {
        // Update existing history for this tab
        updatedHistory = [...historicalPipelines];
        updatedHistory[existingHistoryIndex] = historicalPipeline;
        // Move updated history to the top
        updatedHistory.splice(existingHistoryIndex, 1);
        updatedHistory.unshift(historicalPipeline);
      } else {
        // Add new history for this tab
        updatedHistory = [historicalPipeline, ...historicalPipelines].slice(
          0,
          50,
        ); // Keep only last 50
      }

      updateHistoricalPipelines(updatedHistory);

      if (result.success) {
        if (result.output) {
          addLog("info", `${result.output}`);
        }
      } else {
        addLog("error", `${result.error}`);
      }
    } catch (error) {
      addLog("error", `${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleExportPipeline = async () => {
    const currentPipeline = getCurrentPipeline();
    if (currentPipeline.length === 0) {
      showToastRef.current("No pipeline to export", 'warning');
      return;
    }

    try {
      const pipelineData = {
        version: "0.1.0",
        name: getCurrentTab().name,
        pipeline: currentPipeline.map((step) => ({
          commandId: step.command.id,
          parameters: step.parameters,
        })),
        inputFile,
        defaultDelimiter,
        createdAt: formatDateTime(new Date()),
      };

      const jsonContent = JSON.stringify(pipelineData, null, 2);
      const filePath = await save({
        filters: [{ name: "Pipeline Files", extensions: ["xan"] }],
        defaultPath: `${getCurrentTab().name}.xan`,
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(jsonContent));
        addLog("success", `Pipeline exported to: ${filePath}`);
      }
    } catch (error) {
      addLog("error", `Failed to export pipeline: ${error}`);
    }
  };

  const handleImportPipeline = async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Pipeline Files", extensions: ["xan"] }],
    });

    if (!file) return;

    try {

      const fileContent = await readFile(file);
      const jsonContent = new TextDecoder().decode(fileContent);
      const pipelineData = JSON.parse(jsonContent);

      if (!pipelineData.pipeline || !Array.isArray(pipelineData.pipeline)) {
        showToastRef.current("Invalid pipeline file format", 'error');
        return;
      }

      const importedPipeline: PipelineStep[] = pipelineData.pipeline.map((stepData: { commandId: string; parameters?: Record<string, any> }) => {
        const command = xanCommands.find((cmd) => cmd.id === stepData.commandId);
        if (!command) {
          showToastRef.current(`Unknown command: ${stepData.commandId}, skipping`, 'warning');
          return null;
        }
        return {
          id: `${command.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          command,
          parameters: stepData.parameters || {},
        };
      }).filter((step: PipelineStep | null): step is PipelineStep => step !== null);

      if (importedPipeline.length === 0) {
        showToastRef.current("No valid commands found in pipeline file", 'error');
        return;
      }

      updateTabPipeline(importedPipeline);
      if (pipelineData.inputFile) {
        setInputFile(pipelineData.inputFile);
      }
      if (pipelineData.defaultDelimiter) {
        setDefaultDelimiter(pipelineData.defaultDelimiter);
      }

      showToastRef.current(`Imported pipeline with ${importedPipeline.length} steps`, 'success');
    } catch (error) {
      addLog("error", `Failed to import pipeline: ${error}`);
    }
  };

  const handleOpenFile = async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV Files", extensions: ["csv", "txt", "tsv"] },
        { name: "JSON Files", extensions: ["json", "jsonl"] },
        { name: "Excel Files", extensions: ["xlsx"] },
        { name: "Parquet Files", extensions: ["parquet"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (file) {
      setInputFile(file);
    }
  };

  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    setThemeTransition({ x, y, active: true });

    setTimeout(() => {
      setTheme(theme === "dark" ? "light" : "dark");
    }, 400);

    setTimeout(() => {
      setThemeTransition((prev) => ({ ...prev, active: false }));
    }, 800);
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden">
      {themeTransition.active && (
        <div
          className="fixed inset-0 pointer-events-none z-50"
          style={{
            background:
              theme === "light" ? "hsl(210 40% 98%)" : "hsl(222.2 84% 4.9%)",
            clipPath: `circle(0% at ${themeTransition.x}px ${themeTransition.y}px)`,
            animation: "themeExpand 0.8s ease-out forwards",
          }}
        />
      )}
      <style>{`
        @keyframes themeExpand {
          0% {
            clip-path: circle(0% at ${themeTransition.x}px ${themeTransition.y}px);
          }
          100% {
            clip-path: circle(150% at ${themeTransition.x}px ${themeTransition.y}px);
          }
        }
      `}</style>
      <header className="h-14 border-b bg-card/80 backdrop-blur-sm shadow-sm flex items-center justify-between px-4 gap-4">
        {/* Left: Command/History Toggle + Search */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeLeftPanel === "commands"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              onClick={() => setActiveLeftPanel("commands")}
            >
              <Terminal className="h-3.5 w-3.5" />
              Cmds
            </button>
            <button
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeLeftPanel === "history"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              onClick={() => setActiveLeftPanel("history")}
            >
              <History className="h-3.5 w-3.5" />
              History
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 z-10 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeLeftPanel === "commands"
                  ? "Search cmd(s)"
                  : "Search history"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-32 pl-8 pr-3 py-1.5 text-xs border border-border/50 rounded-lg bg-background/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Center: View Toggle + Action Group */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={handleOpenFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Browse
              </button>
              <button
                onClick={handleExecute}
                disabled={getCurrentPipeline().length === 0 || isExecuting}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isExecuting
                    ? "text-primary opacity-70"
                    : getCurrentPipeline().length === 0
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : "text-primary hover:text-primary hover:bg-primary/10"
                  }`}
              >
                {isExecuting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Execute
                    {getCurrentPipeline().length > 0 && (
                      <span className="ml-0.5">({getCurrentPipeline().length})</span>
                    )}
                  </>
                )}
              </button>
            </div>
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={handleImportPipeline}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
              <button
                onClick={handleExportPipeline}
                disabled={getCurrentPipeline().length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${getCurrentPipeline().length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Right: Status + Tools */}
        <div className="flex items-center gap-2">
          {isXanInstalled === null ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Checking...</span>
            </div>
          ) : isXanInstalled ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-600 rounded-lg text-xs font-medium border border-green-500/20"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="hidden sm:inline">xan{xanVersion ? ` ${xanVersion.trim()}` : ""}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-600 rounded-lg text-xs font-medium border border-red-500/20">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              <span className="hidden sm:inline">xan missing</span>
            </div>
          )}
          <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              onClick={handleThemeToggle}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[16%] flex-shrink-0 flex flex-col bg-card/50 backdrop-blur-sm border-r">
          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {activeLeftPanel === "commands" ? (
              <CommandList
                commands={xanCommands}
                onCommandClick={handleCommandClick}
                onHelpClick={handleHelpClick}
                selectedCommandId={selectedStep?.command.id}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            ) : (
              <div className="h-full overflow-auto p-4">
                {(() => {
                  const filteredHistory = historicalPipelines.filter(
                    (history) =>
                      history.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase()),
                  );
                  return filteredHistory.length === 0 ? (
                    <div className="text-center py-16 px-4">
                      <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mb-1">
                        No historical pipelines found
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {searchQuery
                          ? "Try a different search term"
                          : "Execute pipelines to see them here"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredHistory.map((history) => (
                        <div
                          key={history.id}
                          className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-xs truncate">
                              {history.name}
                            </h4>
                            <button
                              className="text-xs px-2 py-1 rounded-md hover:bg-accent transition-colors text-red-600 hover:bg-red-500/10"
                              onClick={() => {
                                const updatedHistory =
                                  historicalPipelines.filter(
                                    (h) => h.id !== history.id,
                                  );
                                updateHistoricalPipelines(updatedHistory);
                                showToastRef.current(
                                  `Deleted historical pipeline: ${history.name}`,
                                  'info',
                                );
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {new Date(history.executedAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mb-2 truncate">
                            {history.inputFile.split("\\").pop()}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex gap-1">
                              <button
                                className="text-xs px-2 py-1 border rounded hover:bg-accent transition-colors"
                                onClick={() => {
                                  updateTabPipeline(history.pipeline);
                                  setInputFile(history.inputFile);
                                  setDefaultDelimiter(history.defaultDelimiter);
                                  showToastRef.current(
                                    `Loaded historical pipeline: ${history.name}`,
                                    'info',
                                  );
                                }}
                              >
                                Load
                              </button>
                              <button
                                className="text-xs px-2 py-1 border rounded hover:bg-accent transition-colors"
                                onClick={() => {
                                  const newTabId = `tab-${Date.now()}`;
                                  const newTab: PipelineTab = {
                                    id: newTabId,
                                    name: `${history.name} (History)`,
                                    pipeline: history.pipeline,
                                    createdAt: formatDateTime(new Date()),
                                    updatedAt: formatDateTime(new Date()),
                                  };
                                  setTabs((prev) => [...prev, newTab]);
                                  setSelectedTabId(newTabId);
                                  setInputFile(history.inputFile);
                                  setDefaultDelimiter(history.defaultDelimiter);
                                  showToastRef.current(
                                    `Created new tab from historical pipeline: ${history.name}`,
                                    'info',
                                  );
                                }}
                              >
                                New Tab
                              </button>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${history.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                            >
                              {history.success ? "Success" : "Failed"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <SpreadsheetView
              tabs={tabs}
              selectedTabId={selectedTabId}
              onTabChange={setSelectedTabId}
              onAddTab={addNewTab}
              onRemoveTab={removeTab}
              onRemoveAllTabsExcept={removeAllTabsExcept}
              onRenameTab={renameTab}
              onAddCommand={handleCommandClick}
              onStepClick={handleStepClick}
              onStepUpdate={handleStepUpdate}
              onStepDelete={handleStepRemove}
              onPipelineReorder={updateTabPipeline}
            />
          </div>
          <LogPanel logs={logs} onClear={handleClearLogs} />
        </main>
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Xan Executable Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={xanPath}
                    onChange={(e) => setXanPath(e.target.value)}
                    placeholder="Auto-detect if not specified"
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const file = await open({
                        multiple: false,
                        filters: [
                          { name: "Executable Files", extensions: ["exe"] },
                        ],
                      });
                      if (file) {
                        setXanPath(file);
                      }
                    }}
                  >
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Specify the path to xan.exe. Leave empty to auto-detect.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Default Delimiter
                </label>
                <select
                  value={defaultDelimiter}
                  onChange={(e) => setDefaultDelimiter(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={"\t"}>Tab (\t)</option>
                  <option value="|">Pipe (|)</option>
                  <option value="^">Caret (^)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This delimiter will be used for all commands that require it
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noQuoting}
                    onChange={(e) => setNoQuoting(e.target.checked)}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">Disable Quoting</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Disable quoting completely for input command
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      if (xanPath) {
                        await invoke("set_xan_path", { path: xanPath });
                        await checkXanInstallation();
                      }
                      await invoke("set_default_delimiter", {
                        delimiter: defaultDelimiter,
                      });
                      await invoke("set_no_quoting", { noQuoting });
                      showToastRef.current("Settings saved successfully", 'success');
                      setShowSettings(false);
                    } catch (error) {
                      addLog("error", `Failed to save settings: ${error}`);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">Help: {helpCommandName}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHelp(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <ScrollArea className="flex-1 h-0">
              <pre className="text-sm font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border">
                {helpContent}
              </pre>
            </ScrollArea>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />
    </div>
  );
}

export default App;
