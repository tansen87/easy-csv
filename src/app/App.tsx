import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import {
  open as openDialog,
  save as saveDialog,
} from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import {
  FileClock,
  NotebookTabs,
  ListTree,
  Zap,
  LibraryBig,
} from "lucide-react";

import { LogPanel } from "@/modules/logs/LogPanel";
import { ChartPanel } from "@/modules/data-preview/charts/ChartPanel";
import { SettingsDialog } from "@/components/setting/SettingsDialog";
import { HomeView } from "@/modules/data-preview/HomeView";
import { HelpDialog } from "@/components/help/HelpDialog";
import { getHelpContent } from "@/components/help/HelpContent";
import { UpdateDialog } from "@/modules/dialogs/app/UpdateDialog";
import { ConfirmDialog } from "@/modules/dialogs/common/ConfirmDialog";
import { PipelineTemplateDialog } from "@/modules/dialogs/file/PipelineTemplateDialog";
import { VariableValuesDialog } from "@/modules/dialogs/common/VariableValuesDialog";
import { ExecutionHistoryDialog } from "@/modules/dialogs/app/ExecutionHistoryDialog";
import { VariablePanel } from "@/modules/variables/VariablePanel";
import { CsvDiffDialog } from "@/modules/dialogs/file/CsvDiffDialog";
import { CsvEncodingDialog } from "@/modules/dialogs/file/CsvEncodingDialog";
import { SeparateCSVDialog } from "@/modules/dialogs/file/SeparateCSVDialog";
import { SplitLinesDialog } from "@/modules/dialogs/file/SplitLinesDialog";
import { DataProfilePanel } from "@/modules/data-preview/DataProfilePanel";
import { AIPanel } from "@/modules/ai/AIPanel";
import { ToastContainer } from "@/components/setting/Toast";
import { CommandList } from "@/modules/logs/CommandList";
import {
  CommandPalette,
  type PaletteItem,
} from "@/modules/logs/CommandPalette";
import { xanCommands } from "@/data/commands";
import { helpDocs, helpDocsZh } from "@/generated/help-docs";
import { MainMenu } from "@/components/menu/MainMenu";
import { usePipelineTabs } from "@/hooks/usePipelineTabs";
import { useFileOpen } from "@/hooks/fileIO/useFileOpen";
import { useFileSave } from "@/hooks/fileIO/useFileSave";
import { useImportExport } from "@/hooks/fileIO/useImportExport";
import { useExecution } from "@/hooks/execution/useExecution";
import { useSaveIntermediate } from "@/hooks/execution/useSaveIntermediate";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { useDialogStack } from "@/hooks/useDialogStack";
import { useLanguage } from "@/i18n";
import { translations } from "@/i18n/translations";
import { useToast } from "@/hooks/useToast";
import { useLogs } from "@/hooks/useLogs";
import { useUIState } from "@/hooks/useUIState";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useTabs } from "@/hooks/useTabs";
import { usePipelineState } from "@/hooks/usePipelineState";
import { usePipelineVersions } from "@/hooks/usePipelineVersions";
import { usePipelineTemplates } from "@/hooks/usePipelineTemplates";
import { useDataLineage } from "@/hooks/useDataLineage";
import { useSession } from "@/hooks/useSession";
import { useExecutionHistory } from "@/hooks/useExecutionHistory";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useUpdater } from "@/hooks/useUpdater";

/** Delay before the silent startup update check, in ms (design 022 §5.4). */
const AUTO_UPDATE_CHECK_DELAY_MS = 5000;
import { formatDateTime } from "@/utils/format";
import {
  delimiterModeFromSettings,
  settingsPatchForMode,
} from "@/utils/delimiterMode";
import {
  stripStepCommand,
  serializeTabSnapshot,
  deserializeTabSnapshot,
} from "@/utils/session";
import {
  PipelineStep,
  XanCommand,
  PipelineEdge,
  PipelineVariable,
  PipelineTemplate,
  DelimiterMode,
} from "@/types/xan";
import { AIConfig, DEFAULT_AI_CONFIG } from "@/services/ai/types";
import { loadAIConfig, saveAIConfig, setAIConfig } from "@/services/ai/index";

function App() {
  return <AppContent />;
}

function AppContent() {
  const { effectiveLanguage, t } = useLanguage();

  // Toast
  const { toasts, showToast, showToastRef, removeToastRef } = useToast();

  // Logs
  const { logs, addLog, removeLog, clearLogs } = useLogs();

  // UI visibility state
  const ui = useUIState();

  // App settings
  const settings = useAppSettings(showToastRef);

  // Tabs + CSV loading
  const tabsHook = useTabs(
    settings.defaultDelimiter,
    addLog,
    settings.autoDetectDelimiter,
  );

  /**
   * The app-wide delimiter mode, edited from two places that are mirrors of each
   * other: the settings page and the input node's badge (design 018 §3.9).
   */
  const delimiterMode: DelimiterMode = delimiterModeFromSettings(
    settings.autoDetectDelimiter,
    settings.defaultDelimiter,
  );

  const onDelimiterModeChange = useCallback(
    (mode: DelimiterMode) => {
      const patch = settingsPatchForMode(mode);
      if (patch.delimiter !== undefined) {
        settings.setDefaultDelimiter(patch.delimiter);
      }
      settings.setAutoDetectDelimiter(patch.autoDetectDelimiter);
      // Persist right away: the change also reloads the open tabs, so it must
      // survive a restart even when it was made outside the settings dialog.
      invoke("set_auto_detect_delimiter", {
        enabled: patch.autoDetectDelimiter,
      }).catch((error) =>
        showToastRef.current(
          `Failed to save delimiter setting: ${error}`,
          "error",
        ),
      );
      if (patch.delimiter !== undefined) {
        invoke("set_default_delimiter", { delimiter: patch.delimiter }).catch(
          () => {},
        );
      }
    },
    [settings.setDefaultDelimiter, settings.setAutoDetectDelimiter],
  );

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

  // Execution history
  const executionHistory = useExecutionHistory();

  // Auto-update (design 022). `beforeInstall` flushes the session because the
  // Windows installer quits the app before replacing it.
  const updater = useUpdater({
    showToast,
    beforeInstall: () => session.flushSession(),
  });

  // AI panel expanded state is derived from the persisted panel state
  // (default: collapsed strip), and drives the LogPanel avoidance offset.
  const aiPanelExpanded =
    session.panelStates.aiPanel?.collapsed === undefined
      ? false
      : !session.panelStates.aiPanel.collapsed;
  const aiBottomOffset: number | string = useMemo(() => {
    if (!ui.showAIPanel || !aiPanelExpanded) return 0;
    // 36vh message area + header + input strip.
    return "calc(36vh + 96px)";
  }, [ui.showAIPanel, aiPanelExpanded]);

  // D2: collapsed capsules stack in a fixed order at the top-right corner,
  // below the app header (48px), one slot per collapsed panel.
  const collapsedStack = useMemo(() => {
    const order = ["chartPanel"] as const;
    const result: Partial<Record<(typeof order)[number], number>> = {};
    let slot = 0;
    for (const key of order) {
      if (session.panelStates[key]?.collapsed) {
        result[key] = 56 + slot * 44;
        slot++;
      }
    }
    return result;
  }, [session.panelStates.chartPanel?.collapsed]);

  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const headerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<any>(null);

  // Unified dialog switch stack for App-local dialogs (019 §4.4). The ui.*
  // switches migrate over in batches; these are the first adopters.
  const dialogs = useDialogStack<"history" | "templates">();

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

  // Check for updates. Interactive checks always surface the dialog; the
  // caller decides, because a silent startup check must not pop one open.
  const checkForUpdates = useCallback(
    async (options?: { silent?: boolean }) => {
      const result = await updater.check(options);
      if (!options?.silent) ui.setShowUpdateDialog(true);
      return result;
    },
    [updater, ui],
  );

  // Silent update check shortly after launch (design 022 §5.4). Delayed so it
  // never competes with session restore or the first paint, and it only ever
  // flags availability — installing stays a user action.
  const checkForUpdatesRef = useRef(checkForUpdates);
  checkForUpdatesRef.current = checkForUpdates;
  const autoCheckStartedRef = useRef(false);
  useEffect(() => {
    if (autoCheckStartedRef.current) return;
    autoCheckStartedRef.current = true;
    let timer: number | undefined;
    void (async () => {
      // Read the persisted preference directly: this effect runs before
      // `settings.loadAll()` resolves, so the state value would still be the
      // default and a user who turned the check off would be ignored.
      const enabled = await invoke<boolean | null>("get_auto_check_update");
      if (enabled === false) return;
      timer = window.setTimeout(() => {
        void checkForUpdatesRef.current({ silent: true });
      }, AUTO_UPDATE_CHECK_DELAY_MS);
    })();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

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
      const docs = effectiveLanguage === "zh" ? helpDocsZh : helpDocs;
      const helpText = docs[command.name];
      if (helpText) {
        ui.setHelpContent(helpText);
        ui.setHelpCommandName(command.name);
      } else {
        ui.setHelpContent(`Help not found for command: ${command.name}`);
        ui.setHelpCommandName(command.name);
      }
    },
    [effectiveLanguage, ui],
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

  // App bootstrap & global listeners — owned by useAppBootstrap
  const initializeApp = useCallback(async () => {
    await invoke("check_xan_installed");
    await settings.loadAll();
    await tabsHook.loadRecentFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.loadAll, tabsHook.loadRecentFiles]);

  useAppBootstrap({
    initialize: initializeApp,
    restoreSession: session.restoreSession,
    onRestoreComplete: session.markHydrated,
    loadVersions: versionsHook.loadVersions,
    selectedTabId: tabsHook.selectedTabId,
    loadCsvData: tabsHook.loadCsvData,
    importPipelineFromPath: handleImportPipelineFromPath,
    showRefreshDialog: () => ui.setShowRefreshDialog(true),
    systemNotification: settings.systemNotification,
    isExecuting,
    tabs: tabsHook.tabs,
    showToastRef,
  });

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

  // Pipeline tab helpers (split from former MainMenuHooks)
  const tabsCtl = usePipelineTabs({
    tabs: tabsHook.tabs,
    selectedTabId: tabsHook.selectedTabId,
    defaultDelimiter: settings.defaultDelimiter,
    setTabs: tabsHook.setTabs,
    setSelectedTabId: tabsHook.setSelectedTabId,
    setUndoStack: pipeline.setUndoStack,
    setRedoStack: pipeline.setRedoStack,
    setSelectedStep,
    formatDateTime,
  });

  const { handleOpenFile, handleOpenNewTabWithFile } = useFileOpen({
    selectedTabId: tabsHook.selectedTabId,
    addNewTab: tabsCtl.addNewTab,
    loadCsvData: tabsHook.loadCsvData,
  });

  const { handleSavePipeline } = useFileSave({
    getCurrentPipeline: tabsCtl.getCurrentPipeline,
    getCurrentTab: tabsCtl.getCurrentTab,
    resolveRunDelimiter: tabsCtl.resolveRunDelimiter,
    showToast,
  });

  const { handleExportPipeline, handleImportPipeline } = useImportExport({
    getCurrentPipeline: tabsCtl.getCurrentPipeline,
    getCurrentTab: tabsCtl.getCurrentTab,
    resolveRunDelimiter: tabsCtl.resolveRunDelimiter,
    showToast,
    formatDateTime,
    updateTabPipeline: tabsCtl.updateTabPipeline,
    loadCsvData: tabsHook.loadCsvData,
    selectedTabId: tabsHook.selectedTabId,
  });

  const {
    handleExecute,
    handleCancelExecution,
    resultPreview,
    overwriteConfirm,
    confirmOverwriteExecution,
    cancelOverwriteExecution,
    variablePrompt,
    confirmVariables,
    cancelVariables,
  } = useExecution({
    selectedTabId: tabsHook.selectedTabId,
    defaultDelimiter: settings.defaultDelimiter,
    getCurrentTab: tabsCtl.getCurrentTab,
    getCurrentPipeline: tabsCtl.getCurrentPipeline,
    showToast,
    addLog,
    setTabs: tabsHook.setTabs,
    setIsExecuting,
    setShowLogPanel: ui.setShowLogPanel,
    setShowProgressBar: ui.setShowProgressBar,
    setBranchProgress: ui.setBranchProgress,
    progressHideTimerRef,
    formatDateTime,
    trackLineage: lineageHook.trackLineage,
    setShowChartPanel: ui.setShowChartPanel,
    setChartConfig: ui.setChartConfig,
    setChartSeries: ui.setChartSeries,
    setChartHeaders: ui.setChartHeaders,
    saveVersion: versionsHook.saveVersion,
    saveExecutionHistory: executionHistory.saveEntry,
  });

  const { handleSaveIntermediateAsInput } = useSaveIntermediate({
    getCurrentTab: tabsCtl.getCurrentTab,
    resolveRunDelimiter: tabsCtl.resolveRunDelimiter,
    showToast,
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

  // ── Pipeline templates (F4) ───────────────────────────────────────────────
  const templateStore = usePipelineTemplates();
  const showTemplateDialog = dialogs.isOpen("templates");
  const openTemplates = useCallback(() => dialogs.open("templates"), [dialogs]);
  const [templateToDelete, setTemplateToDelete] =
    useState<PipelineTemplate | null>(null);

  const handleUseOrSaveTemplate = useCallback(
    async (name: string, description?: string) => {
      const currentTab = tabsHook.getCurrentTab();
      if (!currentTab || currentTab.pipeline.length === 0) {
        showToast(t.templateNameRequired, "warning");
        return;
      }
      try {
        const template: PipelineTemplate = {
          id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          description,
          created: formatDateTime(new Date()),
          updated: formatDateTime(new Date()),
          snapshot: serializeTabSnapshot(currentTab),
        };
        await templateStore.savePipelineTemplate(template);
        showToast(`${t.templateSaved}: ${name}`, "success");
      } catch (error) {
        showToast(`Failed to save template: ${error}`, "error");
      }
    },
    [showToast, tabsHook, templateStore, formatDateTime, t],
  );

  const handleApplyTemplate = useCallback(
    async (id: string) => {
      const template = templateStore.templates.find((tpl) => tpl.id === id);
      if (!template) {
        showToast("Template not found", "error");
        return;
      }
      const tab = deserializeTabSnapshot(template.snapshot);
      if (!tab) {
        showToast("Failed to apply template", "error");
        return;
      }
      const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newTab = {
        ...tab,
        id: newTabId,
        name: template.name,
        created: formatDateTime(new Date()),
        updated: formatDateTime(new Date()),
      };
      tabsHook.setTabs((prev) => [...prev, newTab]);
      tabsHook.setSelectedTabId(newTabId);
      setSelectedStep(null);
      if (template.snapshot.inputFile) {
        await tabsHook.loadCsvData(
          newTabId,
          template.snapshot.inputFile,
          template.snapshot.defaultDelimiter,
        );
      }
      showToast(`${t.templateApplied}: ${template.name}`, "success");
    },
    [
      showToast,
      templateStore.templates,
      tabsHook,
      setSelectedStep,
      formatDateTime,
      t,
    ],
  );

  const handleRenameTemplate = useCallback(
    async (id: string, name: string, description?: string) => {
      await templateStore.renamePipelineTemplate(id, name, description);
    },
    [templateStore],
  );

  const confirmDeleteTemplate = useCallback(() => {
    if (templateToDelete) {
      void templateStore.deletePipelineTemplate(templateToDelete.id);
      setTemplateToDelete(null);
    }
  }, [templateStore, templateToDelete]);

  const handleExportTemplate = useCallback(
    async (id: string) => {
      const template = templateStore.templates.find((tpl) => tpl.id === id);
      if (!template) return;
      try {
        const filePath = await saveDialog({
          filters: [
            {
              name: "EasyCSV Template",
              extensions: ["ecsv-template.json"],
            },
          ],
          defaultPath: `${template.name}.ecsv-template.json`,
        });
        if (!filePath) return;
        const payload = { version: 1, templates: [template] };
        const encoder = new TextEncoder();
        await writeFile(
          filePath,
          encoder.encode(JSON.stringify(payload, null, 2)),
        );
        showToast(`Exported: ${template.name}`, "success");
      } catch (error) {
        showToast(`Failed to export template: ${error}`, "error");
      }
    },
    [templateStore.templates, showToast],
  );

  const handleImportTemplate = useCallback(async () => {
    const file = await openDialog({
      multiple: false,
      filters: [
        {
          name: "EasyCSV Template",
          extensions: ["ecsv-template.json", "json"],
        },
      ],
    });
    if (!file) return;
    try {
      const content = await readFile(file);
      const text = new TextDecoder().decode(content);
      const data = JSON.parse(text);
      let incoming: PipelineTemplate[] = [];
      if (Array.isArray(data)) {
        incoming = data;
      } else if (Array.isArray(data?.templates)) {
        incoming = data.templates as PipelineTemplate[];
      } else if (data && typeof data === "object" && data.snapshot) {
        incoming = [data as PipelineTemplate];
      }
      if (incoming.length === 0) {
        showToast(t.templateImportFailed, "error");
        return;
      }
      for (const tpl of incoming) {
        if (!tpl.snapshot) continue;
        const imported: PipelineTemplate = {
          ...tpl,
          id: `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          updated: formatDateTime(new Date()),
        };
        await templateStore.savePipelineTemplate(imported);
      }
      showToast(`Imported ${incoming.length} template(s)`, "success");
    } catch (error) {
      showToast(t.templateImportFailed, "error");
    }
  }, [templateStore, showToast, t, formatDateTime]);

  // Keyboard shortcuts
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
      onCommands: () => ui.setShowCommandPanel(!ui.showCommandPanel),
      onLogs: () => ui.setShowLogPanel(!ui.showLogPanel),
      onAI: () => ui.setShowAIPanel(!ui.showAIPanel),
      onCommandPalette: () => ui.setShowCommandPalette(!ui.showCommandPalette),
      onOpenTemplates: openTemplates,
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
    ui.setHelpCommandName(effectiveLanguage === "zh" ? "帮助" : "Help");
    ui.setHelpContent(getHelpContent(effectiveLanguage));
    ui.setShowHelp(true);
  }, [effectiveLanguage, ui]);

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
      await invoke("set_auto_detect_delimiter", {
        enabled: settings.autoDetectDelimiter,
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
      await invoke("set_auto_check_update", {
        enabled: settings.autoCheckUpdate,
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
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+O",
        onSelect: handleOpenFile,
      },
      {
        id: "open-new-tab",
        label: t.openNewTab,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+N",
        onSelect: handleOpenNewTabWithFile,
      },
      {
        id: "save-pipeline",
        label: t.savePipeline,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+S",
        disabled: currentPipelineLength === 0,
        onSelect: handleSavePipelineAndMarkSaved,
      },
      {
        id: "import-workflow",
        label: t.importWorkflow,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+I",
        onSelect: handleImportPipeline,
      },
      {
        id: "export-workflow",
        label: t.exportWorkflow,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+E",
        disabled: currentPipelineLength === 0,
        onSelect: handleExportPipelineAndMarkSaved,
      },
      {
        id: "undo",
        label: t.undo,
        group: t.paletteActions,
        groupIcon: Zap,
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
        group: t.paletteActions,
        groupIcon: Zap,
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
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+R",
        disabled: currentPipelineLength === 0 || isExecuting,
        onSelect: handleExecuteAndMarkSaved,
      },
      {
        id: "settings",
        label: t.settings,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Shift+S",
        onSelect: onShowSettings,
      },
      {
        id: "check-update",
        label: t.checkUpdate,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Shift+C",
        onSelect: checkForUpdates,
      },
      {
        id: "help",
        label: t.help,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Shift+H",
        onSelect: onHelp,
      },
      {
        id: "refresh",
        label: t.refreshTitle,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "F5",
        onSelect: () => ui.setShowRefreshDialog(true),
      },
      {
        id: "toggle-command-panel",
        label: t.commandPanel,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Alt+C",
        onSelect: onToggleCommandPanel,
      },
      {
        id: "toggle-log-panel",
        label: t.logPanel,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Alt+Q",
        onSelect: onToggleLogPanel,
      },
      {
        id: "toggle-data-profile",
        label: t.dataProfile,
        group: t.paletteActions,
        groupIcon: Zap,
        disabled: !hasInputFile,
        onSelect: onToggleDataProfile,
      },
      {
        id: "toggle-version-panel",
        label: t.versionHistory,
        group: t.paletteActions,
        groupIcon: Zap,
        onSelect: () => ui.setShowVersionPanel(!ui.showVersionPanel),
      },
      {
        id: "toggle-lineage-panel",
        label: t.dataLineage,
        group: t.paletteActions,
        groupIcon: Zap,
        onSelect: () => ui.setShowLineagePanel(!ui.showLineagePanel),
      },
      {
        id: "toggle-ai-panel",
        label: t.ai,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Alt+A",
        onSelect: () => ui.setShowAIPanel(!ui.showAIPanel),
      },
      {
        id: "csv-diff",
        label: t.csvDiff,
        description: t.csvDiffNoResult,
        group: t.paletteActions,
        groupIcon: Zap,
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
        group: t.paletteActions,
        groupIcon: Zap,
        onSelect: () => {
          ui.setCsvEncodingInitialInput(
            tabsHook.getCurrentTab()?.inputFile || undefined,
          );
          ui.setShowCsvEncoding(true);
        },
      },
      {
        id: "separate-good-bad",
        label: t.separateGoodBad,
        description: t.separateNoResult,
        group: t.paletteActions,
        groupIcon: Zap,
        onSelect: () => {
          ui.setSeparateCsvInitialInput(
            tabsHook.getCurrentTab()?.inputFile || undefined,
          );
          ui.setShowSeparateCsv(true);
        },
      },
      {
        id: "split-lines",
        label: t.splitLines,
        description: t.linesPerFileHint,
        group: t.paletteActions,
        groupIcon: Zap,
        onSelect: () => {
          ui.setSplitLinesInitialInput(
            tabsHook.getCurrentTab()?.inputFile || undefined,
          );
          ui.setShowSplitLines(true);
        },
      },
      {
        id: "use-or-save-template",
        label: t.paletteTemplates,
        group: t.paletteActions,
        groupIcon: Zap,
        shortcut: "Ctrl+T",
        onSelect: openTemplates,
      },
    ];

    // English alias for localized action labels, so English input matches even
    // while the UI (labels) is Chinese.
    const actionEnKey: Record<string, keyof typeof translations.en> = {
      "open-file": "open",
      "open-new-tab": "openNewTab",
      "save-pipeline": "savePipeline",
      "import-workflow": "importWorkflow",
      "export-workflow": "exportWorkflow",
      undo: "undo",
      redo: "redo",
      execute: "execute",
      settings: "settings",
      "check-update": "checkUpdate",
      help: "help",
      refresh: "refreshTitle",
      "toggle-command-panel": "commandPanel",
      "toggle-log-panel": "logPanel",
      "toggle-data-profile": "dataProfile",
      "toggle-version-panel": "versionHistory",
      "toggle-lineage-panel": "dataLineage",
      "toggle-ai-panel": "ai",
      "csv-diff": "csvDiff",
      "csv-encoding": "csvEncoding",
      "separate-good-bad": "separateGoodBad",
      "use-or-save-template": "paletteTemplates",
    };
    const actionsWithSearch: PaletteItem[] = actions.map((a) => {
      const k = actionEnKey[a.id];
      return k ? { ...a, search: translations.en[k] } : a;
    });

    const templateItems: PaletteItem[] = templateStore.templates.map((tpl) => ({
      id: `template-${tpl.id}`,
      label: tpl.name,
      description: tpl.description || t.newFromTemplate,
      keywords: t.newFromTemplate,
      groupIcon: LibraryBig,
      group: t.paletteTemplates,
      onSelect: () => void handleApplyTemplate(tpl.id),
    }));

    const tabs: PaletteItem[] = tabsHook.tabs.map((tab) => ({
      id: `tab-${tab.id}`,
      label: tab.name,
      description: tab.inputFile || tab.id,
      groupIcon: NotebookTabs,
      group: t.paletteTabs,
      onSelect: () => tabsHook.setSelectedTabId(tab.id),
    }));

    const recent: PaletteItem[] = tabsHook.recentFiles.map((file) => ({
      id: `recent-${file.path}`,
      label: file.name,
      description: file.path,
      groupIcon: FileClock,
      group: t.recentFiles,
      onSelect: () => onOpenRecentFile(file.path),
    }));

    const commands: PaletteItem[] = xanCommands.map((cmd) => {
      return {
        id: `cmd-${cmd.id}`,
        label: cmd.name,
        description:
          effectiveLanguage === "zh" ? cmd.descriptionCn : cmd.description,
        // Include the English name, category and description so English input
        // still matches even while the UI (descriptions) is localized to zh.
        keywords: `${cmd.name} ${cmd.category} ${cmd.description}`,
        groupIcon: ListTree,
        group: t.paletteCommands,
        onSelect: () => handleCommandClick(cmd),
      };
    });

    return [
      ...actionsWithSearch,
      ...tabs,
      ...recent,
      ...commands,
      ...templateItems,
    ];
  }, [
    t,
    effectiveLanguage,
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
    templateStore.templates,
    handleApplyTemplate,
    currentPipelineLength,
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
              onUseOrSaveTemplate={openTemplates}
              onHelp={onHelp}
              onCheckUpdate={() => void checkForUpdates()}
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
              onOpenSeparateCsv={() => {
                ui.setSeparateCsvInitialInput(
                  tabsHook.getCurrentTab()?.inputFile || undefined,
                );
                ui.setShowSeparateCsv(true);
              }}
              onOpenSplitLines={() => {
                ui.setSplitLinesInitialInput(
                  tabsHook.getCurrentTab()?.inputFile || undefined,
                );
                ui.setShowSplitLines(true);
              }}
              isExecuting={isExecuting}
              isCheckingUpdate={updater.isChecking}
              hasUpdate={!!updater.updateInfo?.available}
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
                onSaveIntermediate={handleSaveIntermediateAsInput}
                delimiter={tabsHook.getCurrentTab()?.defaultDelimiter}
                delimiterMode={delimiterMode}
                delimiterSource={tabsHook.getCurrentTab()?.delimiterSource}
                delimiterConfidence={
                  tabsHook.getCurrentTab()?.delimiterConfidence
                }
                onDelimiterChange={onDelimiterModeChange}
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
            dockState={session.panelStates.commandList}
            onDockChange={(patch) =>
              session.updatePanelState("commandList", patch)
            }
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
            onShowHistory={() => {
              dialogs.open("history");
              executionHistory.loadHistory();
            }}
            dockState={session.panelStates.logPanel}
            onDockChange={(patch) =>
              session.updatePanelState("logPanel", patch)
            }
            bottomOffset={aiBottomOffset}
          />

          <ExecutionHistoryDialog
            isOpen={dialogs.isOpen("history")}
            onClose={() => dialogs.close("history")}
            history={executionHistory.history}
            loading={executionHistory.loading}
            onRefresh={executionHistory.loadHistory}
          />

          <ChartPanel
            config={ui.chartConfig!}
            series={ui.chartSeries}
            isVisible={ui.showChartPanel}
            onClose={() => ui.setShowChartPanel(false)}
            dockState={session.panelStates.chartPanel}
            onDockChange={(patch) =>
              session.updatePanelState("chartPanel", patch)
            }
            capsuleY={collapsedStack.chartPanel}
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
            delimiterMode={delimiterMode}
            onDelimiterModeChange={onDelimiterModeChange}
            noHeaders={settings.noHeaders}
            onNoHeadersChange={settings.setNoHeaders}
            systemNotification={settings.systemNotification}
            onSystemNotificationChange={settings.setSystemNotification}
            minimizeToTray={settings.minimizeToTray}
            onMinimizeToTrayChange={settings.setMinimizeToTray}
            doubleClickFitView={settings.doubleClickFitView}
            onDoubleClickFitViewChange={settings.setDoubleClickFitView}
            autoCheckUpdate={settings.autoCheckUpdate}
            onAutoCheckUpdateChange={settings.setAutoCheckUpdate}
            onSave={handleSaveSettings}
            aiConfig={aiConfig}
            onAIConfigChange={handleAIConfigChange}
          />

          <UpdateDialog
            isOpen={ui.showUpdateDialog}
            onClose={() => ui.setShowUpdateDialog(false)}
            updateInfo={updater.updateInfo}
            installForm={updater.installForm}
            isInstalling={updater.isInstalling}
            progress={updater.progress}
            error={updater.error}
            onInstall={() => void updater.install()}
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

          {/* Several branches overwriting the same output file */}
          <ConfirmDialog
            isOpen={overwriteConfirm !== null}
            title={t.branchOverwriteTitle}
            message={
              overwriteConfirm
                ? t.branchOverwriteMessage.replace(
                    "{count}",
                    String(overwriteConfirm.branchCount),
                  )
                : ""
            }
            onConfirm={() => void confirmOverwriteExecution()}
            onCancel={cancelOverwriteExecution}
          />

          <PipelineTemplateDialog
            isOpen={showTemplateDialog}
            onClose={() => dialogs.close("templates")}
            templates={templateStore.templates}
            canSave={currentPipelineLength > 0}
            defaultName={tabsHook.getCurrentTab()?.name || "Pipeline"}
            onSave={(name, description) =>
              void handleUseOrSaveTemplate(name, description)
            }
            onApply={(id) => void handleApplyTemplate(id)}
            onRename={(id, name, description) =>
              void handleRenameTemplate(id, name, description)
            }
            onDelete={(id) => {
              const tpl = templateStore.templates.find((t) => t.id === id);
              if (tpl) setTemplateToDelete(tpl);
            }}
            onExport={(id) => void handleExportTemplate(id)}
            onImport={() => void handleImportTemplate()}
          />

          <ConfirmDialog
            isOpen={templateToDelete !== null}
            title={t.confirmDeleteTemplate}
            message={
              templateToDelete
                ? `${t.confirmDeleteTemplate} (${templateToDelete.name})`
                : ""
            }
            onConfirm={confirmDeleteTemplate}
            onCancel={() => setTemplateToDelete(null)}
          />

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

          <SeparateCSVDialog
            isOpen={ui.showSeparateCsv}
            onClose={() => ui.setShowSeparateCsv(false)}
            initialInputFile={ui.separateCsvInitialInput}
            defaultDelimiter={settings.defaultDelimiter}
            onDefaultDelimiterChange={settings.setDefaultDelimiter}
            onShowToast={showToast}
          />

          <SplitLinesDialog
            isOpen={ui.showSplitLines}
            onClose={() => ui.setShowSplitLines(false)}
            initialInputFile={ui.splitLinesInitialInput}
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
            expanded={aiPanelExpanded}
            onExpandedChange={(v) =>
              session.updatePanelState("aiPanel", { collapsed: !v })
            }
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
