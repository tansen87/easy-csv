import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Table, X, Trash2, Plus, Edit3 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PipelineStep, XanCommand, PipelineTab } from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { SortableStep } from "./spreadsheet/SortableStep";
import { ContextMenu } from "./spreadsheet/ContextMenu";
import { CommandDialog, CommandDialogState } from "./spreadsheet/CommandDialog";
import { FilterDialog } from "./spreadsheet/FilterDialog";
import { PivotDialog } from "./spreadsheet/PivotDialog";

interface SpreadsheetViewProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onRemoveTab: (tabId: string) => void;
  onRemoveAllTabsExcept: (tabId: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepClick?: (step: PipelineStep) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  onStepDelete?: (stepId: string) => void;
  onPipelineReorder?: (tabId: string, newPipeline: PipelineStep[]) => void;
}

export function SpreadsheetView({
  tabs,
  selectedTabId,
  onTabChange,
  onAddTab,
  onRemoveTab,
  onRemoveAllTabsExcept,
  onRenameTab,
  onAddCommand,
  onStepClick,
  onStepUpdate,
  onStepDelete,
  onPipelineReorder,
}: SpreadsheetViewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizingStartX, setResizingStartX] = useState(0);
  const [resizingStartWidth, setResizingStartWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: number | null;
    col: number;
  } | null>(null);
  const [contextMenuSearch, setContextMenuSearch] = useState("");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [commandDialog, setCommandDialog] = useState<CommandDialogState | null>(
    null,
  );
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");
  const [filterDialog, setFilterDialog] = useState<{ col: number; x: number; y: number } | null>(null);
  const [operationDialog, setOperationDialog] = useState<{ col: number; x: number; y: number; columnName: string } | null>(null);
  const [pivotDialog, setPivotDialog] = useState<{ x: number; y: number } | null>(null);
  const [renamedColumns, setRenamedColumns] = useState<Record<string, string>>({});

  const tableRef = useRef<HTMLTableElement>(null);

  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
  const data = currentTab?.data || [];
  const headers = currentTab?.headers || [];
  const pipeline = currentTab?.pipeline || [];
  const inputFile = currentTab?.inputFile || "";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onPipelineReorder && selectedTabId) {
      const oldIndex = pipeline.findIndex((step) => step.id === active.id);
      const newIndex = pipeline.findIndex((step) => step.id === over.id);
      const newPipeline = arrayMove(pipeline, oldIndex, newIndex);
      onPipelineReorder(selectedTabId, newPipeline);
    }
  };

  const handleResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIndex);
    setResizingStartX(e.clientX);
    setResizingStartWidth(columnWidths[colIndex] || 150);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [columnWidths]);

  const handleResizeMove = useCallback((e: React.MouseEvent) => {
    if (resizingCol === null) return;
    const diff = e.clientX - resizingStartX;
    const newWidth = Math.max(80, resizingStartWidth + diff);
    setColumnWidths((prev) => ({
      ...prev,
      [resizingCol]: newWidth,
    }));
  }, [resizingCol, resizingStartX, resizingStartWidth]);

  const handleResizeEnd = useCallback(() => {
    if (resizingCol !== null) {
      setResizingCol(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [resizingCol]);

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: number, col: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row, col });
    },
    [],
  );

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent, col: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, row: null, col });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setContextMenuSearch("");
  }, []);

  const handleHeaderClick = useCallback(
    (_e: React.MouseEvent, col: number) => {
      const columnName = headers[col];
      if (!renamedColumns[columnName]) {
        setRenamedColumns((prev) => ({ ...prev, [columnName]: columnName }));
      }
    },
    [headers, renamedColumns],
  );

  const handleFilterClick = useCallback(
    (e: React.MouseEvent, col: number) => {
      e.stopPropagation();
      setFilterDialog({ col, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const closeFilterDialog = useCallback(() => {
    setFilterDialog(null);
  }, []);

  const handleOperationClick = useCallback(
    (e: React.MouseEvent, col: number, columnName: string) => {
      e.stopPropagation();
      setOperationDialog({ col, x: e.clientX, y: e.clientY, columnName });
    },
    [],
  );

  const closeOperationDialog = useCallback(() => {
    setOperationDialog(null);
  }, []);

  const handlePivotClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPivotDialog({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const closePivotDialog = useCallback(() => {
    setPivotDialog(null);
  }, []);

  const handleRenameApply = useCallback(() => {
    const changedColumns = Object.entries(renamedColumns).filter(
      ([oldName, newName]) => oldName !== newName && newName.trim() !== "",
    );
    if (changedColumns.length === 0 || !onAddCommand) return;

    const renameCommand = xanCommands.find((cmd) => cmd.id === "rename");
    if (renameCommand) {
      onAddCommand(renameCommand, {
        select: changedColumns.map(([oldName]) => oldName).join(","),
        columns: changedColumns.map(([, newName]) => newName.trim()).join(","),
        output: "",
      });
    }
    setRenamedColumns({});
  }, [renamedColumns, onAddCommand]);

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

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      closeFilterDialog();
      closeOperationDialog();
      closePivotDialog();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [closeContextMenu, closeFilterDialog, closeOperationDialog, closePivotDialog]);

  if (!inputFile || data.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
        <div className="border-b bg-card/50 backdrop-blur-sm">
          <div className="h-[48px] px-4 flex items-center">
            <div className="flex items-center shrink-0">
              <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
                <button
                  onClick={onAddTab}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm hover:bg-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (tabs.length > 1 && selectedTabId) {
                      onRemoveAllTabsExcept(selectedTabId);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm hover:bg-accent transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <ScrollArea className="h-full flex-1 ml-4">
              <div className="flex items-center gap-2 pr-4">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-2.5 py-1 mt-2 rounded-lg text-sm transition-colors shrink-0 ${selectedTabId === tab.id
                      ? 'bg-primary/10 text-primary border border-primary/30'
                      : 'hover:bg-accent border border-transparent'}`}
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
                      <button
                        onClick={() => {
                          setEditingTabId(tab.id);
                          setEditingTabName(tab.name);
                        }}
                        className="p-1 rounded hover:bg-accent transition-colors"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
              <Table className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              No file selected
            </p>
            <p className="text-xs text-muted-foreground/70">
              Select a CSV file from the top bar to view it
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
      {/* Toolbar + Tab Management */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="h-[48px] px-4 flex items-center">
          <div className="flex items-center shrink-0">
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={onAddTab}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm hover:bg-accent/70 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  if (tabs.length > 1 && selectedTabId) {
                    onRemoveAllTabsExcept(selectedTabId);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm hover:bg-accent/70 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ScrollArea className="h-full flex-1 ml-4">
            <div className="flex items-center gap-2 pr-4">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`flex items-center gap-2 px-2.5 py-1 mt-2 rounded-lg text-sm transition-colors shrink-0 ${selectedTabId === tab.id
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'hover:bg-accent border border-transparent'}`}
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
                    <button
                      onClick={() => {
                        setEditingTabId(tab.id);
                        setEditingTabName(tab.name);
                      }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
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

      {/* Pipeline Preview */}
      {pipeline.length > 0 && (
        <div className="px-4 py-2 border-b bg-background/50">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pipeline.map((step) => step.id)}
              strategy={verticalListSortingStrategy}
            >
              <ScrollArea className="w-full">
                <div className="flex items-start gap-2 pb-1">
                  {pipeline.map((step, index) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      index={index}
                      isLast={index === pipeline.length - 1}
                      headers={headers}
                      onStepClick={(s) => {
                        setSelectedStepId(s.id);
                        if (onStepClick) {
                          onStepClick(s);
                        }
                      }}
                      onStepDelete={onStepDelete || (() => { })}
                      setCommandDialog={setCommandDialog}
                    />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Parameter Panel for selected step */}
      {selectedStepId &&
        (() => {
          const selectedStep = pipeline.find((s) => s.id === selectedStepId);
          if (!selectedStep) return null;

          return (
            <div className="px-4 py-3 border-b bg-card/30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">
                  {selectedStep.command.name} Parameters
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (onStepDelete) {
                        onStepDelete(selectedStep.id);
                      }
                      setSelectedStepId(null);
                    }}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSelectedStepId(null)}
                    className="p-1 hover:bg-accent rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {selectedStep.command.parameters.map((param) => (
                  <div key={param.name} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {param.name}
                    </label>
                    {param.type === "flag" || param.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={selectedStep.parameters[param.name] || false}
                        onChange={(e) => {
                          if (onStepUpdate) {
                            onStepUpdate(selectedStep.id, {
                              ...selectedStep.parameters,
                              [param.name]: e.target.checked,
                            });
                          }
                        }}
                        className="h-4 w-4"
                      />
                    ) : param.type === "select" ? (
                      <select
                        value={
                          selectedStep.parameters[param.name] ||
                          param.default ||
                          ""
                        }
                        onChange={(e) => {
                          if (onStepUpdate) {
                            onStepUpdate(selectedStep.id, {
                              ...selectedStep.parameters,
                              [param.name]: e.target.value,
                            });
                          }
                        }}
                        className="w-full h-8 px-2 text-xs border rounded bg-background"
                      >
                        {param.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={param.type === "number" ? "number" : "text"}
                        value={
                          selectedStep.parameters[param.name] ||
                          param.default ||
                          ""
                        }
                        onChange={(e) => {
                          if (onStepUpdate) {
                            onStepUpdate(selectedStep.id, {
                              ...selectedStep.parameters,
                              [param.name]:
                                param.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            });
                          }
                        }}
                        placeholder={param.description}
                        className="w-full h-8 px-2 text-xs border rounded bg-background"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

      {/* Main Table */}
      <div
        className="flex-1 flex flex-col overflow-hidden relative"
        onMouseMove={handleResizeMove}
        onMouseUp={handleResizeEnd}
        onMouseLeave={handleResizeEnd}
      >
        <div className="p-4 h-full flex flex-col">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1">
              <table ref={tableRef} className="w-full border-collapse table-fixed">
                <colgroup>
                  {headers.map((_, colIndex) => (
                    <col key={colIndex} style={{ width: columnWidths[colIndex] || 150, minWidth: 150 }} />
                  ))}
                </colgroup>
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    {headers.map((header, colIndex) => (
                      <th
                        key={colIndex}
                        className={`border border-border/50 px-2 py-2 text-sm font-semibold text-foreground bg-muted/70 text-left group relative ${selectedCell?.col === colIndex ? "bg-primary/10" : ""
                          }`}
                        style={{
                          width: columnWidths[colIndex] || 120,
                          minWidth: 120,
                        }}
                        onContextMenu={(e) =>
                          handleHeaderContextMenu(e, colIndex)
                        }
                      >
                        <div className="flex items-center gap-1">
                          {renamedColumns[header] !== undefined ? (
                            <input
                              type="text"
                              value={renamedColumns[header]}
                              onChange={(e) =>
                                setRenamedColumns((prev) => ({
                                  ...prev,
                                  [header]: e.target.value,
                                }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-full px-1 py-0.5 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="font-medium truncate cursor-pointer"
                              onDoubleClick={() => handleHeaderClick(null as any, colIndex)}
                            >{header}</span>
                          )}
                          <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Object.keys(renamedColumns).length > 0 && (
                              <button
                                onClick={handleRenameApply}
                                className="p-0.5 rounded hover:bg-accent transition-colors text-primary"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => handleOperationClick(e, colIndex, header)}
                              className="p-0.5 rounded hover:bg-accent transition-colors"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={handlePivotClick}
                              className="p-0.5 rounded hover:bg-accent transition-colors"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => handleFilterClick(e, colIndex)}
                              className="p-0.5 rounded hover:bg-accent transition-colors"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                              </svg>
                            </button>
                          </div>
                          {colIndex < headers.length - 1 && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize transition-colors z-20"
                              onMouseDown={(e) => handleResizeStart(colIndex, e)}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className={`hover:bg-muted/30 transition-colors ${selectedCell?.row === rowIndex ? "bg-primary/5" : ""
                        }`}
                    >
                      {headers.map((_, colIndex) => (
                        <td
                          key={colIndex}
                          className={`border border-border/50 px-2 py-2 text-sm cursor-cell ${selectedCell?.row === rowIndex &&
                            selectedCell?.col === colIndex
                            ? "bg-primary/10 outline outline-2 outline-primary/50"
                            : ""
                            }`}
                          onClick={() => handleCellClick(rowIndex, colIndex)}
                          onContextMenu={(e) =>
                            handleContextMenu(e, rowIndex, colIndex)
                          }
                          style={{
                            width: columnWidths[colIndex] || 150,
                            minWidth: 150,
                          }}
                        >
                          <div className="truncate">
                            {row[colIndex] || ""}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          contextMenuSearch={contextMenuSearch}
          headers={headers}
          onSearchChange={setContextMenuSearch}
          onClose={closeContextMenu}
          onSetCommandDialog={setCommandDialog}
        />
      )}

      {/* Command Dialog */}
      {commandDialog && (
        <CommandDialog
          commandDialog={commandDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
        />
      )}

      {/* Filter Dialog */}
      {filterDialog && (
        <FilterDialog
          filterDialog={filterDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closeFilterDialog}
        />
      )}

      {/* Pivot Dialog */}
      {pivotDialog && (
        <PivotDialog
          pivotDialog={pivotDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={closePivotDialog}
        />
      )}

      {/* Operation Dialog */}
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
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Dedup
            </button>
            <button
              onClick={handleTranspose}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Transpose
            </button>
            <button
              onClick={handleReverse}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Reverse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
