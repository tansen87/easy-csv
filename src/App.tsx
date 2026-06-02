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
  FolderOpen,
  Download,
  Upload,
  ChevronUp,
  ChevronRight,
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
  const [historicalPipelines, setHistoricalPipelines] = useState<
    HistoricalPipeline[]
  >([]);
  const [activeLeftPanel, setActiveLeftPanel] = useState<
    "commands" | "history"
  >("commands");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);
  const showToastRef = useRef<(message: string, type: ToastType) => void>(() => { });
  const removeToastRef = useRef<(id: string) => void>(() => { });

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

  const isCsvFile = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext ? ['csv', 'txt', 'tsv'].includes(ext) : false;
  };

  // Load CSV file
  const loadCsvData = useCallback(
    async (filePath: string) => {
      if (!filePath) {
        setCsvData({ headers: [], rows: [] });
        return;
      }

      if (!isCsvFile(filePath)) {
        setCsvData({ headers: [], rows: [] });
        addLog("info", `Non-CSV file selected. Use "from" command to convert ${filePath.split('.').pop()?.toUpperCase()} to CSV.`);
        return;
      }

      try {
        const data = await invoke<{ headers: string[]; rows: string[][] }>(
          "read_csv_file",
          {
            filePath,
            delimiter: defaultDelimiter,
            limit: 31,
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
    loadNoHeaders();
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
    if (selectedTabId) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
              ...tab,
              data: csvData.headers.length > 0 ? csvData.rows : tab.data,
              headers: csvData.headers.length > 0 ? csvData.headers : tab.headers,
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

  const updateTabPipeline = (tabIdOrPipeline: string | PipelineStep[], newPipeline?: PipelineStep[], edges?: PipelineEdge[], inputPosition?: { x: number; y: number }) => {
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

  const handleExecute = async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    const edges = currentTab.edges || [];

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
      // Check if there's an output command in the pipeline
      const outputStep = currentPipeline.find(step => step.command.id === "output");
      const outputPath = outputStep?.parameters.path || "";

      // Filter out output command from execution
      const executableSteps = currentPipeline.filter(step => step.command.id !== "output");

      // Build execution branches based on edges
      const branches = buildExecutionBranches(executableSteps, edges);

      const allResults: { success: boolean; output?: string; error?: string; branchSteps: string[] }[] = [];

      // Execute each branch sequentially
      for (let i = 0; i < branches.length; i++) {
        const branchSteps = branches[i];
        if (branchSteps.length === 0) continue;

        const branchStepNames = branchSteps.map(s => s.alias || s.command.name);
        addLog("info", `Executing branch ${i + 1}: ${branchStepNames.join(" -> ")}`);

        const commands = branchSteps.map((step, index) => {
          const params = step.command.parameters.map((param) => ({
            name: param.name,
            value: String(step.parameters[param.name] || param.default || ""),
            isPositional: param.isPositional,
          }));

          // Add output parameter to the last command if output path is specified
          if (index === branchSteps.length - 1 && outputPath) {
            params.push({
              name: "output",
              value: outputPath,
              isPositional: false,
            });
          }

          return {
            name: step.command.name,
            parameters: params,
          };
        });

        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile,
          defaultDelimiter,
        });

        allResults.push({
          success: result.success,
          output: result.output,
          error: result.error,
          branchSteps: branchStepNames,
        });

        if (result.success) {
          if (result.output) {
            const output = (result.output as string).trimStart().trimEnd();
            addLog("success", `${output}`);
          }
        } else {
          addLog("error", `${result.error}`);
        }
      }

      // Save to history
      const currentTabName = currentTab.name;
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
        success: allResults.every(r => r.success),
        output: allResults.map(r => r.output).filter(Boolean).join("\n---\n"),
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

      // Summary
      const successCount = allResults.filter(r => r.success).length;
      if (successCount === branches.length) {
        showToastRef.current(`All ${branches.length} branch(es) executed successfully`, 'success');
      } else {
        showToastRef.current(`${successCount}/${branches.length} branch(es) succeeded`, 'warning');
      }
    } catch (error) {
      showToastRef.current(`${error}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Build execution branches from edges
  const buildExecutionBranches = (steps: PipelineStep[], edges: PipelineEdge[]): PipelineStep[][] => {
    // If no edges, each step is its own independent branch
    if (edges.length === 0) {
      return steps.map(step => [step]);
    }

    // Create a map from step id to step
    const stepMap = new Map<string, PipelineStep>();
    steps.forEach(step => stepMap.set(step.id, step));

    // Build adjacency list from edges
    const adjacency = new Map<string, string[]>();
    edges.forEach(edge => {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    });

    // Find starting nodes (nodes that are not targets of any edge)
    const targetIds = new Set(edges.map(e => e.target));
    const startNodes = steps.filter(step => !targetIds.has(step.id)).map(step => step.id);

    if (startNodes.length === 0) {
      return steps.map(step => [step]);
    }

    // Build all paths using DFS
    const branches: PipelineStep[][] = [];

    const dfs = (currentId: string, path: PipelineStep[]) => {
      const currentStep = stepMap.get(currentId);
      if (!currentStep) return;

      const newPath = [...path, currentStep];
      const nextNodes = adjacency.get(currentId) || [];

      if (nextNodes.length === 0) {
        branches.push(newPath);
        return;
      }

      nextNodes.forEach(nextId => {
        dfs(nextId, newPath);
      });
    };

    startNodes.forEach(startId => {
      dfs(startId, []);
    });

    return branches;
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleExportPipeline = async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    if (currentPipeline.length === 0) {
      showToastRef.current("No pipeline to export", 'warning');
      return;
    }

    try {
      const pipelineData = {
        version: "0.1.0",
        name: currentTab.name,
        pipeline: currentPipeline.map((step) => ({
          id: step.id,
          commandId: step.command.id,
          parameters: step.parameters,
          alias: step.alias,
          position: step.position,
        })),
        inputFile,
        defaultDelimiter,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
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
        showToastRef.current(`Pipeline exported to: ${filePath}`, 'success');
      }
    } catch (error) {
      showToastRef.current(`Failed to export pipeline: ${error}`, 'error');
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

      const importedPipeline: PipelineStep[] = pipelineData.pipeline.map((stepData: { id?: string; commandId: string; parameters?: Record<string, any>; alias?: string; position?: { x: number; y: number } }) => {
        const command = xanCommands.find((cmd) => cmd.id === stepData.commandId);
        if (!command) {
          showToastRef.current(`Unknown command: ${stepData.commandId}, skipping`, 'warning');
          return null;
        }
        return {
          id: stepData.id || `${command.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          command,
          parameters: stepData.parameters || {},
          alias: stepData.alias,
          position: stepData.position,
        };
      }).filter((step: PipelineStep | null): step is PipelineStep => step !== null);

      if (importedPipeline.length === 0) {
        showToastRef.current("No valid commands found in pipeline file", 'error');
        return;
      }

      updateTabPipeline(importedPipeline, undefined, pipelineData.edges, pipelineData.inputPosition);
      if (pipelineData.inputFile) {
        setInputFile(pipelineData.inputFile);
      }
      if (pipelineData.defaultDelimiter) {
        setDefaultDelimiter(pipelineData.defaultDelimiter);
      }

      showToastRef.current(`Imported pipeline with ${importedPipeline.length} steps`, 'success');
    } catch (error) {
      showToastRef.current(`Failed to import pipeline: ${error}`, 'error');
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

  const handleThemeToggle = () => {
    let currentTheme = theme;
    if (theme === "system") {
      currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      <header className="h-14 border-b bg-card shadow-sm flex items-center justify-between px-4 gap-4 relative z-10">
        {/* Left: Empty - moved to floating panel */}
        <div className="flex items-center gap-2"></div>

        {/* Center: View Toggle + Action Group */}
        <div className="flex items-center gap-3 flex-1 justify-center">
          <div className="flex items-center gap-2">
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={handleOpenFile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors border-r border-border/50"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Browse
              </button>
              <button
                onClick={() => {
                  handleExecute();
                }}
                disabled={getCurrentPipeline().length === 0 || isExecuting}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-r-md text-xs font-medium transition-colors ${isExecuting
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
                    <FileText className="h-3 w-3 mr-1.5" />
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
            <button
              onClick={async () => {
                const file = await open({
                  multiple: false,
                  filters: [
                    { name: "Executable Files", extensions: ["exe"] },
                  ],
                });
                if (file) {
                  setXanPath(file);
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
                const file = await open({
                  multiple: false,
                  filters: [
                    { name: "Executable Files", extensions: ["exe"] },
                  ],
                });
                if (file) {
                  setXanPath(file);
                  try {
                    await invoke("set_xan_path", { path: file });
                    await checkXanInstallation();
                    showToastRef.current("Xan path updated successfully", 'success');
                  } catch (error) {
                    showToastRef.current(`Failed to update xan path: ${error}`, 'error');
                  }
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-600 rounded-lg text-xs font-medium border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              <span className="hidden sm:inline">xan missing</span>
            </button>
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
              onStepAliasUpdate={handleStepAliasUpdate}
              onStepDelete={handleStepRemove}
              onPipelineReorder={updateTabPipeline}
              onEdgesChange={(tabId, edges) => {
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
            />
          </div>
        </main>
      </div>

      {/* Command Panel Toggle Button */}
      <Button
        onClick={() => setShowCommandPanel(!showCommandPanel)}
        className="fixed bottom-4 left-4 z-30 h-10 w-10 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center"
        variant="default"
        size="icon"
      >
        {showCommandPanel ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <Terminal className="h-4 w-4" />
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
        onLoadHistory={(history) => {
          updateTabPipeline(history.pipeline);
          showToastRef.current(`Loaded historical pipeline: ${history.name}`, 'info');
        }}
        onNewTabFromHistory={(history) => {
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
          showToastRef.current(`Created new tab from historical pipeline: ${history.name}`, 'info');
        }}
        onDeleteHistory={(history) => {
          const updatedHistory = historicalPipelines.filter((h) => h.id !== history.id);
          updateHistoricalPipelines(updatedHistory);
          showToastRef.current(`Deleted historical pipeline: ${history.name}`, 'info');
        }}
        onInputFileChange={setInputFile}
        onDefaultDelimiterChange={setDefaultDelimiter}
      />

      {/* Log Panel Toggle Button */}
      <Button
        onClick={() => setShowLogPanel(!showLogPanel)}
        className="fixed bottom-4 right-4 z-30 h-10 w-10 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center"
        variant="default"
        size="icon"
      >
        {showLogPanel ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </Button>

      {/* Floating Log Panel */}
      <LogPanel
        logs={logs}
        onClear={handleClearLogs}
        showToastRef={showToastRef}
        isVisible={showLogPanel}
        onClose={() => setShowLogPanel(false)}
      />

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
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noHeaders}
                    onChange={(e) => setNoHeaders(e.target.checked)}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">No Headers</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Indicate that input file has no headers
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
                  disabled={isSavingSettings}
                  onClick={async () => {
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
                      setShowSettings(false);
                      showToastRef.current("Settings saved successfully", 'success');
                    } catch (error) {
                      showToastRef.current(`Failed to save settings: ${error}`, 'error');
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                >
                  {isSavingSettings ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg shadow-lg p-4 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-semibold">{helpCommandName}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowHelp(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {isHelpLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="flex-1 h-0">
                <pre className="text-sm font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded-lg border">
                  {helpContent}
                </pre>
              </ScrollArea>
            )}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />
    </div>
  );
}

export default App;
