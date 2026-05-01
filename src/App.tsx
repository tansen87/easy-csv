import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/components/ThemeProvider";
import {
  Settings,
  X,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Sun,
  Moon,
  Terminal,
  History,
  Table,
  Layers,
} from "lucide-react";
import { CommandList } from "@/components/CommandList";
import { PipelineBuilder } from "@/components/PipelineBuilder";
import { ParameterPanel } from "@/components/ParameterPanel";
import { LogPanel } from "@/components/LogPanel";
import { SpreadsheetView } from "@/components/SpreadsheetView";
import { xanCommands } from "@/data/commands";
import {
  PipelineStep,
  LogEntry,
  XanCommand,
  Workspace,
  PipelineTab,
  HistoricalPipeline,
} from "@/types/xan";

function App() {
  const { theme, setTheme } = useTheme();
  const [tabs, setTabs] = useState<PipelineTab[]>([
    {
      id: "tab-1",
      name: "Pipeline 1",
      pipeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
  const [viewMode, setViewMode] = useState<"pipeline" | "spreadsheet">(
    "pipeline",
  );
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
      console.error("Failed to load xan path:", error);
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
      console.error("Failed to load default delimiter:", error);
    }
  };

  const loadNoQuoting = async () => {
    try {
      const savedNoQuoting = await invoke<boolean | null>("get_no_quoting");
      if (savedNoQuoting !== null) {
        setNoQuoting(savedNoQuoting);
      }
    } catch (error) {
      console.error("Failed to load no quoting setting:", error);
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
        addLog("error", `Failed to set window title: ${error}`);
      }
    };
    updateTitle();
  }, [inputFile]);

  const getCurrentTab = () => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  };

  const getCurrentPipeline = () => {
    return getCurrentTab().pipeline;
  };

  const updateTabPipeline = (newPipeline: PipelineStep[]) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: newPipeline,
              updatedAt: new Date().toISOString(),
            }
          : tab,
      ),
    );
  };

  const addNewTab = () => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: PipelineTab = {
      id: newTabId,
      name: `Pipeline ${tabs.length + 1}`,
      pipeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      addLog("info", "Cleared all pipeline tabs except the current one");
    }
  };

  const renameTab = (tabId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, name: newName, updatedAt: new Date().toISOString() }
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

  const handleClearPipeline = () => {
    updateTabPipeline([]);
    setSelectedStep(null);
    addLog("info", "Pipeline cleared");
  };

  const handleExecute = async () => {
    const currentPipeline = getCurrentPipeline();
    if (currentPipeline.length === 0) {
      addLog("warning", "No steps in pipeline to execute");
      return;
    }

    if (!inputFile) {
      addLog("warning", "No input file selected");
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
        executedAt: new Date().toISOString(),
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

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputFile(e.target.value);
  };

  const handleOpenFile = async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
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

  const handleExportWorkspace = async () => {
    try {
      const currentPipeline = getCurrentPipeline();
      const workspace: Workspace = {
        version: "0.1.0",
        name: `xan-workspace_${new Date().toISOString().split("T")[0]}`,
        description: `Exported on ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pipeline: currentPipeline,
        inputFile: inputFile,
        defaultDelimiter: defaultDelimiter,
        noQuoting: noQuoting,
      };

      const filePath = await save({
        filters: [{ name: "JSON Files", extensions: ["json"] }],
        defaultPath: `${workspace.name}.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(workspace, null, 2));
        addLog(
          "success",
          `Workspace exported to ${filePath.split("\\").pop()}`,
        );
      }
    } catch (error) {
      addLog("error", `Failed to export workspace: ${error}`);
    }
  };

  const handleImportWorkspace = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });

      if (filePath) {
        const content = await readTextFile(filePath);
        const workspace: Workspace = JSON.parse(content);

        if (
          workspace.version &&
          workspace.pipeline &&
          workspace.inputFile !== undefined
        ) {
          updateTabPipeline(workspace.pipeline);
          setInputFile(workspace.inputFile);
          setDefaultDelimiter(workspace.defaultDelimiter || ",");
          setNoQuoting(workspace.noQuoting || false);
          setSelectedStep(null);
          addLog("success", `Workspace imported: ${workspace.name}`);
        } else {
          addLog("error", "Invalid workspace file format");
        }
      }
    } catch (error) {
      addLog("error", `Failed to import workspace: ${error}`);
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
      <header className="h-16 border-b bg-card/80 backdrop-blur-sm shadow-sm flex items-center justify-between px-4">
        <div className="flex items-center">
          <div className="flex border rounded-lg overflow-hidden">
            <button
              className={`px-4 py-1.5 flex items-center justify-center transition-colors ${activeLeftPanel === "commands" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              onClick={() => setActiveLeftPanel("commands")}
            >
              <Terminal className="h-4 w-4" />
            </button>
            <button
              className={`px-4 py-1.5 flex items-center justify-center transition-colors ${activeLeftPanel === "history" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
              onClick={() => setActiveLeftPanel("history")}
            >
              <History className="h-4 w-4" />
            </button>
          </div>
          <div className="ml-2 w-48">
            <input
              type="text"
              placeholder={
                activeLeftPanel === "commands"
                  ? "Search commands..."
                  : "Search pipelines..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border/50 rounded-lg bg-background/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1 border border-border/50">
          <Button
            variant={viewMode === "pipeline" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("pipeline")}
            className="h-8 px-3 text-xs font-medium"
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Pipeline
          </Button>
          <Button
            variant={viewMode === "spreadsheet" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("spreadsheet")}
            className="h-8 px-3 text-xs font-medium"
          >
            <Table className="h-3.5 w-3.5 mr-1.5" />
            Spreadsheet
          </Button>
        </div>

        <div className="flex-1 max-w-xl mx-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenFile}
            className="h-7 px-3 text-xs font-medium hover:bg-accent"
          >
            Browse
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {isXanInstalled === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </div>
          ) : isXanInstalled ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-xs font-medium border border-green-500/20">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>xan {xanVersion && `v${xanVersion.trim()}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-600 rounded-full text-xs font-medium border border-red-500/20">
              <XCircle className="h-3.5 w-3.5" />
              <span>xan not found</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeToggle}
            className="h-9 w-9 rounded-lg hover:bg-accent transition-all hover:scale-110 active:scale-95"
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5 transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="h-4.5 w-4.5 transition-transform duration-300 rotate-0 hover:-rotate-12" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="h-9 w-9 rounded-lg hover:bg-accent transition-colors"
          >
            <Settings className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[20%] flex-shrink-0 flex flex-col bg-card/50 backdrop-blur-sm border-r">
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
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${history.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}
                            >
                              {history.success ? "Success" : "Failed"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            {new Date(history.executedAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground mb-2 truncate">
                            {history.inputFile.split("\\").pop()}
                          </p>
                          <div className="flex gap-1">
                            <button
                              className="text-xs px-2 py-1 border rounded hover:bg-accent transition-colors"
                              onClick={() => {
                                updateTabPipeline(history.pipeline);
                                setInputFile(history.inputFile);
                                setDefaultDelimiter(history.defaultDelimiter);
                                addLog(
                                  "info",
                                  `Loaded historical pipeline: ${history.name}`,
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
                                  createdAt: new Date().toISOString(),
                                  updatedAt: new Date().toISOString(),
                                };
                                setTabs((prev) => [...prev, newTab]);
                                setSelectedTabId(newTabId);
                                setInputFile(history.inputFile);
                                setDefaultDelimiter(history.defaultDelimiter);
                                addLog(
                                  "info",
                                  `Created new tab from historical pipeline: ${history.name}`,
                                );
                              }}
                            >
                              New Tab
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded-xl hover:bg-accent transition-colors text-red-600 hover:bg-red-500/10 ml-auto"
                              onClick={() => {
                                const updatedHistory =
                                  historicalPipelines.filter(
                                    (h) => h.id !== history.id,
                                  );
                                updateHistoricalPipelines(updatedHistory);
                                addLog(
                                  "info",
                                  `Deleted historical pipeline: ${history.name}`,
                                );
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
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
          {viewMode === "pipeline" ? (
            <>
              <div className="flex-1 flex overflow-hidden min-h-0">
                <div className="w-[60%] flex-shrink-0 flex flex-col">
                  <PipelineBuilder
                    steps={getCurrentPipeline()}
                    onStepsChange={updateTabPipeline}
                    onStepClick={handleStepClick}
                    onStepRemove={handleStepRemove}
                    selectedStepId={selectedStep?.id}
                    onExecute={handleExecute}
                    onClear={handleClearPipeline}
                    isExecuting={isExecuting}
                    onExportWorkspace={handleExportWorkspace}
                    onImportWorkspace={handleImportWorkspace}
                    tabs={tabs}
                    selectedTabId={selectedTabId}
                    onTabChange={setSelectedTabId}
                    onAddTab={addNewTab}
                    onRemoveTab={removeTab}
                    onRemoveAllTabsExcept={removeAllTabsExcept}
                    onRenameTab={renameTab}
                  />
                </div>

                <aside className="flex-1 flex flex-col">
                  <ParameterPanel
                    step={selectedStep}
                    onStepUpdate={handleStepUpdate}
                    onClose={() => setSelectedStep(null)}
                  />
                </aside>
              </div>

              <LogPanel logs={logs} onClear={handleClearLogs} />
            </>
          ) : (
            <>
              <div className="flex-1 overflow-hidden">
                <SpreadsheetView
                  data={csvData.rows}
                  headers={csvData.headers}
                  onAddCommand={handleCommandClick}
                  pipeline={getCurrentPipeline()}
                  onStepClick={handleStepClick}
                  onStepUpdate={handleStepUpdate}
                  onStepDelete={handleStepRemove}
                  onPipelineReorder={updateTabPipeline}
                  onExecute={handleExecute}
                  isExecuting={isExecuting}
                  inputFile={inputFile}
                />
              </div>
              <LogPanel logs={logs} onClear={handleClearLogs} />
            </>
          )}
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
                      addLog("success", "Settings saved successfully");
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
    </div>
  );
}

export default App;
