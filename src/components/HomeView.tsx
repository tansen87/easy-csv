import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { X, FolderOpen, FileUp, Star } from "lucide-react";
import { PipelineStep, PipelineEdge, XanCommand, PipelineTab } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { ContextMenu } from "@/components/menu/ContextMenu";
import { CommandDialog, CommandDialogState } from "@/components/dialog/CommandDialog";
import { FilterDialog } from "@/components/dialog/FilterDialog";
import { SortDialog } from "@/components/dialog/SortDialog";
import { PivotDialog } from "@/components/dialog/PivotDialog";
import { DateTransformDialog } from "@/components/dialog/DateTransformDialog";
import { TextTransformDialog, TextTransformType } from "@/components/dialog/TextTransformDialog";
import { NumberTransformDialog, NumberTransformType } from "@/components/dialog/NumberTransformDialog";
import { SplitDialog } from "@/components/dialog/SplitDialog";
import { PadDialog } from "@/components/dialog/PadDialog";
import { ReplaceDialog } from "@/components/dialog/ReplaceDialog";
import { WindowDialog } from "@/components/dialog/WindowDialog";
import { FlowPanel } from "@/components/panel/FlowPanel";

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
  onStepDelete?: (stepId: string) => void;
  onPipelineReorder?: (tabId: string, newPipeline: PipelineStep[]) => void;
  selectedStepId?: string;
  onEdgesChange?: (tabId: string, edges: PipelineEdge[]) => void;
  onInputPositionChange?: (tabId: string, position: { x: number; y: number }) => void;
  onOpenFile?: () => void;
  onImportPipeline?: () => void;
  onOpenUrl?: (url: string) => void;
  showMinimap?: boolean;
  branchProgress?: { current: number; total: number; name: string; status: "executing" | "completed" | "error" } | null;
  showProgressBar?: boolean;
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
  selectedStepId,
  onEdgesChange,
  onInputPositionChange,
  onOpenFile,
  onImportPipeline,
  onOpenUrl,
  showMinimap,
  branchProgress,
  showProgressBar,
}: HomeViewProps) {
  const [columnWidths, _setColumnWidths] = useState<Record<number, number>>({});
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: number | null;
    col: number;
  } | null>(null);

  const [commandDialog, setCommandDialog] = useState<CommandDialogState | null>(null);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");
  const [filterDialog, setFilterDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [sortDialog, setSortDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [pivotDialog, setPivotDialog] = useState<{ x: number; y: number } | null>(null);
  const [replaceDialog, setReplaceDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [dateTransformDialog, setDateTransformDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [textTransformDialog, setTextTransformDialog] = useState<{ col: number; x: number; y: number; transformType?: TextTransformType } | null>(null);
  const [numberTransformDialog, setNumberTransformDialog] = useState<{ col: number; x: number; y: number; transformType?: NumberTransformType } | null>(null);
  const [splitDialog, setSplitDialog] = useState<{ col: number; x: number; y: number; sliceType?: string } | null>(null);
  const [padDialog, setPadDialog] = useState<{ col: number; x: number; y: number; padType: string } | null>(null);
  const [windowDialog, setWindowDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [renamedColumns, setRenamedColumns] = useState<Record<number, string>>({});

  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
  const data = currentTab?.data || [];
  const headers = currentTab?.headers || [];
  const displayHeaders = headers.map((header, index) =>
    renamedColumns[index] !== undefined ? renamedColumns[index] : header
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
        const columns = headers.map((header, index) =>
          renamedColumns[index] !== undefined ? renamedColumns[index] : header
        ).join(",");
        onAddCommand(renameCommand, { columns });
        setRenamedColumns({});
      }
    }
  }, [renamedColumns, headers, onAddCommand]);

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
        <div className="absolute top-10 ml-2" onContextMenu={(e) => e.preventDefault()}>
          <div className="h-[48px] px-4 flex items-center">
            <ScrollArea className="h-full flex-1">
              <div className="flex items-center gap-2">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-1.5 py-1 rounded-md text-xs transition-colors shrink-0 ${selectedTabId === tab.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-accent/50 border border-transparent'}`}
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
                          if (e.key === 'Enter') {
                            if (editingTabName.trim()) {
                              onRenameTab(tab.id, editingTabName.trim());
                            }
                            setEditingTabId(null);
                          } else if (e.key === 'Escape') {
                            setEditingTabId(null);
                          }
                        }}
                        className="w-24 px-2 py-0.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary h-6"
                        style={{ lineHeight: '1.2' }}
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => onTabChange(tab.id)}
                        className="text-left truncate max-w-[120px]"
                      >
                        {tab.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1">
                      {tabs.length > 1 && (
                        <button
                          onClick={() => onRemoveTab(tab.id)}
                          className="p-1 rounded hover:bg-muted hover:text-foreground transition-colors text-muted-foreground/70 dark:text-muted-foreground/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
        <div className="absolute inset-0 pt-[96px] flex items-center justify-center" onContextMenu={(e) => e.preventDefault()}>
          <div className="max-w-md w-full px-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to Easy CSV
              </h2>
              <p className="text-sm text-muted-foreground">
                Open a file or import a flow to get started
              </p>
            </div>
            <div className="grid grid-cols-3 gap-32 justify-items-center">
              <button
                onClick={onOpenFile}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all group w-36 aspect-square"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FolderOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Open File</p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, Excel, JSON</p>
                </div>
              </button>
              <button
                onClick={onImportPipeline}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all group w-36 aspect-square"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileUp className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Import Flow</p>
                  <p className="text-xs text-muted-foreground mt-1">.xanflow files</p>
                </div>
              </button>
              <button
                onClick={() => onOpenUrl?.("https://github.com/tansen87/easy-csv")}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all group w-36 aspect-square"
              >
                <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                  <Star className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Star on GitHub</p>
                </div>
              </button>
            </div>
          </div>
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
          onStepAliasUpdate={onStepAliasUpdate || (() => { })}
          onStepRemove={onStepDelete || (() => { })}
          onOpenFilterDialog={(col, x, y) => setFilterDialog({ col, x, y })}
          onOpenPivotDialog={(x, y) => setPivotDialog({ x, y })}
          onOpenDateTransformDialog={(col, x, y) => setDateTransformDialog({ col, x, y })}
          onOpenSliceDialog={(col, x, y, sliceType) => setSplitDialog({ col, x, y, sliceType })}
          onOpenReplaceDialog={(col, x, y) => setReplaceDialog({ col, x, y })}
          onOpenWindowDialog={(col, x, y) => setWindowDialog({ col, x, y })}
          onOpenPadDialog={(col, x, y, padType) => setPadDialog({ col, x, y, padType })}
          onOpenSortDialog={(col, x, y) => setSortDialog({ col, x, y })}
          onOpenTextTransformDialog={(col, x, y, transformType) => setTextTransformDialog({ col, x, y, transformType })}
          onOpenNumberTransformDialog={(col, x, y, transformType) => setNumberTransformDialog({ col, x, y, transformType })}
          onTableRename={handleTableRename}
          onSave={handleSaveRenames}
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
          showMinimap={showMinimap}
        />
      </div>

      <div className="absolute top-10 ml-2 z-10" onContextMenu={(e) => e.preventDefault()}>
        <div className="h-[48px] px-4 flex items-center">
          <ScrollArea className="h-full flex-1">
            <div className="flex items-center gap-2 pr-4">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-1.5 py-1 rounded-md text-xs transition-colors shrink-0 ${selectedTabId === tab.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-accent/50 border border-transparent'}`}
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
                        if (e.key === 'Enter') {
                          if (editingTabName.trim()) {
                            onRenameTab(tab.id, editingTabName.trim());
                          }
                          setEditingTabId(null);
                        } else if (e.key === 'Escape') {
                          setEditingTabId(null);
                        }
                      }}
                      className="w-24 px-2 py-0.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary h-6"
                      style={{ lineHeight: '1.2' }}
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => onTabChange(tab.id)}
                      className="text-left truncate max-w-[120px]"
                    >
                      {tab.name}
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    {tabs.length > 1 && (
                      <button
                        onClick={() => onRemoveTab(tab.id)}
                        className="p-1 rounded hover:bg-muted hover:text-foreground transition-colors text-muted-foreground/70 dark:text-muted-foreground/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
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
              Branch {branchProgress.current}/{branchProgress.total}
            </span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${branchProgress.status === "completed"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : branchProgress.status === "executing"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}>
              {branchProgress.status === "executing" && (
                <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {branchProgress.status === "completed" && (
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {branchProgress.status === "error" && (
                <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="max-w-[240px] truncate">{branchProgress.name}</span>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          onClose={closeContextMenu}
          onOpenFilterDialog={(col, x, y) => setFilterDialog({ col, x, y })}
          onOpenPivotDialog={(x, y) => setPivotDialog({ x, y })}
          onOpenDateTransformDialog={(col, x, y) => setDateTransformDialog({ col, x, y })}
          onOpenTextTransformDialog={(col, x, y, transformType) => setTextTransformDialog({ col, x, y, transformType })}
          onOpenNumberTransformDialog={(col, x, y, transformType) => setNumberTransformDialog({ col, x, y, transformType })}
          onOpenSliceDialog={(col, x, y, sliceType) => setSplitDialog({ col, x, y, sliceType })}
          onOpenReplaceDialog={(col, x, y) => setReplaceDialog({ col, x, y })}
          onOpenWindowDialog={(col, x, y) => setWindowDialog({ col, x, y })}
          onOpenPadDialog={(col, x, y, padType) => setPadDialog({ col, x, y, padType })}
          onOpenSortDialog={(col, x, y) => setSortDialog({ col, x, y })}
        />
      )}

      {commandDialog && (
        <CommandDialog
          commandDialog={commandDialog}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
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
