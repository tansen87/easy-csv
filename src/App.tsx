import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sendNotification } from "@tauri-apps/plugin-notification";
import {
  FolderOpen,
  FileText,
  Save,
  Upload,
  Download,
  Undo2,
  Redo2,
  Play,
  Settings,
  CloudDownload,
  MessageCircleQuestionMark,
  CommandIcon,
  BarChart3,
  GitBranch,
  GitMerge,
  GitCompareArrows,
  Bot,
  RefreshCw,
  FileCode,
} from "lucide-react";

import { LogPanel } from "@/components/panel/LogPanel";
import { ChartPanel } from "@/components/panel/ChartPanel";
import { SettingsDialog } from "@/components/setting/SettingsDialog";
import { HomeView } from "@/components/HomeView";
import { HelpDialog } from "@/components/help/HelpDialog";
import { getHelpContent } from "@/components/help/HelpContent";
import { UpdateDialog } from "@/components/dialog/UpdateDialog";
import { ConfirmDialog } from "@/components/dialog/ConfirmDialog";
import { VariableValuesDialog } from "@/components/dialog/VariableValuesDialog";
import { VariablePanel } from "@/components/panel/VariablePanel";
import { BatchFilterDialog } from "@/components/dialog/BatchFilterDialog";
import { CsvDiffDialog } from "@/components/dialog/CsvDiffDialog";
import { CsvEncodingDialog } from "@/components/dialog/CsvEncodingDialog";
import { DataProfilePanel } from "@/components/panel/DataProfilePanel";
import { AIPanel } from "@/components/panel/AIPanel";
import { ToastContainer } from "@/components/setting/Toast";
import { CommandList } from "@/components/CommandList";
import { CommandPalette, type PaletteItem } from "@/components/CommandPalette";
import { commandIconMap } from "@/components/CommandList";
import { xanCommands } from "@/data/commands";
import { helpDocs, helpDocsZh } from "@/generated/help-docs";
import { MainMenu } from "@/components/menu/MainMenu";
import { MainMenuHooks } from "@/hooks/MainMenuHooks";
import { useLanguage } from "@/i18n";
import { useToast } from "@/hooks/useToast";
import { useLogs } from "@/hooks/useLogs";
import { useUIState } from "@/hooks/useUIState";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useTabs } from "@/hooks/useTabs";
import { usePipelineState } from "@/hooks/usePipelineState";
import { usePipelineVersions } from "@/hooks/usePipelineVersions";
import { useDataLineage } from "@/hooks/useDataLineage";
import { useSession } from "@/hooks/useSession";
import { useKeyboardShortcuts } from "@/hooks/KeyboardShortcuts";
import { formatDateTime } from "@/utils/format";
import { stripStepCommand } from "@/utils/session";
import {
  PipelineStep,
  XanCommand,
  PipelineEdge,
  PipelineVariable,
} from "@/types/xan";
import { AIConfig, DEFAULT_AI_CONFIG } from "@/services/ai/types";
import { loadAIConfig, saveAIConfig, setAIConfig } from "@/services/ai/index";
import pkg from "../package.json";

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aNum = aParts[i] || 0;
    const bNum = bParts[i] || 0;
    if (aNum > bNum) return 1;
    if (aNum < bNum) return -1;
  }
  return 0;
}

function App() {
  return <AppContent />;
}

function AppContent() {
  const { language, t } = useLanguage();

  // Toast
  const { toasts, showToast, showToastRef, removeToastRef } = useToast();

  // Logs
  const { logs, addLog, removeLog, clearLogs } = useLogs();

  // UI visibility state
  const ui = useUIState();

  // App settings
  const settings = useAppSettings(showToastRef);

  // Tabs + CSV loading
  const tabsHook = useTabs(settings.defaultDelimiter, addLog);

  // Pipeline state (undo/redo + updateTabPipeline)
  const pipeline = usePipelineState(
    tabsHook.tabs,
    tabsHook.setTabs,
    tabsHook.selectedTabId,
  );

  // Version control
  const versionsHook = usePipelineVersions(
    tabsHook.tabs,
    tabsHook.setTabs,
    tabsHook.selectedTabId,
  );

  // Data lineage
  const lineageHook = useDataLineage(
    tabsHook.tabs,
    tabsHook.setTabs,
    tabsHook.selectedTabId,
  );

  // Session persistence (tab snapshots restored on startup)
  const session = useSession(
    tabsHook.tabs,
    tabsHook.setTabs,
    tabsHook.selectedTabId,
    tabsHook.setSelectedTabId,
  );

  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const headerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<any>(null);
  const currentVersion = pkg.version;

  // Selected step
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);

  // Executing state
  const [isExecuting, setIsExecuting] = useState(false);

  // Variables panel (F3)
  const [showVariablePanel, setShowVariablePanel] = useState(false);

  // Pipeline save status tracking
  const [pipelineSavedAt, setPipelineSavedAt] = useState<number>(Date.now());
  const markPipelineSaved = useCallback(() => {
    setPipelineSavedAt(Date.now());
  }, []);

  // AI Config
  const [aiConfig, setAIConfigState] = useState<AIConfig>({
    ...DEFAULT_AI_CONFIG,
  });

  useEffect(() => {
    loadAIConfig().then((config) => {
      setAIConfigState(config);
      setAIConfig(config);
    });
  }, []);

  const handleAIConfigChange = useCallback(async (config: AIConfig) => {
    setAIConfigState(config);
    await saveAIConfig(config);
    setAIConfig(config);
  }, []);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    ui.setIsCheckingUpdate(true);
    try {
      const response = await fetch(
        "https://api.github.com/repos/tansen87/easy-csv/releases/latest",
      );
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Expected JSON response, got: ${contentType}`);
      }
      const data = await response.json();
      const latestVersionRaw = data.tag_name || "";
      const latestVersion = latestVersionRaw.replace(/^v/, "");
      const changelog = data.body || "";
      const hasUpdate =
        currentVersion &&
        latestVersion &&
        compareVersions(latestVersion, currentVersion) > 0;

      ui.setUpdateInfo({ hasUpdate, latestVersion, changelog });
      ui.setShowUpdateDialog(true);
    } catch (error) {
      showToastRef.current(`Failed to check for updates: ${error}`, "error");
    } finally {
      ui.setIsCheckingUpdate(false);
    }
  }, [ui, showToastRef, currentVersion]);

  // Command click handler
  const handleCommandClick = useCallback(
    (
      command: XanCommand,
      initialParameters?: Record<string, any>,
      alias?: string,
      autoConnect = false,
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

      const currentPipeline = tabsHook.getCurrentPipeline();
      const currentTab = tabsHook.getCurrentTab();
      const currentEdges = currentTab?.edges || [];

      const sourceId =
        currentPipeline.length > 0
          ? currentPipeline[currentPipeline.length - 1].id
          : "table-node";

      const newEdges = [...currentEdges];
      if (
        autoConnect &&
        !newEdges.some((e) => e.source === sourceId && e.target === newStep.id)
      ) {
        newEdges.push({
          id: `e-${sourceId}-${newStep.id}`,
          source: sourceId,
          target: newStep.id,
        });
      }

      pipeline.updateTabPipeline(
        [...currentPipeline, newStep],
        undefined,
        newEdges,
      );
      setSelectedStep(newStep);
    },
    [tabsHook, pipeline],
  );

  // Multiple commands click handler (batch add)
  const handleCommandsClick = useCallback(
    (commands: { command: XanCommand; parameters?: Record<string, any> }[]) => {
      const currentPipeline = tabsHook.getCurrentPipeline();
      const currentTab = tabsHook.getCurrentTab();
      const currentEdges = currentTab?.edges || [];

      let newSteps: PipelineStep[] = [];
      let newEdges = [...currentEdges];
      let lastSourceId =
        currentPipeline.length > 0
          ? currentPipeline[currentPipeline.length - 1].id
          : "table-node";

      commands.forEach(({ command, parameters }) => {
        const newStep: PipelineStep = {
          id: `${command.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          command,
          parameters: {},
        };

        command.parameters.forEach((param) => {
          if (param.default !== undefined) {
            newStep.parameters[param.name] = param.default;
          }
        });

        if (parameters) {
          newStep.parameters = { ...newStep.parameters, ...parameters };
        }

        newEdges.push({
          id: `e-${lastSourceId}-${newStep.id}`,
          source: lastSourceId,
          target: newStep.id,
        });

        lastSourceId = newStep.id;
        newSteps.push(newStep);
      });

      if (newSteps.length > 0) {
        pipeline.updateTabPipeline(
          [...currentPipeline, ...newSteps],
          undefined,
          newEdges,
        );
        setSelectedStep(newSteps[newSteps.length - 1]);
      }
    },
    [tabsHook, pipeline],
  );

  // Help click
  const handleHelpClick = useCallback(
    (command: XanCommand) => {
      ui.setShowHelp(true);
      const docs = language === "zh" ? helpDocsZh : helpDocs;
      const helpText = docs[command.name];
      if (helpText) {
        ui.setHelpContent(helpText);
        ui.setHelpCommandName(command.name);
      } else {
        ui.setHelpContent(`Help not found for command: ${command.name}`);
        ui.setHelpCommandName(command.name);
      }
    },
    [language, ui],
  );

  // Step click
  const handleStepClick = useCallback((step: PipelineStep) => {
    setSelectedStep(step);
  }, []);

  // Clear input data
  const handleClearInputData = useCallback(() => {
    if (!tabsHook.selectedTabId) return;
    tabsHook.setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabsHook.selectedTabId
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
  }, [tabsHook]);

  // Step remove
  const handleStepRemove = useCallback(
    (stepId: string | string[], extraEdgeIds?: string[]) => {
      const stepIds = Array.isArray(stepId) ? stepId : [stepId];
      const currentPipeline = tabsHook.getCurrentPipeline();
      const currentTab = tabsHook.getCurrentTab();
      const extraIds = new Set(extraEdgeIds || []);
      const updatedPipeline = currentPipeline.filter(
        (s) => !stepIds.includes(s.id),
      );
      const updatedEdges = (currentTab.edges || []).filter(
        (e) =>
          !stepIds.includes(e.source) &&
          !stepIds.includes(e.target) &&
          !extraIds.has(e.id),
      );
      pipeline.updateTabPipeline(updatedPipeline, undefined, updatedEdges);

      if (selectedStep?.id && stepIds.includes(selectedStep.id)) {
        setSelectedStep(null);
      }
    },
    [tabsHook, pipeline, selectedStep],
  );

  // Step update
  const handleStepUpdate = useCallback(
    (stepId: string, parameters: Record<string, any>) => {
      const currentPipeline = tabsHook.getCurrentPipeline();
      const updatedPipeline = currentPipeline.map((step) =>
        step.id === stepId ? { ...step, parameters } : step,
      );
      pipeline.updateTabPipeline(updatedPipeline);
      if (selectedStep?.id === stepId) {
        setSelectedStep({ ...selectedStep, parameters });
      }
    },
    [tabsHook, pipeline, selectedStep],
  );

  // Step alias update
  const handleStepAliasUpdate = useCallback(
    (stepId: string, alias: string) => {
      const currentPipeline = tabsHook.getCurrentPipeline();
      const updatedPipeline = currentPipeline.map((step) =>
        step.id === stepId ? { ...step, alias } : step,
      );
      pipeline.updateTabPipeline(updatedPipeline);
      if (selectedStep?.id === stepId) {
        setSelectedStep({ ...selectedStep, alias });
      }
    },
    [tabsHook, pipeline, selectedStep],
  );

  // Import pipeline from path
  const handleImportPipelineFromPath = useCallback(
    async (filePath: string) => {
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

        pipeline.updateTabPipeline(
          importedPipeline,
          undefined,
          pipelineData.edges,
          pipelineData.inputPosition,
        );
        if (pipelineData.inputFile) {
          tabsHook.loadCsvData(
            tabsHook.selectedTabId,
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
    },
    [pipeline, tabsHook, showToastRef],
  );

  // Open URL
  const handleOpenUrl = useCallback(
    async (url: string) => {
      try {
        await openUrl(url);
      } catch (error) {
        showToastRef.current(`Failed to open URL: ${error}`, "error");
      }
    },
    [showToastRef],
  );

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await invoke("check_xan_installed");
        await settings.loadAll();
        await tabsHook.loadRecentFiles();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };
    initializeApp().finally(() => {
      const restoreAndLoadVersions = async () => {
        const restoredTabs = await session.restoreSession();
        const tabsToLoad =
          restoredTabs.length > 0 ? restoredTabs : tabsHook.tabs;
        for (const tab of tabsToLoad) {
          await versionsHook.loadVersions(tab.id);
        }
      };
      restoreAndLoadVersions().finally(() => session.markHydrated());
    });
  }, []);

  // Load versions when tab changes
  useEffect(() => {
    if (tabsHook.selectedTabId) {
      versionsHook.loadVersions(tabsHook.selectedTabId);
    }
  }, [tabsHook.selectedTabId]);

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
        ui.setShowRefreshDialog(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [ui]);

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
              tabsHook.loadCsvData(tabsHook.selectedTabId, filePath);
            }
          }
        }
      });
    };

    setupDragDrop();
    return () => {
      unlisten?.();
    };
  }, [
    tabsHook.selectedTabId,
    tabsHook.loadCsvData,
    handleImportPipelineFromPath,
  ]);

  // System notification on pipeline complete
  const prevExecutingRef = useRef(isExecuting);
  useEffect(() => {
    if (
      prevExecutingRef.current &&
      !isExecuting &&
      settings.systemNotification
    ) {
      const now = new Date();
      const time = now.toLocaleTimeString();
      sendNotification({
        title: "Easy CSV",
        body: `Pipeline execution completed at ${time}`,
      });
    }
    prevExecutingRef.current = isExecuting;
  }, [isExecuting, settings.systemNotification]);

  // Window title
  useEffect(() => {
    const updateTitle = async () => {
      const currentTab = tabsHook.tabs.find(
        (tab) => tab.id === tabsHook.selectedTabId,
      );
      const inputFile = currentTab?.inputFile || "";
      try {
        const title = inputFile ? `${inputFile} - Easy Csv` : "Easy Csv";
        await invoke("set_window_title", { title });
      } catch (error) {
        showToastRef.current(`Failed to set window title: ${error}`, "error");
      }
    };
    updateTitle();
  }, [tabsHook.selectedTabId, tabsHook.tabs, showToastRef]);

  // Click outside menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        ui.activeMenu &&
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        ui.setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ui.activeMenu]);

  // MainMenuHooks
  const {
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleExportPipeline,
    handleImportPipeline,
    handleExecute,
    handleCancelExecution,
    resultPreview,
    variablePrompt,
    confirmVariables,
    cancelVariables,
  } = MainMenuHooks({
    tabs: tabsHook.tabs,
    selectedTabId: tabsHook.selectedTabId,
    defaultDelimiter: settings.defaultDelimiter,
    setDefaultDelimiter: settings.setDefaultDelimiter,
    showToast,
    addLog,
    setTabs: tabsHook.setTabs,
    setSelectedTabId: tabsHook.setSelectedTabId,
    setUndoStack: pipeline.setUndoStack,
    setRedoStack: pipeline.setRedoStack,
    setSelectedStep,
    setIsExecuting,
    setShowLogPanel: ui.setShowLogPanel,
    setShowProgressBar: ui.setShowProgressBar,
    setBranchProgress: ui.setBranchProgress,
    progressHideTimerRef,
    loadCsvData: tabsHook.loadCsvData,
    formatDateTime,
    trackLineage: lineageHook.trackLineage,
    setShowChartPanel: ui.setShowChartPanel,
    setChartConfig: ui.setChartConfig,
    setChartSeries: ui.setChartSeries,
    setChartHeaders: ui.setChartHeaders,
    saveVersion: versionsHook.saveVersion,
  });

  // Wrap save/execute/export callbacks to update pipeline save timestamp
  const handleExecuteAndMarkSaved = useCallback(() => {
    handleExecute();
    markPipelineSaved();
  }, [handleExecute, markPipelineSaved]);

  const handleSavePipelineAndMarkSaved = useCallback(() => {
    handleSavePipeline();
    markPipelineSaved();
  }, [handleSavePipeline, markPipelineSaved]);

  const handleExportPipelineAndMarkSaved = useCallback(() => {
    handleExportPipeline();
    markPipelineSaved();
  }, [handleExportPipeline, markPipelineSaved]);

  const handleSaveVersionAndMarkSaved = useCallback(
    async (message?: string, tags?: string[]) => {
      const result = await versionsHook.saveVersion(message, tags);
      markPipelineSaved();
      return result;
    },
    [versionsHook.saveVersion, markPipelineSaved],
  );

  // Keyboard shortcuts (O-3: moved to App level)
  useKeyboardShortcuts(
    {
      onOpenFile: handleOpenFile,
      onOpenNewTabWithFile: handleOpenNewTabWithFile,
      onSavePipeline: handleSavePipelineAndMarkSaved,
      onImportPipeline: handleImportPipeline,
      onExportPipeline: handleExportPipelineAndMarkSaved,
      onUndo: () => {
        pipeline.undo();
        setSelectedStep(null);
      },
      onRedo: () => {
        pipeline.redo();
        setSelectedStep(null);
      },
      onExecute: handleExecuteAndMarkSaved,
      onHelp: () => {
        ui.setHelpCommandName(language === "zh" ? "帮助" : "Help");
        ui.setHelpContent(getHelpContent(language));
        ui.setShowHelp(true);
      },
      onCheckUpdate: checkForUpdates,
      onShowSettings: () => ui.setShowSettingsDialog(true),
      onCommands: () => ui.setShowCommandPanel(!ui.showCommandPanel),
      onLogs: () => ui.setShowLogPanel(!ui.showLogPanel),
      onAI: () => ui.setShowAIPanel(!ui.showAIPanel),
      onCommandPalette: () => ui.setShowCommandPalette(!ui.showCommandPalette),
    },
    {
      undoStackLength: pipeline.undoStack.length,
      redoStackLength: pipeline.redoStack.length,
      currentPipelineLength: tabsHook.getCurrentPipeline().length,
      isExecuting,
    },
  );

  // Memoized callbacks for HomeView (O-5)
  const onEdgesChange = useCallback(
    (tabId: string, edges: PipelineEdge[]) => {
      tabsHook.setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabId
            ? { ...tab, edges, updatedAt: formatDateTime(new Date()) }
            : tab,
        ),
      );
    },
    [tabsHook.setTabs],
  );

  const onInputPositionChange = useCallback(
    (tabId: string, position: { x: number; y: number }) => {
      tabsHook.setTabs((prev) =>
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
    },
    [tabsHook.setTabs],
  );

  // persist declared pipeline variables for the active tab.
  const onVariablesChange = useCallback(
    (next: PipelineVariable[]) => {
      tabsHook.setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabsHook.selectedTabId
            ? {
                ...tab,
                variables: next,
                updatedAt: formatDateTime(new Date()),
              }
            : tab,
        ),
      );
    },
    [tabsHook.setTabs, tabsHook.selectedTabId],
  );

  const onToggleVariablePanel = useCallback(
    () => setShowVariablePanel((v) => !v),
    [],
  );

  // Stable HomeView callbacks so the memoized HomeView (and the React Flow
  // canvas beneath it) do not re-render on unrelated context changes (theme,
  // language). Inline arrows below would otherwise defeat React.memo.
  const onOpenBatchFilter = useCallback(
    (x: number, y: number) => ui.setBatchFilterDialog({ x, y }),
    [ui],
  );

  const onToggleVersionPanel = useCallback(
    () => ui.setShowVersionPanel(!ui.showVersionPanel),
    [ui.showVersionPanel],
  );

  const onToggleLineagePanel = useCallback(
    () => ui.setShowLineagePanel(!ui.showLineagePanel),
    [ui.showLineagePanel],
  );

  const onOpenCommandPalette = useCallback(
    () => ui.setShowCommandPalette(true),
    [ui],
  );

  const currentTab = tabsHook.getCurrentTab();

  const currentSnapshot = useMemo(
    () =>
      currentTab
        ? {
            steps: (currentTab.pipeline || []).map(stripStepCommand),
            edges: currentTab.edges || [],
          }
        : undefined,
    [currentTab],
  );

  const onOpenRecentFile = useCallback(
    async (filePath: string) => {
      const fileExists = await invoke<boolean>("file_exists", { filePath });
      if (fileExists) {
        tabsHook.loadCsvData(tabsHook.selectedTabId, filePath);
      } else {
        const updated = tabsHook.recentFiles.filter((f) => f.path !== filePath);
        tabsHook.setRecentFiles(updated);
        try {
          await invoke("save_recent_files", {
            recentFiles: JSON.stringify(updated, null, 2),
          });
        } catch {}
        showToastRef.current("File does not exist", "info");
      }
    },
    [tabsHook, showToastRef],
  );

  const onHelp = useCallback(() => {
    ui.setHelpCommandName(language === "zh" ? "帮助" : "Help");
    ui.setHelpContent(getHelpContent(language));
    ui.setShowHelp(true);
  }, [language, ui]);

  const onToggleCommandPanel = useCallback(
    () => ui.setShowCommandPanel(!ui.showCommandPanel),
    [ui.showCommandPanel],
  );
  const onToggleLogPanel = useCallback(
    () => ui.setShowLogPanel(!ui.showLogPanel),
    [ui.showLogPanel],
  );
  const onToggleDataProfile = useCallback(
    () => ui.setShowDataProfile(!ui.showDataProfile),
    [ui.showDataProfile],
  );
  const onShowSettings = useCallback(() => ui.setShowSettingsDialog(true), []);

  // Settings save
  const handleSaveSettings = useCallback(async () => {
    try {
      await invoke("set_default_delimiter", {
        delimiter: settings.defaultDelimiter,
      });
      await invoke("set_no_headers", { noHeaders: settings.noHeaders });
      await invoke("set_system_notification", {
        show: settings.systemNotification,
      });
      await invoke("set_minimize_to_tray", {
        minimize: settings.minimizeToTray,
      });
      await invoke("set_double_click_fit_view", {
        enabled: settings.doubleClickFitView,
      });
    } catch (error) {
      showToastRef.current(`Failed to save settings: ${error}`, "error");
    }
  }, [settings, showToastRef]);

  const hasInputFile = !!tabsHook.getCurrentTab()?.inputFile;

  const currentPipelineLength = tabsHook.getCurrentPipeline().length;
  const undoStackLength = pipeline.undoStack.length;
  const redoStackLength = pipeline.redoStack.length;

  // Command palette items
  const paletteItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: "open-file",
        label: t.open,
        description: t.openFileFormats,
        icon: FolderOpen,
        group: t.paletteActions,
        shortcut: "Ctrl+O",
        onSelect: handleOpenFile,
      },
      {
        id: "open-new-tab",
        label: t.openNewTab,
        icon: FileText,
        group: t.paletteActions,
        shortcut: "Ctrl+N",
        onSelect: handleOpenNewTabWithFile,
      },
      {
        id: "save-pipeline",
        label: t.savePipeline,
        icon: Save,
        group: t.paletteActions,
        shortcut: "Ctrl+S",
        disabled: currentPipelineLength === 0,
        onSelect: handleSavePipelineAndMarkSaved,
      },
      {
        id: "import-workflow",
        label: t.importWorkflow,
        icon: Upload,
        group: t.paletteActions,
        shortcut: "Ctrl+I",
        onSelect: handleImportPipeline,
      },
      {
        id: "export-workflow",
        label: t.exportWorkflow,
        icon: Download,
        group: t.paletteActions,
        shortcut: "Ctrl+E",
        disabled: currentPipelineLength === 0,
        onSelect: handleExportPipelineAndMarkSaved,
      },
      {
        id: "undo",
        label: t.undo,
        icon: Undo2,
        group: t.paletteActions,
        shortcut: "Ctrl+Z",
        disabled: undoStackLength === 0,
        onSelect: () => {
          pipeline.undo();
          setSelectedStep(null);
        },
      },
      {
        id: "redo",
        label: t.redo,
        icon: Redo2,
        group: t.paletteActions,
        shortcut: "Ctrl+Y",
        disabled: redoStackLength === 0,
        onSelect: () => {
          pipeline.redo();
          setSelectedStep(null);
        },
      },
      {
        id: "execute",
        label: t.execute,
        icon: Play,
        group: t.paletteActions,
        shortcut: "Ctrl+R",
        disabled: currentPipelineLength === 0 || isExecuting,
        onSelect: handleExecuteAndMarkSaved,
      },
      {
        id: "settings",
        label: t.settings,
        icon: Settings,
        group: t.paletteActions,
        shortcut: "Shift+S",
        onSelect: onShowSettings,
      },
      {
        id: "check-update",
        label: t.checkUpdate,
        icon: CloudDownload,
        group: t.paletteActions,
        shortcut: "Shift+C",
        onSelect: checkForUpdates,
      },
      {
        id: "help",
        label: t.help,
        icon: MessageCircleQuestionMark,
        group: t.paletteActions,
        shortcut: "Shift+H",
        onSelect: onHelp,
      },
      {
        id: "refresh",
        label: t.refreshTitle,
        icon: RefreshCw,
        group: t.paletteActions,
        shortcut: "F5",
        onSelect: () => ui.setShowRefreshDialog(true),
      },
      {
        id: "toggle-command-panel",
        label: t.commandPanel,
        icon: CommandIcon,
        group: t.paletteActions,
        shortcut: "Alt+C",
        onSelect: onToggleCommandPanel,
      },
      {
        id: "toggle-log-panel",
        label: t.logPanel,
        icon: FileText,
        group: t.paletteActions,
        shortcut: "Alt+Q",
        onSelect: onToggleLogPanel,
      },
      {
        id: "toggle-data-profile",
        label: t.dataProfile,
        icon: BarChart3,
        group: t.paletteActions,
        disabled: !hasInputFile,
        onSelect: onToggleDataProfile,
      },
      {
        id: "toggle-version-panel",
        label: t.versionHistory,
        icon: GitBranch,
        group: t.paletteActions,
        onSelect: () => ui.setShowVersionPanel(!ui.showVersionPanel),
      },
      {
        id: "toggle-lineage-panel",
        label: t.dataLineage,
        icon: GitMerge,
        group: t.paletteActions,
        onSelect: () => ui.setShowLineagePanel(!ui.showLineagePanel),
      },
      {
        id: "toggle-ai-panel",
        label: t.ai,
        icon: Bot,
        group: t.paletteActions,
        shortcut: "Alt+A",
        onSelect: () => ui.setShowAIPanel(!ui.showAIPanel),
      },
      {
        id: "csv-diff",
        label: t.csvDiff,
        description: t.csvDiffNoResult,
        icon: GitCompareArrows,
        group: t.paletteActions,
        onSelect: () => {
          ui.setCsvDiffInitialFileA(
            tabsHook.getCurrentTab()?.inputFile || undefined,
          );
          ui.setShowCsvDiff(true);
        },
      },
      {
        id: "csv-encoding",
        label: t.csvEncoding,
        description: t.csvEncoding,
        icon: FileCode,
        group: t.paletteActions,
        onSelect: () => {
          ui.setCsvEncodingInitialInput(
            tabsHook.getCurrentTab()?.inputFile || undefined,
          );
          ui.setShowCsvEncoding(true);
        },
      },
    ];

    const tabs: PaletteItem[] = tabsHook.tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      label: tab.name,
      description: tab.inputFile || tab.id,
      icon: FileText,
      group: t.paletteTabs,
      onSelect: () => tabsHook.setSelectedTabId(tab.id),
    }));

    const recent: PaletteItem[] = tabsHook.recentFiles.map((file) => ({
      id: `recent-${file.path}`,
      label: file.name,
      description: file.path,
      icon: FolderOpen,
      group: t.recentFiles,
      onSelect: () => onOpenRecentFile(file.path),
    }));

    const commands: PaletteItem[] = xanCommands.map((cmd) => {
      const Icon = commandIconMap[cmd.name] || CommandIcon;
      return {
        id: `cmd-${cmd.id}`,
        label: cmd.name,
        description: language === "zh" ? cmd.descriptionCn : cmd.description,
        keywords: cmd.category,
        icon: Icon,
        group: t.paletteCommands,
        onSelect: () => handleCommandClick(cmd),
      };
    });

    return [...actions, ...tabs, ...recent, ...commands];
  }, [
    t,
    language,
    undoStackLength,
    redoStackLength,
    isExecuting,
    hasInputFile,
    tabsHook.tabs,
    tabsHook.recentFiles,
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleImportPipeline,
    handleExportPipeline,
    handleExecute,
    handleCommandClick,
    onOpenRecentFile,
    onShowSettings,
    checkForUpdates,
    onHelp,
    onToggleCommandPanel,
    onToggleLogPanel,
    onToggleDataProfile,
    pipeline,
    setSelectedStep,
    ui,
  ]);

  return (
    <>
      {
        <div className="h-screen relative overflow-hidden">
          <header
            ref={headerRef}
            className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-4 gap-4 z-20"
            onContextMenu={(e) => e.preventDefault()}
          >
            <MainMenu
              activeMenu={ui.activeMenu}
              setActiveMenu={ui.setActiveMenu}
              isMenuActivated={ui.isMenuActivated}
              setIsMenuActivated={ui.setIsMenuActivated}
              undoStack={pipeline.undoStack}
              redoStack={pipeline.redoStack}
              onUndo={() => {
                pipeline.undo();
                setSelectedStep(null);
              }}
              onRedo={() => {
                pipeline.redo();
                setSelectedStep(null);
              }}
              onExecute={handleExecuteAndMarkSaved}
              onOpenFile={handleOpenFile}
              onOpenNewTabWithFile={handleOpenNewTabWithFile}
              onSavePipeline={handleSavePipelineAndMarkSaved}
              onImportPipeline={handleImportPipeline}
              onExportPipeline={handleExportPipelineAndMarkSaved}
              onHelp={onHelp}
              onCheckUpdate={checkForUpdates}
              onShowSettings={onShowSettings}
              onOpenPalette={() => ui.setShowCommandPalette(true)}
              onOpenCsvDiff={() => {
                ui.setCsvDiffInitialFileA(
                  tabsHook.getCurrentTab()?.inputFile || undefined,
                );
                ui.setShowCsvDiff(true);
              }}
              onOpenCsvEncoding={() => {
                ui.setCsvEncodingInitialInput(
                  tabsHook.getCurrentTab()?.inputFile || undefined,
                );
                ui.setShowCsvEncoding(true);
              }}
              isExecuting={isExecuting}
              isCheckingUpdate={ui.isCheckingUpdate}
              hasUpdate={!!ui.updateInfo?.hasUpdate}
              showLogErrorBadge={
                !ui.showLogPanel && logs.some((l) => l.type === "error")
              }
              currentPipelineLength={tabsHook.getCurrentPipeline().length}
              showCommandPanel={ui.showCommandPanel}
              onToggleCommandPanel={onToggleCommandPanel}
              showLogPanel={ui.showLogPanel}
              onToggleLogPanel={onToggleLogPanel}
              showDataProfile={ui.showDataProfile}
              onToggleDataProfile={onToggleDataProfile}
              hasInputFile={!!tabsHook.getCurrentTab()?.inputFile}
              showVersionPanel={ui.showVersionPanel}
              onToggleVersionPanel={() =>
                ui.setShowVersionPanel(!ui.showVersionPanel)
              }
              showLineagePanel={ui.showLineagePanel}
              onToggleLineagePanel={() =>
                ui.setShowLineagePanel(!ui.showLineagePanel)
              }
              showAIPanel={ui.showAIPanel}
              onToggleAIPanel={() => ui.setShowAIPanel(!ui.showAIPanel)}
              showVariablePanel={showVariablePanel}
              onToggleVariablePanel={onToggleVariablePanel}
            />
          </header>

          <main className="absolute inset-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <HomeView
                tabs={tabsHook.tabs}
                selectedTabId={tabsHook.selectedTabId}
                onTabChange={tabsHook.setSelectedTabId}
                onRemoveTab={tabsHook.removeTab}
                onRenameTab={tabsHook.renameTab}
                resultPreview={resultPreview}
                onAddCommand={handleCommandClick}
                onStepClick={handleStepClick}
                onStepUpdate={handleStepUpdate}
                onStepAliasUpdate={handleStepAliasUpdate}
                onStepDelete={handleStepRemove}
                onTableDelete={handleClearInputData}
                onPipelineReorder={pipeline.updateTabPipeline}
                onEdgesChange={onEdgesChange}
                onInputPositionChange={onInputPositionChange}
                onOpenFile={handleOpenFile}
                onImportPipeline={handleImportPipeline}
                onOpenBatchFilter={onOpenBatchFilter}
                onOpenUrl={handleOpenUrl}
                branchProgress={ui.branchProgress}
                showProgressBar={ui.showProgressBar}
                isExecuting={isExecuting}
                onCancelExecution={handleCancelExecution}
                recentFiles={tabsHook.recentFiles}
                onOpenRecentFile={onOpenRecentFile}
                reactFlowInstanceRef={reactFlowInstanceRef}
                showVersionPanel={ui.showVersionPanel}
                showLineagePanel={ui.showLineagePanel}
                onToggleVersionPanel={onToggleVersionPanel}
                onToggleLineagePanel={onToggleLineagePanel}
                versions={versionsHook.getCurrentVersions()}
                currentVersionId={tabsHook.getCurrentTab()?.currentVersionId}
                currentSnapshot={currentSnapshot}
                onSaveVersion={handleSaveVersionAndMarkSaved}
                onRestoreVersion={versionsHook.restoreVersion}
                onDeleteVersion={versionsHook.deleteVersion}
                onClearAllVersions={versionsHook.clearAllVersions}
                onAddTag={versionsHook.addTag}
                onRemoveTag={versionsHook.removeTag}
                onRenameVersion={versionsHook.renameVersion}
                isSavingVersion={versionsHook.isSavingVersion}
                lineageData={lineageHook.lineageData}
                onGetLineageForColumn={lineageHook.getLineageForColumn}
                onSaveLineage={lineageHook.saveLineage}
                pipelineSavedAt={pipelineSavedAt}
                doubleClickFitView={settings.doubleClickFitView}
                onSavePipeline={handleSavePipelineAndMarkSaved}
                onOpenCommandPalette={onOpenCommandPalette}
              />
            </div>
          </main>

          <CommandList
            commands={xanCommands}
            onCommandClick={handleCommandClick}
            onHelpClick={handleHelpClick}
            selectedCommandId={selectedStep?.command.id}
            searchQuery={ui.searchQuery}
            onSearchChange={ui.setSearchQuery}
            isVisible={ui.showCommandPanel}
            onClose={() => ui.setShowCommandPanel(false)}
          />

          <CommandPalette
            isOpen={ui.showCommandPalette}
            onClose={() => ui.setShowCommandPalette(false)}
            items={paletteItems}
          />

          <LogPanel
            logs={logs}
            onClear={clearLogs}
            onRemoveLog={removeLog}
            isVisible={ui.showLogPanel}
            onClose={() => ui.setShowLogPanel(false)}
          />

          <ChartPanel
            config={ui.chartConfig!}
            series={ui.chartSeries}
            isVisible={ui.showChartPanel}
            onClose={() => ui.setShowChartPanel(false)}
          />

          <HelpDialog
            isOpen={ui.showHelp}
            onClose={() => ui.setShowHelp(false)}
            commandName={ui.helpCommandName}
            content={ui.helpContent}
          />

          <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />

          <SettingsDialog
            isOpen={ui.showSettingsDialog}
            onClose={() => ui.setShowSettingsDialog(false)}
            defaultDelimiter={settings.defaultDelimiter}
            onDefaultDelimiterChange={settings.setDefaultDelimiter}
            noHeaders={settings.noHeaders}
            onNoHeadersChange={settings.setNoHeaders}
            systemNotification={settings.systemNotification}
            onSystemNotificationChange={settings.setSystemNotification}
            minimizeToTray={settings.minimizeToTray}
            onMinimizeToTrayChange={settings.setMinimizeToTray}
            doubleClickFitView={settings.doubleClickFitView}
            onDoubleClickFitViewChange={settings.setDoubleClickFitView}
            onSave={handleSaveSettings}
            aiConfig={aiConfig}
            onAIConfigChange={handleAIConfigChange}
          />

          <UpdateDialog
            isOpen={ui.showUpdateDialog}
            onClose={() => ui.setShowUpdateDialog(false)}
            updateInfo={ui.updateInfo}
            currentVersion={currentVersion}
          />

          <ConfirmDialog
            isOpen={ui.showRefreshDialog}
            title={t.refreshTitle}
            message={t.refreshMessage}
            onConfirm={() => {
              ui.setShowRefreshDialog(false);
              window.location.reload();
            }}
            onCancel={() => ui.setShowRefreshDialog(false)}
          />

          {ui.batchFilterDialog && (
            <BatchFilterDialog
              state={ui.batchFilterDialog}
              headers={tabsHook.getCurrentTab()?.headers || []}
              onAddCommand={handleCommandClick}
              onClose={() => ui.setBatchFilterDialog(null)}
            />
          )}

          <CsvDiffDialog
            isOpen={ui.showCsvDiff}
            onClose={() => ui.setShowCsvDiff(false)}
            defaultDelimiter={settings.defaultDelimiter}
            initialFileA={ui.csvDiffInitialFileA}
          />

          <CsvEncodingDialog
            isOpen={ui.showCsvEncoding}
            onClose={() => ui.setShowCsvEncoding(false)}
            initialInputFile={ui.csvEncodingInitialInput}
            onShowToast={showToast}
          />

          {/* Data Profile Panel */}
          <div
            className={`absolute top-0 right-0 h-full z-20 transition-all duration-300 ${
              ui.showDataProfile ? "w-80" : "w-0"
            }`}
          >
            {ui.showDataProfile && (
              <div className="h-full bg-card border-l border-border/50 shadow-lg">
                <DataProfilePanel
                  filePath={tabsHook.getCurrentTab()?.inputFile || ""}
                  delimiter={settings.defaultDelimiter}
                  isVisible={ui.showDataProfile}
                  onClose={() => ui.setShowDataProfile(false)}
                />
              </div>
            )}
          </div>

          <AIPanel
            isVisible={ui.showAIPanel}
            onClose={() => ui.setShowAIPanel(false)}
            context={{
              headers: tabsHook.getCurrentTab()?.headers || [],
              pipelineSteps: tabsHook.getCurrentPipeline().length,
              inputFile: tabsHook.getCurrentTab()?.inputFile,
            }}
            onAddCommand={handleCommandClick}
            onAddCommands={handleCommandsClick}
          />

          {variablePrompt && (
            <VariableValuesDialog
              prompt={variablePrompt}
              onConfirm={confirmVariables}
              onCancel={cancelVariables}
            />
          )}

          {/* Pipeline variables panel (right drawer) */}
          <div
            className={`absolute top-0 right-0 h-full z-30 transition-all duration-300 ${
              showVariablePanel ? "w-80" : "w-0"
            }`}
          >
            {showVariablePanel && (
              <div className="h-full bg-card border-l border-border/50 shadow-lg">
                <VariablePanel
                  steps={tabsHook.getCurrentTab()?.pipeline || []}
                  variables={tabsHook.getCurrentTab()?.variables || []}
                  onChange={onVariablesChange}
                  onClose={onToggleVariablePanel}
                />
              </div>
            )}
          </div>
        </div>
      }
    </>
  );
}

export default App;
