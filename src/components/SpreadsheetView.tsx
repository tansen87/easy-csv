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
  const [columnWidths] = useState<Record<number, number>>({});
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

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      closeFilterDialog();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [closeContextMenu, closeFilterDialog]);

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
                      onStepDelete={onStepDelete || (() => {})}
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
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <ScrollArea className="flex-1" type="always">
          <div className="p-4">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table ref={tableRef} className="w-full border-collapse min-w-max">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      {headers.map((header, colIndex) => (
                        <th
                          key={colIndex}
                          className={`border border-border/50 px-2 py-2 text-xs font-semibold text-muted-foreground bg-muted/70 text-left group ${
                            selectedCell?.col === colIndex ? "bg-primary/10" : ""
                          }`}
                          style={{
                            width: columnWidths[colIndex] || 120,
                            minWidth: 120,
                          }}
                          onContextMenu={(e) =>
                            handleHeaderContextMenu(e, colIndex)
                          }
                          onClick={(e) => handleHeaderClick(e, colIndex)}
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
                                className="w-full px-1 py-0.5 border rounded text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium truncate">{header}</span>
                            )}
                            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {Object.keys(renamedColumns).length > 0 && (
                                <button
                                  onClick={handleRenameApply}
                                  className="p-0.5 rounded hover:bg-accent transition-colors text-primary"
                                >
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              <button
                                onClick={(e) => handleFilterClick(e, colIndex)}
                                className="p-0.5 rounded hover:bg-accent transition-colors"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className={`hover:bg-muted/30 transition-colors ${
                          selectedCell?.row === rowIndex ? "bg-primary/5" : ""
                        }`}
                      >
                        {headers.map((_, colIndex) => (
                          <td
                            key={colIndex}
                            className={`border border-border/50 px-3 py-1.5 text-sm cursor-cell ${
                              selectedCell?.row === rowIndex &&
                              selectedCell?.col === colIndex
                                ? "bg-primary/10 outline outline-2 outline-primary/50"
                                : ""
                            }`}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                            onContextMenu={(e) =>
                              handleContextMenu(e, rowIndex, colIndex)
                            }
                            style={{
                              width: columnWidths[colIndex] || 120,
                              minWidth: 120,
                              maxWidth: 300,
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
              </div>
            </Card>
          </div>
          <ScrollBar orientation="horizontal" className="top-0 bottom-auto" />
          <ScrollBar orientation="vertical" />
        </ScrollArea>
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
    </div>
  );
}
