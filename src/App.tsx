import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useTheme } from "@/components/setting/ThemeProvider";
import { ToastContainer } from "@/components/setting/Toast";
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
import { useToast } from "@/hooks/useToast";
import { useLogs } from "@/hooks/useLogs";
import { useUIState } from "@/hooks/useUIState";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useTabs } from "@/hooks/useTabs";
import { usePipelineState } from "@/hooks/usePipelineState";
import { useKeyboardShortcuts } from "@/hooks/KeyboardShortcuts";
import { formatDateTime } from "@/utils/format";
import {
  PipelineStep,
  XanCommand,
  HistoricalPipeline,
  PipelineEdge,
} from "@/types/xan";

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

  // Toast
  const { toasts, showToast, showToastRef, removeToastRef } = useToast();

  // Logs
  const { logs, addLog, clearLogs } = useLogs();

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

  const progressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const headerRef = useRef<HTMLDivElement>(null);
  const reactFlowInstanceRef = useRef<any>(null);
  const currentVersion = "0.2.1";

  // Historical pipelines
  const [historicalPipelines, setHistoricalPipelines] = useState<
    HistoricalPipeline[]
  >([]);

  // Selected step
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);

  // Executing state
  const [isExecuting, setIsExecuting] = useState(false);

  // Load historical pipelines
  const loadHistoricalPipelines = useCallback(async () => {
    try {
      const content = await invoke<string>("load_history");
      const history: HistoricalPipeline[] = JSON.parse(content);

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
  }, []);

  const saveHistoricalPipelines = useCallback(
    async (history: HistoricalPipeline[]) => {
      try {
        await invoke("save_history", {
          history: JSON.stringify(history, null, 2),
          limit: settings.historyLimit > 0 ? settings.historyLimit : undefined,
        });
      } catch (error) {
        addLog("error", `Failed to save historical pipelines: ${error}`);
      }
    },
    [settings.historyLimit, addLog],
  );

  const updateHistoricalPipelines = useCallback(
    (newHistory: HistoricalPipeline[]) => {
      setHistoricalPipelines(newHistory);
      saveHistoricalPipelines(newHistory);
    },
    [saveHistoricalPipelines],
  );

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
        currentVersion && latestVersion && latestVersion !== currentVersion;

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
      pipeline.updateTabPipeline([...currentPipeline, newStep]);
      setSelectedStep(newStep);
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
    (stepId: string | string[]) => {
      const stepIds = Array.isArray(stepId) ? stepId : [stepId];
      const currentPipeline = tabsHook.getCurrentPipeline();
      const currentTab = tabsHook.getCurrentTab();
      const updatedPipeline = currentPipeline.filter(
        (s) => !stepIds.includes(s.id),
      );
      const updatedEdges = (currentTab.edges || []).filter(
        (e) => !stepIds.includes(e.source) && !stepIds.includes(e.target),
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
        await loadHistoricalPipelines();
        await tabsHook.loadRecentFiles();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    };
    initializeApp();
  }, []);

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
    undo,
    redo,
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleExportPipeline,
    handleImportPipeline,
    handleExecute,
  } = MainMenuHooks({
    tabs: tabsHook.tabs,
    selectedTabId: tabsHook.selectedTabId,
    undoStack: pipeline.undoStack,
    redoStack: pipeline.redoStack,
    historicalPipelines,
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
    updateHistoricalPipelines,
    formatDateTime,
  });

  // Keyboard shortcuts (O-3: moved to App level)
  useKeyboardShortcuts(
    {
      onOpenFile: handleOpenFile,
      onOpenNewTabWithFile: handleOpenNewTabWithFile,
      onSavePipeline: handleSavePipeline,
      onImportPipeline: handleImportPipeline,
      onExportPipeline: handleExportPipeline,
      onUndo: undo,
      onRedo: redo,
      onExecute: handleExecute,
      onHelp: () => {
        ui.setHelpCommandName(language === "zh" ? "帮助" : "Help");
        ui.setHelpContent(getHelpContent(language));
        ui.setShowHelp(true);
      },
      onCheckUpdate: checkForUpdates,
      onShowSettings: () => ui.setShowSettingsDialog(true),
      onCommands: () => ui.setShowCommandPanel(!ui.showCommandPanel),
      onLogs: () => ui.setShowLogPanel(!ui.showLogPanel),
      onDataProfile: () => ui.setShowDataProfile(!ui.showDataProfile),
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
      await invoke("set_history_limit", { limit: settings.historyLimit });
      showToastRef.current("Settings saved successfully", "success");
    } catch (error) {
      showToastRef.current(`Failed to save settings: ${error}`, "error");
    }
  }, [settings, showToastRef]);

  // History handlers
  const onNewTabFromHistory = useCallback(
    (history: any) => {
      const newTabId = `tab-${Date.now()}`;
      const newTab = {
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
      tabsHook.setTabs((prev) => [...prev, newTab]);
      tabsHook.setSelectedTabId(newTabId);

      if (history.inputFile) {
        tabsHook.loadCsvData(newTabId, history.inputFile);
      }
      if (history.defaultDelimiter) {
        settings.setDefaultDelimiter(history.defaultDelimiter);
      }
    },
    [tabsHook, settings],
  );

  const onDeleteHistory = useCallback(
    (history: any) => {
      const updatedHistory = historicalPipelines.filter(
        (h) => h.id !== history.id,
      );
      updateHistoricalPipelines(updatedHistory);
    },
    [historicalPipelines, updateHistoricalPipelines],
  );

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
              onUndo={undo}
              onRedo={redo}
              onExecute={handleExecute}
              onOpenFile={handleOpenFile}
              onOpenNewTabWithFile={handleOpenNewTabWithFile}
              onSavePipeline={handleSavePipeline}
              onImportPipeline={handleImportPipeline}
              onExportPipeline={handleExportPipeline}
              onHelp={onHelp}
              onCheckUpdate={checkForUpdates}
              onShowSettings={onShowSettings}
              isExecuting={isExecuting}
              isCheckingUpdate={ui.isCheckingUpdate}
              currentPipelineLength={tabsHook.getCurrentPipeline().length}
              showCommandPanel={ui.showCommandPanel}
              onToggleCommandPanel={onToggleCommandPanel}
              showLogPanel={ui.showLogPanel}
              onToggleLogPanel={onToggleLogPanel}
              showDataProfile={ui.showDataProfile}
              onToggleDataProfile={onToggleDataProfile}
              hasInputFile={!!tabsHook.getCurrentTab()?.inputFile}
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
                onOpenBatchFilter={(x, y) => ui.setBatchFilterDialog({ x, y })}
                onOpenUrl={handleOpenUrl}
                branchProgress={ui.branchProgress}
                showProgressBar={ui.showProgressBar}
                recentFiles={tabsHook.recentFiles}
                onOpenRecentFile={onOpenRecentFile}
                reactFlowInstanceRef={reactFlowInstanceRef}
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
            activePanel={ui.activeLeftPanel}
            onActivePanelChange={ui.setActiveLeftPanel}
            historicalPipelines={historicalPipelines}
            onNewTabFromHistory={onNewTabFromHistory}
            onDeleteHistory={onDeleteHistory}
          />

          <LogPanel
            logs={logs}
            onClear={clearLogs}
            isVisible={ui.showLogPanel}
            onClose={() => ui.setShowLogPanel(false)}
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
            theme={theme}
            onThemeChange={setTheme}
            defaultDelimiter={settings.defaultDelimiter}
            onDefaultDelimiterChange={settings.setDefaultDelimiter}
            noHeaders={settings.noHeaders}
            onNoHeadersChange={settings.setNoHeaders}
            systemNotification={settings.systemNotification}
            onSystemNotificationChange={settings.setSystemNotification}
            minimizeToTray={settings.minimizeToTray}
            onMinimizeToTrayChange={settings.setMinimizeToTray}
            historyLimit={settings.historyLimit}
            onHistoryLimitChange={settings.setHistoryLimit}
            onSave={handleSaveSettings}
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

          <DataProfilePanel
            filePath={tabsHook.getCurrentTab()?.inputFile || ""}
            delimiter={settings.defaultDelimiter}
            isVisible={ui.showDataProfile}
            onClose={() => ui.setShowDataProfile(false)}
          />
        </div>
      }
    </>
  );
}

export default App;
