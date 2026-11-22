import React, { useState, useCallback, useEffect } from "react";
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
import {
  buildInstantColumnAction,
  isInstantColumnAction,
  type InstantColumnActionKind,
} from "@/modules/dialogs/quick/lib/instantColumnAction";
import type {
  QuickActionRequest,
  QuickBuildResult,
} from "@/modules/dialogs/quick/types";
import { FlowPanel } from "@/modules/pipeline/FlowPanel";
import { FirstStepGuide } from "@/components/onboarding/FirstStepGuide";
import { RunTimer } from "@/components/ui/RunTimer";
import { EmptyState, RecentFile } from "@/modules/data-preview/EmptyState";
import { VersionControlPanel } from "@/modules/pipeline/panels/VersionControlPanel";
import { DataLineagePanel } from "@/modules/pipeline/panels/DataLineagePanel";

/** Width of the version / lineage panels (w-80). */
const SIDE_PANEL_WIDTH = 320;

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
  onSaveLineage?: () => void;
  showVersionPanel?: boolean;
  showLineagePanel?: boolean;
  /** Right-docked AI width; right-side panels shift to make room. */
  aiDockWidth?: number;
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
  /** Width the open command panel takes on the left; the tool rail slides right. */
  commandPanelInset?: number;
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
  onSaveLineage,
  showVersionPanel = false,
  showLineagePanel = false,
  aiDockWidth = 0,
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
  commandPanelInset = 0,
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
  const [quickAction, setQuickAction] = useState<QuickActionRequest | null>(
    null,
  );

  const [commandDialog, setCommandDialog] = useState<CommandDialogState | null>(
    null,
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");
  const [renamedColumns, setRenamedColumns] = useState<Record<number, string>>(
    {},
  );

  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
  const currentRun = tabRuns[selectedTabId];
  /** Show the readout while running, and the frozen duration while the pill lingers. */
  const showPillTimer =
    !!branchProgress &&
    (branchProgress.status === "executing" ||
      currentRun?.durationMs !== undefined);
  /** Right side reserved by the docked panels; the top rail and readout stop there. */
  const panelRightInset =
    aiDockWidth +
    (showVersionPanel ? SIDE_PANEL_WIDTH : 0) +
    (showLineagePanel ? SIDE_PANEL_WIDTH : 0);
  /** Success lingers for 2.5s, then the readout and rail fade away; errors stay. */
  const [runReadoutDismissed, setRunReadoutDismissed] = useState(false);
  useEffect(() => {
    if (branchProgress?.status !== "completed") {
      setRunReadoutDismissed(false);
      return;
    }
    const timer = window.setTimeout(() => setRunReadoutDismissed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [branchProgress?.status, selectedTabId]);
  const showRunReadout =
    !!showProgressBar &&
    !!branchProgress &&
    !(branchProgress.status === "completed" && runReadoutDismissed);
  const runFillRatio = branchProgress
    ? Math.min(
        1,
        Math.max(0, branchProgress.current / Math.max(1, branchProgress.total)),
      )
    : 0;
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
   * kind and pointer position. Column actions that need no guided form run here
   * immediately; everything else opens the floating dialog.
   */
  const handleQuickAction = useCallback(
    (request: QuickActionRequest) => {
      const col = request.col;
      const column = col !== undefined ? request.headers[col] : undefined;

      if (col !== undefined && column) {
        if (request.kind === "copy-column-name") {
          void navigator.clipboard?.writeText(column).catch(() => {});
          return;
        }
        if (request.kind === "copy-column") {
          const text = data.map((row) => row[col] ?? "").join("\n");
          void navigator.clipboard?.writeText(text).catch(() => {});
          return;
        }
        if (isInstantColumnAction(request.kind)) {
          const built = buildInstantColumnAction(request.kind, column);
          const command = built
            ? xanCommands.find((cmd) => cmd.id === built.type)
            : undefined;
          if (built && command) {
            const labels: Record<InstantColumnActionKind, string> = {
              "search-empty": t.onlyEmptyAction,
              "search-non-empty": t.excludeEmptyAction,
              "dedup-column": t.dedupByColumnAction,
              "blank-column": t.blankDownAction,
              "drop-column": t.deleteColumnAction,
              "keep-column": t.keepOnlyColumnAction,
            };
            onAddCommand(
              command,
              built.params,
              `${labels[request.kind]} · ${column}`,
            );
          }
          return;
        }
      }

      setQuickAction(request);
    },
    [data, onAddCommand, t],
  );

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
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ paddingRight: aiDockWidth }}
      >
        <FlowPanel
          steps={pipeline}
          headers={displayHeaders}
          rows={data}
          columnWidths={columnWidths}
          inputFileName={inputFileName}
          commandPanelInset={commandPanelInset}
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

      {/* First-run guide (design 027 §4.2). Rendered here rather than inside
          FlowPanel so no canvas gesture code is touched. */}
      <FirstStepGuide
        showGuide={showOnboardingGuide}
        commandCount={commandCount}
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
        className={`absolute top-9 bottom-0 z-20 transition-all duration-300 ${
          showVersionPanel ? "w-80" : "w-0"
        }`}
        style={{ right: aiDockWidth }}
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
        className={`absolute top-9 bottom-0 z-20 transition-all duration-300 ${
          showLineagePanel ? "w-80" : "w-0"
        }`}
        style={{
          right:
            aiDockWidth + (showVersionPanel ? SIDE_PANEL_WIDTH : 0),
        }}
      >
        {showLineagePanel && (
          <div className="h-full bg-card border-l border-border/50 shadow-lg">
            <DataLineagePanel
              lineageData={lineageData}
              onSaveLineage={onSaveLineage || (() => {})}
              onClose={onToggleLineagePanel || (() => {})}
            />
          </div>
        )}
      </div>

      {showRunReadout && branchProgress && (
        <div
          className="pointer-events-none absolute left-0 top-9 z-10 h-[2px] overflow-hidden bg-border/40"
          style={{ right: panelRightInset }}
        >
          <div
            className={`h-full origin-left transition-transform duration-200 ${
              branchProgress.status === "completed"
                ? "bg-success"
                : branchProgress.status === "error"
                  ? "bg-danger"
                  : "bg-info"
            }`}
            style={{ transform: `scaleX(${runFillRatio})` }}
          />
        </div>
      )}

      <div
        className="absolute left-2 top-9 z-10"
        style={{ right: panelRightInset }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex h-9 items-start px-3 pt-1">
          <ScrollArea className="h-full min-w-0 flex-1">
            <div className="flex items-center gap-1 pr-4">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex h-6 max-w-[220px] shrink-0 cursor-default items-center gap-1.5 rounded pl-[9px] pr-1 text-xs transition-colors duration-150 ${
                    selectedTabId === tab.id
                      ? "tab-selected border border-transparent text-brand font-medium"
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
                      className="h-[22px] w-[120px] shrink-0 rounded border border-brand-border bg-background px-1.5 text-xs leading-[20px] focus:outline-none focus:ring-1 focus:ring-primary/50"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onTabChange(tab.id)}
                      className="min-w-0 max-w-[150px] truncate text-left text-xs leading-[18px]"
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
                        <span className="tab-badge rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                          {t.runStateQueued}
                        </span>
                      );
                    }
                    if (run.state === "running") {
                      return (
                        <span className="tab-badge flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                          <span className="h-1.5 w-1.5 animate-spin rounded-full border border-current border-t-transparent" />
                          {t.executing}
                        </span>
                      );
                    }
                    if (run.state === "preparing") {
                      return (
                        <span className="tab-badge rounded-full bg-warning-soft px-1.5 text-[10px] font-medium text-warning">
                          {t.runStatePending}
                        </span>
                      );
                    }
                    if (run.state === "done" || run.state === "error") {
                      return (
                        <span
                          className={`tab-badge rounded-full px-1.5 text-[10px] font-medium ${
                            run.state === "done"
                              ? "bg-success-soft text-success"
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
                    aria-label={t.close}
                    className="flex h-5 w-5 flex-none items-center justify-center rounded text-muted-foreground/50 transition-colors duration-150 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {((showRunReadout && branchProgress) || otherRunningCount > 0) && (
            <div className="ml-2 flex h-6 flex-none items-center gap-2 whitespace-nowrap pl-3 text-[10.5px] text-muted-foreground">
              {showRunReadout && branchProgress && (
                <>
                  <span className="font-mono text-[10px] tabular-nums">
                    {t.branchProgress} {branchProgress.current}/
                    {branchProgress.total}
                  </span>
                  <span
                    className={`flex h-[18px] max-w-[186px] items-center gap-1 rounded px-1.5 text-[10px] font-medium ${
                      branchProgress.status === "completed"
                        ? "bg-success-soft text-success"
                        : branchProgress.status === "executing"
                          ? "bg-info-soft text-info"
                          : "bg-danger-soft text-danger"
                    }`}
                  >
                    {branchProgress.status === "executing" && (
                      <span className="h-2 w-2 flex-none animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                    )}
                    {branchProgress.status === "completed" && (
                      <svg
                        className="h-2.5 w-2.5 flex-none"
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
                        className="h-2.5 w-2.5 flex-none"
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
                    <span className="truncate">{branchProgress.name}</span>
                  </span>
                  {showPillTimer && (
                    <>
                      <span className="h-3 w-px flex-none bg-border" />
                      <RunTimer
                        running={branchProgress.status === "executing"}
                        startedAt={currentRun?.executingStartedAt}
                        frozenMs={currentRun?.durationMs}
                      />
                    </>
                  )}
                  {isExecuting && onCancelExecution && (
                    <>
                      <span className="h-3 w-px flex-none bg-border" />
                      <button
                        onClick={onCancelExecution}
                        className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium text-danger transition-colors hover:bg-danger-soft"
                      >
                        <Square className="h-2.5 w-2.5" />
                        {t.cancelExecution}
                      </button>
                    </>
                  )}
                </>
              )}
              {otherRunningCount > 0 && (
                <span className="text-[9.5px] text-muted-foreground/60">
                  {t.otherTabsRunning.replace(
                    "{count}",
                    String(otherRunningCount),
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

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
