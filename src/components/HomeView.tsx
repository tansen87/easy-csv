import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { X, FolderOpen, FileUp, Star, Clock, File } from "lucide-react";
import {
  PipelineStep,
  PipelineEdge,
  XanCommand,
  PipelineTab,
} from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { useLanguage } from "@/i18n";
import { ContextMenu } from "@/components/menu/ContextMenu";
import {
  CommandDialog,
  CommandDialogState,
} from "@/components/dialog/CommandDialog";
import { FilterDialog } from "@/components/dialog/FilterDialog";
import { SortDialog } from "@/components/dialog/SortDialog";
import { PivotDialog } from "@/components/dialog/PivotDialog";
import { DateTransformDialog } from "@/components/dialog/DateTransformDialog";
import {
  TextTransformDialog,
  TextTransformType,
} from "@/components/dialog/TextTransformDialog";
import {
  NumberTransformDialog,
  NumberTransformType,
} from "@/components/dialog/NumberTransformDialog";
import { SplitDialog } from "@/components/dialog/SplitDialog";
import { PadDialog } from "@/components/dialog/PadDialog";
import { ReplaceDialog } from "@/components/dialog/ReplaceDialog";
import { WindowDialog } from "@/components/dialog/WindowDialog";
import { FlowPanel } from "@/components/panel/FlowPanel";

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
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onStepClick?: (step: PipelineStep) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  onStepAliasUpdate?: (stepId: string, alias: string) => void;
  onStepDelete?: (stepId: string | string[]) => void;
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
  onOpenBatchFilter?: (x: number, y: number) => void;
  onOpenUrl?: (url: string) => void;
  branchProgress?: {
    current: number;
    total: number;
    name: string;
    status: "executing" | "completed" | "error";
  } | null;
  showProgressBar?: boolean;
  recentFiles?: RecentFile[];
  onOpenRecentFile?: (filePath: string) => void;
}

export function HomeView({
  tabs,
  selectedTabId,
  onTabChange,
  onRemoveTab,
  onRenameTab,
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
  onOpenBatchFilter,
  onOpenUrl,
  branchProgress,
  showProgressBar,
  recentFiles = [],
  onOpenRecentFile,
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
  const [filterDialog, setFilterDialog] = useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
  const [sortDialog, setSortDialog] = useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
  const [pivotDialog, setPivotDialog] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [replaceDialog, setReplaceDialog] = useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
  const [dateTransformDialog, setDateTransformDialog] = useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
  const [textTransformDialog, setTextTransformDialog] = useState<{
    col: number;
    x: number;
    y: number;
    transformType?: TextTransformType;
  } | null>(null);
  const [numberTransformDialog, setNumberTransformDialog] = useState<{
    col: number;
    x: number;
    y: number;
    transformType?: NumberTransformType;
  } | null>(null);
  const [splitDialog, setSplitDialog] = useState<{
    col: number;
    x: number;
    y: number;
    sliceType?: string;
  } | null>(null);
  const [padDialog, setPadDialog] = useState<{
    col: number;
    x: number;
    y: number;
    padType: string;
  } | null>(null);
  const [windowDialog, setWindowDialog] = useState<{
    col: number;
    x: number;
    y: number;
  } | null>(null);
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

  const closeFilterDialog = useCallback(() => {
    setFilterDialog(null);
  }, []);

  const closeSortDialog = useCallback(() => {
    setSortDialog(null);
  }, []);

  const closePivotDialog = useCallback(() => {
    setPivotDialog(null);
  }, []);

  const closeDateTransformDialog = useCallback(() => {
    setDateTransformDialog(null);
  }, []);

  const closeTextTransformDialog = useCallback(() => {
    setTextTransformDialog(null);
  }, []);

  const closeNumberTransformDialog = useCallback(() => {
    setNumberTransformDialog(null);
  }, []);

  const closeSplitDialog = useCallback(() => {
    setSplitDialog(null);
  }, []);

  const closePadDialog = useCallback(() => {
    setPadDialog(null);
  }, []);

  const closeWindowDialog = useCallback(() => {
    setWindowDialog(null);
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
                  stroke-width="0.5"
                ></path>
                <path
                  d="M14.5 4.5a0.98675 0.98675 0 0 0 -0.865 0.5H12v1h1.635A0.99955 0.99955 0 1 0 14.5 4.5Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M12.70705 2.5 10.5 0.29295 8.29295 2.5 10 4.20705V9h1V4.20705ZM10.5 1.70705 11.29295 2.5 10.5 3.29295 9.70705 2.5Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M6 11.79295V7h-1v4.79295L3.29295 13.5 5.5 15.70705 7.70705 13.5ZM4.70705 13.5 5.5 12.70705 6.29295 13.5 5.5 14.29295Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M9 5H4.20705L2.5 3.29295 0.29295 5.5 2.5 7.70705 4.20705 6H9ZM2.5 6.29295 1.70705 5.5 2.5 4.70705 3.29295 5.5Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M6.5 1.5a1 1 0 0 0 -2 0 0.98665 0.98665 0 0 0 0.5 0.865V4h1V2.365A0.98665 0.98665 0 0 0 6.5 1.5Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M11 13.63525V12h-1v1.635a1 1 0 1 0 1 0Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  d="M15.70705 10.5 13.5 8.29295 11.79295 10H7v1h4.79295L13.5 12.70705ZM13.5 9.70705 14.29295 10.5 13.5 11.29295 12.70705 10.5Z"
                  fill="#89A4A8"
                  stroke-width="0.5"
                ></path>
                <path
                  id="_Transparent_Rectangle_"
                  d="M0 0h16v16H0Z"
                  fill="none"
                  stroke-width="0.5"
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
            <div className="w-full max-w-lg px-6">
              <div className="flex items-center gap-2 mb-3 px-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                  {t.recentFiles}
                </p>
              </div>
              <ScrollArea className="max-h-[26vh]">
                <div className="space-y-0.5 pr-4">
                  {recentFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => onOpenRecentFile?.(file.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-accent/60 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                        <File className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
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
          onOpenFilterDialog={(col, x, y) => setFilterDialog({ col, x, y })}
          onOpenBatchFilter={(x, y) => onOpenBatchFilter?.(x, y)}
          onOpenPivotDialog={(x, y) => setPivotDialog({ x, y })}
          onOpenDateTransformDialog={(col, x, y) =>
            setDateTransformDialog({ col, x, y })
          }
          onOpenSliceDialog={(col, x, y, sliceType) =>
            setSplitDialog({ col, x, y, sliceType })
          }
          onOpenReplaceDialog={(col, x, y) => setReplaceDialog({ col, x, y })}
          onOpenWindowDialog={(col, x, y) => setWindowDialog({ col, x, y })}
          onOpenPadDialog={(col, x, y, padType) =>
            setPadDialog({ col, x, y, padType })
          }
          onOpenSortDialog={(col, x, y) => setSortDialog({ col, x, y })}
          onOpenTextTransformDialog={(col, x, y, transformType) =>
            setTextTransformDialog({ col, x, y, transformType })
          }
          onOpenNumberTransformDialog={(col, x, y, transformType) =>
            setNumberTransformDialog({ col, x, y, transformType })
          }
          onTableRename={handleTableRename}
          onSave={handleSaveRenames}
          onTableDelete={handleTableDelete}
          selectedStepId={selectedStepId}
          savedEdges={edges}
          savedInputPosition={inputPosition}
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
        />
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
        <div className="absolute left-1/2 top-12 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-md pointer-events-auto">
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
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          onClose={closeContextMenu}
          onOpenFilterDialog={(col, x, y) => setFilterDialog({ col, x, y })}
          onOpenBatchFilter={(x, y) => onOpenBatchFilter?.(x, y)}
          onOpenPivotDialog={(x, y) => setPivotDialog({ x, y })}
          onOpenDateTransformDialog={(col, x, y) =>
            setDateTransformDialog({ col, x, y })
          }
          onOpenTextTransformDialog={(col, x, y, transformType) =>
            setTextTransformDialog({ col, x, y, transformType })
          }
          onOpenNumberTransformDialog={(col, x, y, transformType) =>
            setNumberTransformDialog({ col, x, y, transformType })
          }
          onOpenSliceDialog={(col, x, y, sliceType) =>
            setSplitDialog({ col, x, y, sliceType })
          }
          onOpenReplaceDialog={(col, x, y) => setReplaceDialog({ col, x, y })}
          onOpenWindowDialog={(col, x, y) => setWindowDialog({ col, x, y })}
          onOpenPadDialog={(col, x, y, padType) =>
            setPadDialog({ col, x, y, padType })
          }
          onOpenSortDialog={(col, x, y) => setSortDialog({ col, x, y })}
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

      {filterDialog && (
        <FilterDialog
          filterDialog={filterDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeFilterDialog}
        />
      )}

      {sortDialog && (
        <SortDialog
          sortDialog={sortDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeSortDialog}
        />
      )}

      {pivotDialog && (
        <PivotDialog
          pivotDialog={pivotDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closePivotDialog}
        />
      )}

      {dateTransformDialog && (
        <DateTransformDialog
          dateTransformDialog={dateTransformDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeDateTransformDialog}
        />
      )}

      {textTransformDialog && (
        <TextTransformDialog
          textTransformDialog={textTransformDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeTextTransformDialog}
        />
      )}

      {numberTransformDialog && (
        <NumberTransformDialog
          numberTransformDialog={numberTransformDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeNumberTransformDialog}
        />
      )}

      {splitDialog && (
        <SplitDialog
          splitDialog={splitDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeSplitDialog}
        />
      )}

      {padDialog && (
        <PadDialog
          padDialog={padDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closePadDialog}
        />
      )}

      {replaceDialog && (
        <ReplaceDialog
          replaceDialog={replaceDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={() => setReplaceDialog(null)}
        />
      )}

      {windowDialog && (
        <WindowDialog
          windowDialog={windowDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeWindowDialog}
        />
      )}
    </div>
  );
}
