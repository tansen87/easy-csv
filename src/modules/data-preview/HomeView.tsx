import React, { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/ScrollArea";
import { X, FolderOpen, FileUp, Star, Clock, File, Square } from "lucide-react";
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
} from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { useLanguage } from "@/i18n";
import { ContextMenu } from "@/components/menu/ContextMenu";
import {
  CommandDialog,
  CommandDialogState,
} from "@/modules/dialogs/command/CommandDialog";
import { buildCommandInitialParams } from "@/modules/dialogs/command/lib/initialParams";
import type { CommandDialogType, CommandEntryContext } from "@/types/dialog";
import { FlowPanel } from "@/modules/pipeline/FlowPanel";
import { VersionControlPanel } from "@/modules/pipeline/panels/VersionControlPanel";
import { DataLineagePanel } from "@/modules/pipeline/panels/DataLineagePanel";

interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
}

interface HomeViewProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  onTabChange: (tabId: string) => void;
  onRemoveTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  resultPreview?: import("@/hooks/MainMenuHooks").ResultPreview[];
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
  /** Delimiter the selected tab's input file was read with (design 018). */
  delimiter?: string;
  delimiterMode?: DelimiterMode;
  delimiterSource?: DelimiterSource;
  delimiterConfidence?: "high" | "low" | "none";
  onDelimiterChange?: (mode: DelimiterMode) => void;
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
  onDelimiterChange,
}: HomeViewProps) {
  const { t } = useLanguage();
  const [columnWidths, _setColumnWidths] = useState<Record<number, number>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: number | null;
    col: number;
  } | null>(null);

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
  const edges = currentTab?.edges || [];
  const inputPosition = currentTab?.inputPosition;

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * Single entry point for every canvas context-menu action (design 019 §3.1).
   *
   * The menu reports *what* the user clicked — column index plus the transform
   * kind — and `buildCommandInitialParams` (pure, unit-tested) turns that into
   * prefilled parameters for the unified `CommandDialog`. Previously each action
   * opened its own floating dialog with a second copy of the parameter-building
   * logic.
   */
  const openCommandFromContext = useCallback(
    (type: CommandDialogType, context: CommandEntryContext) => {
      setCommandDialog({
        type,
        params: buildCommandInitialParams(type, { ...context, headers }),
      });
    },
    [headers],
  );

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

  const closeAllDialogsRef = useRef(() => {
    closeContextMenu();
  });

  useEffect(() => {
    closeAllDialogsRef.current = () => {
      closeContextMenu();
    };
  }, [closeContextMenu]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeAllDialogsRef.current();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (!inputFile && pipeline.length === 0) {
    return (
      <div className="h-full relative">
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Hero section */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-6 shadow-sm">
              <svg
                id="Deployment-Pattern--Streamline-Carbon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                className="w-10 h-10 text-foreground"
              >
                <path
                  d="M4 10H2.365A0.98675 0.98675 0 0 0 1.5 9.5a1 1 0 0 0 0 2 0.98675 0.98675 0 0 0 0.865 -0.5H4Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M14.5 4.5a0.98675 0.98675 0 0 0 -0.865 0.5H12v1h1.635A0.99955 0.99955 0 1 0 14.5 4.5Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M12.70705 2.5 10.5 0.29295 8.29295 2.5 10 4.20705V9h1V4.20705ZM10.5 1.70705 11.29295 2.5 10.5 3.29295 9.70705 2.5Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M6 11.79295V7h-1v4.79295L3.29295 13.5 5.5 15.70705 7.70705 13.5ZM4.70705 13.5 5.5 12.70705 6.29295 13.5 5.5 14.29295Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M9 5H4.20705L2.5 3.29295 0.29295 5.5 2.5 7.70705 4.20705 6H9ZM2.5 6.29295 1.70705 5.5 2.5 4.70705 3.29295 5.5Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M6.5 1.5a1 1 0 0 0 -2 0 0.98665 0.98665 0 0 0 0.5 0.865V4h1V2.365A0.98665 0.98665 0 0 0 6.5 1.5Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M11 13.63525V12h-1v1.635a1 1 0 1 0 1 0Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M15.70705 10.5 13.5 8.29295 11.79295 10H7v1h4.79295L13.5 12.70705ZM13.5 9.70705 14.29295 10.5 13.5 11.29295 12.70705 10.5Z"
                  fill="#89A4A8"
                  strokeWidth="0.5"
                ></path>
                <path
                  id="_Transparent_Rectangle_"
                  d="M0 0h16v16H0Z"
                  fill="none"
                  strokeWidth="0.5"
                ></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {t.welcomeTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {t.welcomeSubtitle}
            </p>
          </div>

          {/* Action cards */}
          <div className="flex items-stretch gap-4 mb-12">
            <button
              onClick={onOpenFile}
              className="group flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border border-border/60 bg-card/50 hover:bg-accent/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 w-44"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-200">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t.openFile}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {t.openFileFormats}
                </p>
              </div>
            </button>

            <button
              onClick={onImportPipeline}
              className="group flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border border-border/60 bg-card/50 hover:bg-accent/80 hover:border-primary/40 hover:shadow-md transition-all duration-200 w-44"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-200">
                <FileUp className="h-5 w-5 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t.importFlow}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {t.importFlowFormats}
                </p>
              </div>
            </button>

            <button
              onClick={() =>
                onOpenUrl?.("https://github.com/tansen87/easy-csv")
              }
              className="group flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border border-border/60 bg-card/50 hover:bg-accent/80 hover:border-yellow-500/30 hover:shadow-md transition-all duration-200 w-44"
            >
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/15 group-hover:scale-105 transition-all duration-200">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t.starOnGitHub}
                </p>
              </div>
            </button>
          </div>

          {/* Recent files */}
          {recentFiles.length > 0 && (
            <div className="w-full max-w-xl px-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                  {t.recentFiles}
                </p>
              </div>
              <ScrollArea className="h-[26vh]">
                <div className="space-y-0.5 pr-4">
                  {recentFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => onOpenRecentFile?.(file.path)}
                      className="w-full grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-accent/60 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <File className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate">
                          {file.path}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                <ScrollBar />
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
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
          onOpenFilterDialog={(col) =>
            openCommandFromContext("search", { col })
          }
          onOpenBatchFilter={() => openCommandFromContext("batch-filter", {})}
          onOpenPivotDialog={() => openCommandFromContext("pivot", {})}
          onOpenDateTransformDialog={(col) =>
            openCommandFromContext("map", { col, mapScaffold: "date" })
          }
          onOpenSliceDialog={(col, sliceType) =>
            openCommandFromContext("map", { col, slice: sliceType })
          }
          onOpenReplaceDialog={(col) =>
            openCommandFromContext("map", { col, mapScaffold: "replace" })
          }
          onOpenWindowDialog={(col) =>
            openCommandFromContext("window", { col })
          }
          onOpenPadDialog={(col, padType) =>
            openCommandFromContext("map", { col, pad: padType })
          }
          onOpenSortDialog={(col) => openCommandFromContext("sort", { col })}
          onOpenTextTransformDialog={(col, transformType) =>
            openCommandFromContext("map", { col, textTransform: transformType })
          }
          onOpenNumberTransformDialog={(col, transformType) =>
            openCommandFromContext("map", {
              col,
              numberTransform: transformType,
            })
          }
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
          onDelimiterChange={onDelimiterChange}
        />
      </div>

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
                      ? "bg-primary/10 text-primary border border-primary/20"
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
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTab(tab.id);
                      }}
                      className="p-0. rounded opacity-0 group-hover:opacity-100 hover:bg-muted/80 transition-all duration-150 text-muted-foreground/50 hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {showProgressBar && branchProgress && (
        <div className="absolute left-1/2 top-15 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
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
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          onClose={closeContextMenu}
          onOpenFilterDialog={(col) =>
            openCommandFromContext("search", { col })
          }
          onOpenBatchFilter={() => openCommandFromContext("batch-filter", {})}
          onOpenPivotDialog={() => openCommandFromContext("pivot", {})}
          onOpenDateTransformDialog={(col) =>
            openCommandFromContext("map", { col, mapScaffold: "date" })
          }
          onOpenTextTransformDialog={(col, transformType) =>
            openCommandFromContext("map", { col, textTransform: transformType })
          }
          onOpenNumberTransformDialog={(col, transformType) =>
            openCommandFromContext("map", {
              col,
              numberTransform: transformType,
            })
          }
          onOpenSliceDialog={(col, sliceType) =>
            openCommandFromContext("map", { col, slice: sliceType })
          }
          onOpenReplaceDialog={(col) =>
            openCommandFromContext("map", { col, mapScaffold: "replace" })
          }
          onOpenWindowDialog={(col) =>
            openCommandFromContext("window", { col })
          }
          onOpenPadDialog={(col, padType) =>
            openCommandFromContext("map", { col, pad: padType })
          }
          onOpenSortDialog={(col) => openCommandFromContext("sort", { col })}
        />
      )}

      {commandDialog && (
        <CommandDialog
          commandDialog={commandDialog}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
          headers={headers}
        />
      )}
    </div>
  );
});
