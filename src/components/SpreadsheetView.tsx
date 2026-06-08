import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { X, Rows3, Repeat2, Repeat, FolderOpen, FileUp, Star } from "lucide-react";
import { ToastContainer, ToastType } from "@/components/Toast";
import { PipelineStep, PipelineEdge, XanCommand, PipelineTab } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { ContextMenu } from "@/components/spreadsheet/ContextMenu";
import { CommandDialog, CommandDialogState } from "@/components/spreadsheet/CommandDialog";
import { FilterDialog } from "@/components/spreadsheet/FilterDialog";
import { SortDialog } from "@/components/spreadsheet/SortDialog";
import { PivotDialog } from "@/components/spreadsheet/PivotDialog";
import { DateTransformDialog } from "@/components/spreadsheet/DateTransformDialog";
import { SplitDialog } from "@/components/spreadsheet/SplitDialog";
import { PadDialog } from "@/components/spreadsheet/PadDialog";
import { ReplaceDialog } from "@/components/spreadsheet/ReplaceDialog";
import { WindowDialog } from "@/components/spreadsheet/WindowDialog";
import { FlowPanel } from "@/components/spreadsheet/FlowPanel";
import { SettingsTabContent } from "@/components/SettingsTabContent";

interface SpreadsheetViewProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  onTabChange: (tabId: string) => void;
  onRemoveTab: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
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
  theme?: "dark" | "light" | "system";
  onThemeChange?: (theme: "dark" | "light" | "system") => void;
  defaultDelimiter?: string;
  onDefaultDelimiterChange?: (delimiter: string) => void;
  noQuoting?: boolean;
  onNoQuotingChange?: (value: boolean) => void;
  noHeaders?: boolean;
  onNoHeadersChange?: (value: boolean) => void;
  onSaveSettings?: () => void;
  isSavingSettings?: boolean;
}

export function SpreadsheetView({
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
  theme,
  onThemeChange,
  defaultDelimiter,
  onDefaultDelimiterChange,
  noQuoting,
  onNoQuotingChange,
  noHeaders,
  onNoHeadersChange,
  onSaveSettings,
  isSavingSettings,
}: SpreadsheetViewProps) {
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
  const [operationDialog, setOperationDialog] = useState<{ col: number; x: number; y: number; columnName: string } | null>(null);
  const [pivotDialog, setPivotDialog] = useState<{ x: number; y: number } | null>(null);
  const [replaceDialog, setReplaceDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [dateTransformDialog, setDateTransformDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [splitDialog, setSplitDialog] = useState<{ col: number; x: number; y: number; sliceType?: string } | null>(null);
  const [padDialog, setPadDialog] = useState<{ col: number; x: number; y: number; padType: string } | null>(null);
  const [windowDialog, setWindowDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [renamedColumns, setRenamedColumns] = useState<Record<number, string>>({});
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

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

  const showToastRef = useRef<(message: string, type: ToastType) => void>(() => { });
  const removeToastRef = useRef<(id: string) => void>(() => { });

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToastRef.current(id);
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    showToastRef.current = showToast;
    removeToastRef.current = removeToast;
  }, [showToast, removeToast]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const closeFilterDialog = useCallback(() => {
    setFilterDialog(null);
  }, []);

  const closeSortDialog = useCallback(() => {
    setSortDialog(null);
  }, []);

  const closeOperationDialog = useCallback(() => {
    setOperationDialog(null);
  }, []);

  const closePivotDialog = useCallback(() => {
    setPivotDialog(null);
  }, []);

  const closeDateTransformDialog = useCallback(() => {
    setDateTransformDialog(null);
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

  const handleQuickSort = useCallback((col: number, order: "asc" | "desc", numeric: boolean) => {
    if (!onAddCommand) return;
    const sortCommand = xanCommands.find((cmd) => cmd.id === "sort");
    if (sortCommand) {
      const columnName = headers[col];
      onAddCommand(sortCommand, {
        select: columnName,
        reverse: order === "desc",
        numeric: numeric,
        output: "",
      });
    }
  }, [headers, onAddCommand]);

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
        showToast("Column renames applied to pipeline", "success");
      }
    }
  }, [renamedColumns, headers, onAddCommand, showToast]);



  const handleDedup = useCallback(() => {
    if (!operationDialog || !onAddCommand) return;
    const dedupCommand = xanCommands.find((cmd) => cmd.id === "dedup");
    if (dedupCommand) {
      onAddCommand(dedupCommand, {
        select: operationDialog.columnName,
        output: "",
      });
    }
    closeOperationDialog();
  }, [operationDialog, onAddCommand, closeOperationDialog]);

  const handleTranspose = useCallback(() => {
    if (!onAddCommand) return;
    const transposeCommand = xanCommands.find((cmd) => cmd.id === "transpose");
    if (transposeCommand) {
      onAddCommand(transposeCommand, {
        output: "",
      });
    }
    closeOperationDialog();
  }, [onAddCommand, closeOperationDialog]);

  const handleReverse = useCallback(() => {
    if (!onAddCommand) return;
    const reverseCommand = xanCommands.find((cmd) => cmd.id === "reverse");
    if (reverseCommand) {
      onAddCommand(reverseCommand, {
        output: "",
      });
    }
    closeOperationDialog();
  }, [onAddCommand, closeOperationDialog]);

  const handleContextMenuDedup = useCallback((col: number) => {
    if (!onAddCommand) return;
    const dedupCommand = xanCommands.find((cmd) => cmd.id === "dedup");
    if (dedupCommand) {
      const columnName = headers[col];
      onAddCommand(dedupCommand, {
        select: columnName,
        output: "",
      });
    }
  }, [onAddCommand, headers]);

  const handleContextMenuTranspose = useCallback(() => {
    if (!onAddCommand) return;
    const transposeCommand = xanCommands.find((cmd) => cmd.id === "transpose");
    if (transposeCommand) {
      onAddCommand(transposeCommand, {
        output: "",
      });
    }
  }, [onAddCommand]);

  const handleContextMenuReverse = useCallback(() => {
    if (!onAddCommand) return;
    const reverseCommand = xanCommands.find((cmd) => cmd.id === "reverse");
    if (reverseCommand) {
      onAddCommand(reverseCommand, {
        output: "",
      });
    }
  }, [onAddCommand]);

  const handleTextTransform = useCallback((col: number, transformType: string) => {
    if (!onAddCommand) return;
    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (mapCommand) {
      const columnName = headers[col];
      const expressionMap: Record<string, string> = {
        len: `col("${columnName}").len() as "${columnName}"`,
        lower: `col("${columnName}").lower() as "${columnName}"`,
        upper: `col("${columnName}").upper() as "${columnName}"`,
        trim: `col("${columnName}").trim() as "${columnName}"`,
        ltrim: `col("${columnName}").ltrim() as "${columnName}"`,
        rtrim: `col("${columnName}").rtrim() as "${columnName}"`,
        strip: `replace(col("${columnName}"), /[\r\t\n]/, "") as "${columnName}"`,
      };
      const expression = expressionMap[transformType];
      if (expression) {
        onAddCommand(mapCommand, {
          expression,
          overwrite: true,
          output: "",
        });
      }
    }
  }, [onAddCommand, headers]);

  const handleNumberTransform = useCallback((col: number, transformType: string) => {
    if (!onAddCommand) return;
    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (mapCommand) {
      const columnName = headers[col];
      const expressionMap: Record<string, string> = {
        abs: `abs(col("${columnName}")) as "${columnName}"`,
        floor: `floor(col("${columnName}")) as "${columnName}"`,
        ceil: `ceil(col("${columnName}")) as "${columnName}"`,
        int: `trunc(col("${columnName}")) as "${columnName}"`,
        float: `float(col("${columnName}")) as "${columnName}"`,
        round: `to_fixed(round(col("${columnName}"), 0.01), 2) as "${columnName}"`,
      };
      const expression = expressionMap[transformType];
      if (expression) {
        onAddCommand(mapCommand, {
          expression,
          overwrite: true,
          output: "",
        });
      }
    }
  }, [onAddCommand, headers]);

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

  // Check if current tab is settings tab
  const isSettingsTab = currentTab?.isSettings;

  if (isSettingsTab) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="bg-transparent" onContextMenu={(e) => e.preventDefault()}>
          <div className="h-[48px] px-4 flex items-center">
            <ScrollArea className="h-full flex-1">
              <div className="flex items-center gap-2 pr-4">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-2.5 py-1 mt-2 rounded-lg text-sm transition-colors shrink-0 ${selectedTabId === tab.id
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
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground/70 dark:text-muted-foreground/80"
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
        <div className="flex-1 overflow-hidden">
          <SettingsTabContent
            theme={theme || "light"}
            onThemeChange={onThemeChange || (() => { })}
            defaultDelimiter={defaultDelimiter || ","}
            onDefaultDelimiterChange={onDefaultDelimiterChange || (() => { })}
            noQuoting={noQuoting || false}
            onNoQuotingChange={onNoQuotingChange || (() => { })}
            noHeaders={noHeaders || false}
            onNoHeadersChange={onNoHeadersChange || (() => { })}
            onSave={onSaveSettings || (() => { })}
            isSaving={isSavingSettings || false}
          />
        </div>
      </div>
    );
  }

  if (!inputFile) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="bg-transparent" onContextMenu={(e) => e.preventDefault()}>
          <div className="h-[48px] px-4 flex items-center">
            <ScrollArea className="h-full flex-1">
              <div className="flex items-center gap-2 pr-4">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-2.5 py-1 mt-2 rounded-lg text-sm transition-colors shrink-0 ${selectedTabId === tab.id
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
                          className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground/70 dark:text-muted-foreground/80"
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
        <div className="flex-1 flex items-center justify-center" onContextMenu={(e) => e.preventDefault()}>
          <div className="max-w-md w-full px-8">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Welcome to Easy CSV
              </h2>
              <p className="text-sm text-muted-foreground">
                Open a file or import a pipeline to get started
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
                  <p className="text-sm font-medium text-foreground">Import Pipeline</p>
                  <p className="text-xs text-muted-foreground mt-1">.xan files</p>
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
    <div className="h-full flex flex-col bg-background">
      <div className="bg-transparent" onContextMenu={(e) => e.preventDefault()}>
        <div className="h-[48px] px-4 flex items-center">
          <ScrollArea className="h-full flex-1">
            <div className="flex items-center gap-2 pr-4">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-2.5 py-1 mt-2 rounded-lg text-sm transition-colors shrink-0 ${selectedTabId === tab.id
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
                        className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
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

      <div className="flex-1 relative overflow-hidden">
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
          onSort={handleQuickSort}
          onDedup={handleContextMenuDedup}
          onTranspose={handleContextMenuTranspose}
          onReverse={handleContextMenuReverse}
          onTextTransform={handleTextTransform}
          onNumberTransform={handleNumberTransform}
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

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          onClose={closeContextMenu}
          onOpenFilterDialog={(col, x, y) => setFilterDialog({ col, x, y })}
          onOpenPivotDialog={(x, y) => setPivotDialog({ x, y })}
          onOpenDateTransformDialog={(col, x, y) => setDateTransformDialog({ col, x, y })}
          onOpenSliceDialog={(col, x, y, sliceType) => setSplitDialog({ col, x, y, sliceType })}
          onOpenReplaceDialog={(col, x, y) => setReplaceDialog({ col, x, y })}
          onOpenWindowDialog={(col, x, y) => setWindowDialog({ col, x, y })}
          onOpenPadDialog={(col, x, y, padType) => setPadDialog({ col, x, y, padType })}
          onSort={handleQuickSort}
          onDedup={handleContextMenuDedup}
          onTranspose={handleContextMenuTranspose}
          onReverse={handleContextMenuReverse}
          onTextTransform={handleTextTransform}
          onNumberTransform={handleNumberTransform}
        />
      )}

      {commandDialog && (
        <CommandDialog
          commandDialog={commandDialog}
          headers={headers}
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

      {operationDialog && (
        <div
          className="fixed bg-card border rounded-lg shadow-xl z-50 w-[180px]"
          style={{
            left: Math.min(operationDialog.x, window.innerWidth - 200),
            top: Math.min(operationDialog.y, window.innerHeight - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
            <span className="text-xs font-medium truncate max-w-[120px]">{operationDialog.columnName}</span>
            <button
              onClick={closeOperationDialog}
              className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2 space-y-1">
            <button
              onClick={handleDedup}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
            >
              <Rows3 className="h-3.5 w-3.5" />
              Dedup
            </button>
            <button
              onClick={handleTranspose}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
            >
              <Repeat2 className="h-3.5 w-3.5" />
              Transpose
            </button>
            <button
              onClick={handleReverse}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
            >
              <Repeat className="h-3.5 w-3.5" />
              Reverse
            </button>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToastRef.current} />
    </div>
  );
}
