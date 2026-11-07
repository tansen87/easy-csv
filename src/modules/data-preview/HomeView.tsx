import React, { useState, useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/ScrollArea";
import { X, Square } from "lucide-react";
import {
  PipelineStep,
  PipelineEdge,
  XanCommand,
  PipelineTab,
  PipelineVersion,
  StepLineage,
  StoredPipelineStep,
  DelimiterMode,
  DelimiterSource,
  TabularFormat,
} from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { useLanguage } from "@/i18n";
import {
  CommandDialog,
  CommandDialogState,
} from "@/modules/dialogs/command/CommandDialog";
import { QuickActionDialog } from "@/modules/dialogs/quick/QuickActionDialog";
import type {
  QuickActionRequest,
  QuickBuildResult,
} from "@/modules/dialogs/quick/types";
import { FlowPanel } from "@/modules/pipeline/FlowPanel";
import { FirstStepGuide } from "@/components/onboarding/FirstStepGuide";
import { EmptyState, RecentFile } from "@/modules/data-preview/EmptyState";
import { VersionControlPanel } from "@/modules/pipeline/panels/VersionControlPanel";
import { DataLineagePanel } from "@/modules/pipeline/panels/DataLineagePanel";

interface HomeViewProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  onTabChange: (tabId: string) => void;
  onRemoveTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  resultPreview?: import("@/types/execution").ResultPreview[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onStepClick?: (step: PipelineStep) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  onStepAliasUpdate?: (stepId: string, alias: string) => void;
  onStepDelete?: (stepId: string | string[], extraEdgeIds?: string[]) => void;
  onPipelineReorder?: (tabId: string, newPipeline: PipelineStep[]) => void;
  onTableDelete?: () => void;
  selectedStepId?: string;
  onEdgesChange?: (tabId: string, edges: PipelineEdge[]) => void;
  onInputPositionChange?: (
    tabId: string,
    position: { x: number; y: number },
  ) => void;
  onOpenFile?: () => void;
  onImportPipeline?: () => void;
  onOpenUrl?: (url: string) => void;
  branchProgress?: {
    current: number;
    total: number;
    name: string;
    status: "executing" | "completed" | "error";
  } | null;
  showProgressBar?: boolean;
  isExecuting?: boolean;
  /** Per-tab run state, used for the tab-strip badges (design 028 §5.4). */
  tabRuns?: Record<string, import("@/types/execution").RunSession>;
  /** Tabs other than the current one still running — shown as a weak hint. */
  otherRunningCount?: number;
  onCancelExecution?: () => void;
  recentFiles?: RecentFile[];
  onOpenRecentFile?: (filePath: string) => void;
  reactFlowInstanceRef?: React.RefObject<any>;
  versions?: PipelineVersion[];
  currentVersionId?: string;
  currentSnapshot?: {
    steps: StoredPipelineStep[];
    edges: PipelineEdge[];
  };
  onSaveVersion?: (
    message?: string,
    tags?: string[],
  ) => Promise<PipelineVersion | undefined>;
  onRestoreVersion?: (versionId: string) => void;
  onDeleteVersion?: (versionId: string) => void;
  onAddTag?: (versionId: string, tag: string) => void;
  onRemoveTag?: (versionId: string, tag: string) => void;
  onRenameVersion?: (versionId: string, message: string) => void;
  onClearAllVersions?: () => void;
  isSavingVersion?: boolean;
  lineageData?: StepLineage[];
  onGetLineageForColumn?: (columnName: string) => StepLineage[];
  onSaveLineage?: () => void;
  showVersionPanel?: boolean;
  showLineagePanel?: boolean;
  onToggleVersionPanel?: () => void;
  onToggleLineagePanel?: () => void;
  doubleClickFitView?: boolean;
  onSavePipeline?: () => void;
  onOpenCommandPalette?: () => void;
  onSaveIntermediate?: (stepId: string) => void;
  pipelineSavedAt?: number;
  /** Delimiter the selected tab's input file. */
  delimiter?: string;
  delimiterMode?: DelimiterMode;
  delimiterSource?: DelimiterSource;
  delimiterConfidence?: "high" | "low" | "none";
  /** Input file format; non-CSV inputs show a read-only badge. */
  inputFormat?: TabularFormat;
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
  onDelimiterChange?: (mode: DelimiterMode) => void;
  /** First-run guide card over the canvas. */
  showOnboardingGuide?: boolean;
  /** xan command count, shown in the guide card's add-step line. */
  commandCount?: number;
  /** Open the floating command panel — the single "add an operation" entry. */
  onOpenCommandPanel?: () => void;
  onOpenAIPanel?: () => void;
  /** Load the built-in sample data + demo pipeline. */
  onLoadDemo?: () => void;
  onDismissOnboardingGuide?: () => void;
  /** Caption shown while the sample pipeline reveals itself step by step. */
  demoReveal?: {
    caption: string;
    step?: { index: number; total: number };
  } | null;
  /** Advance the reveal one step, then run it (click-driven). */
  onAdvanceDemoReveal?: () => void;
  onSkipDemoReveal?: () => void;
}

export const HomeView = React.memo(function HomeView({
  tabs,
  selectedTabId,
  onTabChange,
  onRemoveTab,
  onRenameTab,
  resultPreview,
  onAddCommand,
  onStepClick,
  onStepUpdate,
  onStepAliasUpdate,
  onStepDelete,
  onPipelineReorder,
  onTableDelete,
  selectedStepId,
  onEdgesChange,
  onInputPositionChange,
  onOpenFile,
  onImportPipeline,
  onOpenUrl,
  branchProgress,
  showProgressBar,
  recentFiles = [],
  onOpenRecentFile,
  reactFlowInstanceRef,
  versions = [],
  currentVersionId,
  currentSnapshot,
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  onAddTag,
  onRemoveTag,
  onRenameVersion,
  onClearAllVersions,
  isSavingVersion = false,
  lineageData = [],
  onGetLineageForColumn,
  onSaveLineage,
  showVersionPanel = false,
  showLineagePanel = false,
  onToggleVersionPanel,
  onToggleLineagePanel,
  isExecuting = false,
  tabRuns = {},
  otherRunningCount = 0,
  onCancelExecution,
  doubleClickFitView = true,
  onSavePipeline,
  onOpenCommandPalette,
  onSaveIntermediate,
  pipelineSavedAt,
  delimiter,
  delimiterMode,
  delimiterSource,
  delimiterConfidence,
  inputFormat,
  sourceTable,
  onDelimiterChange,
  showOnboardingGuide = false,
  commandCount = 0,
  onOpenCommandPanel,
  onOpenAIPanel,
  onLoadDemo,
  onDismissOnboardingGuide,
  demoReveal,
  onAdvanceDemoReveal,
  onSkipDemoReveal,
}: HomeViewProps) {
  const { t } = useLanguage();
  const [columnWidths, _setColumnWidths] = useState<Record<number, number>>({});
  const [quickAction, setQuickAction] = useState<QuickActionRequest | null>(null);

  const [commandDialog, setCommandDialog] = useState<CommandDialogState | null>(
    null,
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");
  const [renamedColumns, setRenamedColumns] = useState<Record<number, string>>(
    {},
  );

  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
  const data = currentTab?.data || [];
  const headers = currentTab?.headers || [];
  const displayHeaders = headers.map((header, index) =>
    renamedColumns[index] !== undefined ? renamedColumns[index] : header,
  );
  const pipeline = currentTab?.pipeline || [];
  const inputFile = currentTab?.inputFile || "";
  const inputFileName = inputFile
    ? inputFile.split(/[/\\]/).pop() || inputFile
    : undefined;
  const edges = currentTab?.edges || [];
  const inputPosition = currentTab?.inputPosition;

  /**
   * Right-click quick actions: FlowPanel reports the clicked column, transform
   * kind and pointer position; the guided dialog anchors itself there.
   */
  const handleQuickAction = useCallback((request: QuickActionRequest) => {
    setQuickAction(request);
  }, []);

  const handleQuickApply = useCallback(
    (result: QuickBuildResult) => {
      const command = xanCommands.find((cmd) => cmd.id === result.type);
      if (command) {
        onAddCommand(command, result.params, result.alias);
      }
      setQuickAction(null);
    },
    [onAddCommand],
  );

  /** Hand the guided draft over to the full parameter form. */
  const handleQuickAdvanced = useCallback((result: QuickBuildResult) => {
    setQuickAction(null);
    setCommandDialog({ type: result.type, params: result.params });
  }, []);

  const handleTableRename = useCallback((col: number, newName: string) => {
    setRenamedColumns((prev) => ({ ...prev, [col]: newName }));
  }, []);

  const handleSaveRenames = useCallback(() => {
    if (onAddCommand) {
      const renameCommand = xanCommands.find((cmd) => cmd.id === "rename");
      if (renameCommand) {
        const columns = headers
          .map((header, index) =>
            renamedColumns[index] !== undefined
              ? renamedColumns[index]
              : header,
          )
          .join(",");
        onAddCommand(renameCommand, { columns });
        setRenamedColumns({});
      }
    }
  }, [renamedColumns, headers, onAddCommand]);

  const handleTableDelete = useCallback(() => {
    if (onTableDelete) {
      onTableDelete();
    }
  }, [onTableDelete]);

  if (!inputFile && pipeline.length === 0) {
    return (
      <EmptyState
        onOpenFile={onOpenFile}
        onImportPipeline={onImportPipeline}
        onLoadDemo={onLoadDemo}
        onOpenUrl={onOpenUrl}
        recentFiles={recentFiles}
        onOpenRecentFile={onOpenRecentFile}
      />
    );
  }

  return (
    <div className="h-full relative">
      <div className="absolute inset-0 overflow-hidden">
        <FlowPanel
          steps={pipeline}
          headers={displayHeaders}
          rows={data}
          columnWidths={columnWidths}
          inputFileName={inputFileName}
          resultPreview={resultPreview}
          onStepsChange={(newPipeline) => {
            if (onPipelineReorder && selectedTabId) {
              onPipelineReorder(selectedTabId, newPipeline);
            }
          }}
          onStepClick={(s) => {
            if (onStepClick) {
              onStepClick(s);
            }
            setCommandDialog({
              type: s.command.name as any,
              params: { ...s.parameters },
              isUpdate: true,
              stepId: s.id,
            });
          }}
          onStepAliasUpdate={onStepAliasUpdate || (() => {})}
          onStepRemove={onStepDelete || (() => {})}
          onQuickAction={handleQuickAction}
          onTableRename={handleTableRename}
          onSave={handleSaveRenames}
          onTableDelete={handleTableDelete}
          selectedStepId={selectedStepId}
          savedEdges={edges}
          savedInputPosition={inputPosition}
          reactFlowInstanceRef={reactFlowInstanceRef}
          onEdgesChange={(edges) => {
            if (onEdgesChange && selectedTabId) {
              onEdgesChange(selectedTabId, edges);
            }
          }}
          onInputPositionChange={(position) => {
            if (onInputPositionChange && selectedTabId) {
              onInputPositionChange(selectedTabId, position);
            }
          }}
          pipelineSavedAt={pipelineSavedAt}
          doubleClickFitView={doubleClickFitView}
          onSavePipeline={onSavePipeline}
          onOpenCommandPalette={onOpenCommandPalette}
          onSaveIntermediate={onSaveIntermediate}
          delimiter={delimiter}
          delimiterMode={delimiterMode}
          delimiterSource={delimiterSource}
          delimiterConfidence={delimiterConfidence}
          inputFormat={inputFormat}
          sourceTable={sourceTable}
          onDelimiterChange={onDelimiterChange}
        />
      </div>

      {/* First-run guide + gesture card (design 027 §4.2/§4.6). Rendered here
          rather than inside FlowPanel so no canvas gesture code is touched. */}
      <FirstStepGuide
        showGuide={showOnboardingGuide}
        commandCount={commandCount}
        gestureCardExpanded={showOnboardingGuide}
        reveal={demoReveal}
        onAdvanceReveal={onAdvanceDemoReveal}
        onSkipReveal={onSkipDemoReveal}
        onAddStep={() => onOpenCommandPanel?.()}
        onAskAi={() => onOpenAIPanel?.()}
        onSeeExample={() => onLoadDemo?.()}
        onDismissGuide={() => onDismissOnboardingGuide?.()}
      />

      {/* Version Control Panel */}
      <div
        className={`absolute top-0 right-0 h-full z-20 transition-all duration-300 ${
          showVersionPanel ? "w-80" : "w-0"
        }`}
      >
        {showVersionPanel && (
          <div className="h-full bg-card border-l border-border/50 shadow-lg">
            <VersionControlPanel
              versions={versions}
              currentVersionId={currentVersionId}
              currentSnapshot={currentSnapshot}
              onSaveVersion={onSaveVersion || (async () => undefined)}
              onRestoreVersion={onRestoreVersion || (() => {})}
              onDeleteVersion={onDeleteVersion || (() => {})}
              onAddTag={onAddTag || (() => {})}
              onRemoveTag={onRemoveTag || (() => {})}
              onRenameVersion={onRenameVersion || (() => {})}
              onClearAllVersions={onClearAllVersions}
              isSaving={isSavingVersion}
              onClose={onToggleVersionPanel || (() => {})}
            />
          </div>
        )}
      </div>

      {/* Data Lineage Panel */}
      <div
        className={`absolute top-0 right-0 h-full z-20 transition-all duration-300 ${
          showLineagePanel ? "w-80" : "w-0"
        } ${showVersionPanel ? "right-80" : ""}`}
      >
        {showLineagePanel && (
          <div className="h-full bg-card border-l border-border/50 shadow-lg">
            <DataLineagePanel
              lineageData={lineageData}
              onGetLineageForColumn={onGetLineageForColumn || (() => [])}
              onSaveLineage={onSaveLineage || (() => {})}
              onClose={onToggleLineagePanel || (() => {})}
            />
          </div>
        )}
      </div>

      <div
        className="absolute top-11 ml-2 z-10"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="h-9 px-3 flex items-center">
          <ScrollArea className="h-full flex-1">
            <div className="flex items-center gap-1 pr-4">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`group flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-all duration-150 shrink-0 cursor-default ${
                    selectedTabId === tab.id
                      ? "border border-[color-mix(in_oklab,var(--canvas-ink)_40%,transparent)] bg-canvas-ink-soft text-canvas-ink"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground border border-transparent"
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingTabId(tab.id);
                    setEditingTabName(tab.name);
                  }}
                >
                  {editingTabId === tab.id ? (
                    <input
                      type="text"
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      onBlur={() => {
                        if (editingTabName.trim()) {
                          onRenameTab(tab.id, editingTabName.trim());
                        }
                        setEditingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingTabName.trim()) {
                            onRenameTab(tab.id, editingTabName.trim());
                          }
                          setEditingTabId(null);
                        } else if (e.key === "Escape") {
                          setEditingTabId(null);
                        }
                      }}
                      className="w-20 min-w-[3rem] max-w-[120px] px-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 h-[18px] leading-[18px] bg-background"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onTabChange(tab.id)}
                      className="text-left truncate max-w-[120px] text-xs leading-[18px] h-[18px]"
                    >
                      {tab.name}
                    </button>
                  )}
                  {/* Run state badge: running / needs-input / finished. Informational only - it never disables the tab. */}
                  {(() => {
                    const run = tabRuns[tab.id];
                    if (!run) return null;
                    if (run.state === "queued") {
                      return (
                        <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                          {t.runStateQueued}
                        </span>
                      );
                    }
                    if (run.state === "running") {
                      return (
                        <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                          <span className="h-1.5 w-1.5 animate-spin rounded-full border border-current border-t-transparent" />
                          {t.executing}
                        </span>
                      );
                    }
                    if (run.state === "preparing") {
                      return (
                        <span className="rounded-full bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          {t.runStatePending}
                        </span>
                      );
                    }
                    if (run.state === "done" || run.state === "error") {
                      return (
                        <span
                          className={`rounded-full px-1.5 text-[10px] font-medium ${
                            run.state === "done"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {run.state === "done"
                            ? t.runStateDone
                            : t.runStateFailed}
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTab(tab.id);
                    }}
                    className="flex h-4 w-4 items-center justify-center rounded opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-muted/80 text-muted-foreground/50 hover:text-foreground"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {((showProgressBar && branchProgress) || otherRunningCount > 0) && (
        <div className="absolute left-1/2 top-15 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex items-center gap-2">
          {showProgressBar && branchProgress && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-transparent rounded-lg shadow-md pointer-events-auto">
            <span className="text-xs font-medium text-muted-foreground">
              {t.branchProgress} {branchProgress.current}/{branchProgress.total}
            </span>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                branchProgress.status === "completed"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : branchProgress.status === "executing"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {branchProgress.status === "executing" && (
                <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {branchProgress.status === "completed" && (
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {branchProgress.status === "error" && (
                <svg
                  className="h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
              <span className="max-w-[240px] truncate">
                {branchProgress.name}
              </span>
            </div>
            {isExecuting && onCancelExecution && (
              <button
                onClick={onCancelExecution}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Square className="h-2.5 w-2.5" />
                {t.cancelExecution}
              </button>
            )}
          </div>
          )}
          {otherRunningCount > 0 && (
            <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">
              {t.otherTabsRunning.replace("{count}", String(otherRunningCount))}
            </span>
          )}
        </div>
      )}

      {quickAction && (
        <QuickActionDialog
          request={quickAction}
          onApply={handleQuickApply}
          onAdvanced={handleQuickAdvanced}
          onClose={() => setQuickAction(null)}
        />
      )}

      {commandDialog && (
        <CommandDialog
          commandDialog={commandDialog}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
          headers={headers}
          sourceTable={sourceTable}
        />
      )}
    </div>
  );
});
