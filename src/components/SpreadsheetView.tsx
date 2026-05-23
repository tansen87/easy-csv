import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Table, X, Trash2, Plus, Edit3, Check, Rows3, Repeat2, Repeat } from "lucide-react";
import { ToastContainer, ToastType } from "@/components/Toast";
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
import { SortDialog } from "./spreadsheet/SortDialog";
import { PivotDialog } from "./spreadsheet/PivotDialog";
import { DateTransformDialog } from "./spreadsheet/DateTransformDialog";
import { SplitDialog } from "./spreadsheet/SplitDialog";
import { ReplaceDialog } from "./spreadsheet/ReplaceDialog";

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

interface TableCellProps {
  value: string;
  rowIndex: number;
  colIndex: number;
  width: number;
  isSelected: boolean;
  onCellClick: (e: React.MouseEvent, row: number, col: number) => void;
  onContextMenu: (e: React.MouseEvent, row: number, col: number) => void;
}

const TableCell = React.memo(function TableCell({
  value,
  rowIndex,
  colIndex,
  width,
  isSelected,
  onCellClick,
  onContextMenu,
}: TableCellProps) {
  return (
    <td
      className={`border border-border/50 px-2 py-2 text-sm cursor-cell select-none ${isSelected
        ? "bg-primary/10 outline outline-2 outline-primary/50"
        : ""
        }`}
      style={{
        width,
        minWidth: 80,
      }}
      onClick={(e) => onCellClick(e, rowIndex, colIndex)}
      onContextMenu={(e) => onContextMenu(e, rowIndex, colIndex)}
    >
      <div className="truncate">
        {value || ""}
      </div>
    </td>
  );
});

interface TableRowProps {
  rowData: string[];
  rowIndex: number;
  columnWidths: Record<number, number>;
  hasSelectedCell: boolean;
  selectedCellMap: Map<string, boolean>;
  onCellClick: (e: React.MouseEvent, row: number, col: number) => void;
  onContextMenu: (e: React.MouseEvent, row: number, col: number) => void;
  headersLength: number;
}

const TableRow = React.memo(function TableRow({
  rowData,
  rowIndex,
  columnWidths,
  hasSelectedCell,
  selectedCellMap,
  onCellClick,
  onContextMenu,
  headersLength,
}: TableRowProps) {
  return (
    <tr
      className={`hover:bg-muted/30 transition-colors ${hasSelectedCell ? "bg-primary/5" : ""
        }`}
    >
      {Array.from({ length: headersLength }, (_, colIndex) => (
        <TableCell
          key={colIndex}
          value={rowData[colIndex] || ""}
          rowIndex={rowIndex}
          colIndex={colIndex}
          width={columnWidths[colIndex] || 80}
          isSelected={selectedCellMap.has(`${rowIndex}-${colIndex}`)}
          onCellClick={onCellClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </tr>
  );
});

interface HeaderCellProps {
  header: string;
  colIndex: number;
  width: number;
  isSelected: boolean;
  renamedColumns: Record<string, string>;
  onHeaderSelect: (e: React.MouseEvent, col: number) => void;
  onHeaderContextMenu: (e: React.MouseEvent, col: number) => void;
  onHeaderClick: (_e: React.MouseEvent | null, col: number) => void;
  onRenameApply: () => void;
  onResizeStart: (colIndex: number, e: React.MouseEvent) => void;
  hasRenamedColumns: boolean;
  isLastColumn: boolean;
}

const HeaderCell = React.memo(function HeaderCell({
  header,
  colIndex,
  width,
  isSelected,
  renamedColumns,
  onHeaderSelect,
  onHeaderContextMenu,
  onHeaderClick,
  onRenameApply,
  onResizeStart,
  hasRenamedColumns,
  isLastColumn,
}: HeaderCellProps) {
  const isRenaming = renamedColumns[header] !== undefined;

  return (
    <th
      className={`border border-border/50 px-2 py-2 text-sm font-semibold text-foreground bg-muted/70 text-left group relative ${isSelected ? "bg-primary/10" : ""
        }`}
      style={{ width, minWidth: 80 }}
      onClick={(e) => onHeaderSelect(e, colIndex)}
      onContextMenu={(e) => onHeaderContextMenu(e, colIndex)}
    >
      <div className="flex items-center gap-1">
        {isRenaming ? (
          <input
            type="text"
            value={renamedColumns[header]}
            onChange={() => { }}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-1 py-0.5 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        ) : (
          <span
            className="font-medium truncate cursor-pointer"
            onDoubleClick={() => onHeaderClick(null as any, colIndex)}
          >{header}</span>
        )}
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {hasRenamedColumns && (
            <button
              onClick={onRenameApply}
              className="p-0.5 rounded hover:bg-accent transition-colors text-primary"
            >
              <Check className="h-3 w-3" />
            </button>
          )}
        </div>
        {!isLastColumn && (
          <div
            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize transition-colors z-20"
            onMouseDown={(e) => onResizeStart(colIndex, e)}
          />
        )}
      </div>
    </th>
  );
});

function useSelectedCellsState() {
  const [selectedCells, setSelectedCells] = useState<{ row: number; col: number }[]>([]);
  const [lastSelectedCell, setLastSelectedCell] = useState<{ row: number; col: number } | null>(null);

  const selectedCellMap = useMemo(() => {
    const map = new Map<string, boolean>();
    selectedCells.forEach(cell => {
      map.set(`${cell.row}-${cell.col}`, true);
    });
    return map;
  }, [selectedCells]);

  const selectedRows = useMemo(() => {
    const rows = new Set<number>();
    selectedCells.forEach(cell => {
      rows.add(cell.row);
    });
    return rows;
  }, [selectedCells]);

  const selectedCols = useMemo(() => {
    const cols = new Set<number>();
    selectedCells.forEach(cell => {
      cols.add(cell.col);
    });
    return cols;
  }, [selectedCells]);

  const handleCellClick = useCallback((e: React.MouseEvent, row: number, col: number) => {
    const newCell = { row, col };

    if (e.shiftKey && lastSelectedCell) {
      const minRow = Math.min(lastSelectedCell.row, row);
      const maxRow = Math.max(lastSelectedCell.row, row);
      const minCol = Math.min(lastSelectedCell.col, col);
      const maxCol = Math.max(lastSelectedCell.col, col);

      const rangeCells: { row: number; col: number }[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          rangeCells.push({ row: r, col: c });
        }
      }
      setSelectedCells(rangeCells);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedCells(prev => {
        const exists = prev.some(cell => cell.row === row && cell.col === col);
        if (exists) {
          return prev.filter(cell => !(cell.row === row && cell.col === col));
        } else {
          return [...prev, newCell];
        }
      });
      setLastSelectedCell(newCell);
    } else {
      setSelectedCells([newCell]);
      setLastSelectedCell(newCell);
    }
  }, [lastSelectedCell]);

  const handleHeaderSelect = useCallback((e: React.MouseEvent, col: number) => {
    e.stopPropagation();
    const headerCell = { row: -1, col };

    if (e.shiftKey && lastSelectedCell) {
      const minCol = Math.min(lastSelectedCell.col, col);
      const maxCol = Math.max(lastSelectedCell.col, col);
      const rangeCells: { row: number; col: number }[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        rangeCells.push({ row: -1, col: c });
      }
      setSelectedCells(rangeCells);
      setLastSelectedCell(headerCell);
    } else if (e.ctrlKey || e.metaKey) {
      setSelectedCells(prev => {
        const isAlreadySelected = prev.some(c => c.row === -1 && c.col === col);
        if (isAlreadySelected) {
          return prev.filter(c => !(c.row === -1 && c.col === col));
        } else {
          return [...prev, headerCell];
        }
      });
      setLastSelectedCell(headerCell);
    } else {
      setSelectedCells([headerCell]);
      setLastSelectedCell(headerCell);
    }
  }, [lastSelectedCell]);

  return {
    selectedCells,
    selectedCellMap,
    selectedRows,
    selectedCols,
    handleCellClick,
    handleHeaderSelect,
  };
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
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
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
  const [renamedColumns, setRenamedColumns] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

  const tableRef = useRef<HTMLTableElement>(null);

  const {
    selectedCellMap,
    selectedRows,
    selectedCols,
    handleCellClick,
    handleHeaderSelect,
  } = useSelectedCellsState();

  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
  const data = currentTab?.data || [];
  const headers = currentTab?.headers || [];
  const pipeline = currentTab?.pipeline || [];
  const inputFile = currentTab?.inputFile || "";

  const hasRenamedColumns = Object.keys(renamedColumns).length > 0;

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

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onPipelineReorder && selectedTabId) {
      const oldIndex = pipeline.findIndex((step) => step.id === active.id);
      const newIndex = pipeline.findIndex((step) => step.id === over.id);
      const newPipeline = arrayMove(pipeline, oldIndex, newIndex);
      onPipelineReorder(selectedTabId, newPipeline);
    }
  }, [pipeline, onPipelineReorder, selectedTabId]);

  const handleResizeStart = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colIndex);
    setResizingStartX(e.clientX);
    setResizingStartWidth(columnWidths[colIndex] || 80);
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
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [resizingCol]);

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
  }, []);

  const handleHeaderClick = useCallback(
    (_e: React.MouseEvent | null, col: number) => {
      const columnName = headers[col];
      if (!renamedColumns[columnName]) {
        setRenamedColumns((prev) => ({ ...prev, [columnName]: columnName }));
      }
    },
    [headers, renamedColumns],
  );

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
        abs: `abs(col("${columnName}") || 0) as "${columnName}"`,
        floor: `floor(col("${columnName}") || 0) as "${columnName}"`,
        ceil: `ceil(col("${columnName}") || 0) as "${columnName}"`,
        int: `trunc(col("${columnName}") || 0) as "${columnName}"`,
        float: `float(col("${columnName}") || 0) as "${columnName}"`,
        round: `to_fixed(round(col("${columnName}") || 0, 0.01), 2) as "${columnName}"`,
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
    closeFilterDialog();
    closeSortDialog();
    closeOperationDialog();
    closePivotDialog();
    closeDateTransformDialog();
    closeSplitDialog();
  });

  useEffect(() => {
    closeAllDialogsRef.current = () => {
      closeContextMenu();
      closeFilterDialog();
      closeSortDialog();
      closeOperationDialog();
      closePivotDialog();
      closeDateTransformDialog();
      closeSplitDialog();
    };
  }, [closeContextMenu, closeFilterDialog, closeSortDialog, closeOperationDialog, closePivotDialog, closeDateTransformDialog, closeSplitDialog]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeAllDialogsRef.current();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

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

      {pipeline.length > 0 && (
        <div className="px-4 py-2.5 border-b bg-gradient-to-r from-background/80 via-background/60 to-background/80 backdrop-blur-sm">
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
                <div className="flex items-start gap-2 pb-1.5">
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

      {selectedStepId && (() => {
        const selectedStep = pipeline.find((s) => s.id === selectedStepId);
        if (!selectedStep) return null;

        return (
          <div className="px-4 py-3 border-b bg-card/30">
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
                    <col key={colIndex} style={{ width: columnWidths[colIndex] || 80, minWidth: 80 }} />
                  ))}
                </colgroup>
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    {headers.map((header, colIndex) => (
                      <HeaderCell
                        key={colIndex}
                        header={header}
                        colIndex={colIndex}
                        width={columnWidths[colIndex] || 80}
                        isSelected={selectedCols.has(colIndex)}
                        renamedColumns={renamedColumns}
                        onHeaderSelect={handleHeaderSelect}
                        onHeaderContextMenu={handleHeaderContextMenu}
                        onHeaderClick={handleHeaderClick}
                        onRenameApply={handleRenameApply}
                        onResizeStart={handleResizeStart}
                        hasRenamedColumns={hasRenamedColumns}
                        isLastColumn={colIndex === headers.length - 1}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <TableRow
                      key={rowIndex}
                      rowData={row}
                      rowIndex={rowIndex}
                      columnWidths={columnWidths}
                      hasSelectedCell={selectedRows.has(rowIndex)}
                      selectedCellMap={selectedCellMap}
                      onCellClick={handleCellClick}
                      onContextMenu={handleContextMenu}
                      headersLength={headers.length}
                    />
                  ))}
                </tbody>
              </table>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" />
            </ScrollArea>
          </Card>
        </div>
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

      {replaceDialog && (
        <ReplaceDialog
          replaceDialog={replaceDialog}
          headers={headers}
          onAddCommand={onAddCommand}
          onClose={() => setReplaceDialog(null)}
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