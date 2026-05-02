import { useState, useCallback, useRef, useEffect } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Table, X, Trash2 } from "lucide-react";
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
import { PipelineStep, XanCommand } from "@/types/xan";
import { SortableStep } from "./spreadsheet/SortableStep";
import { ContextMenu } from "./spreadsheet/ContextMenu";
import { CommandDialog, CommandDialogState } from "./spreadsheet/CommandDialog";

interface SpreadsheetViewProps {
  data: string[][];
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  pipeline: PipelineStep[];
  onStepClick?: (step: PipelineStep) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  onStepDelete?: (stepId: string) => void;
  onPipelineReorder?: (newPipeline: PipelineStep[]) => void;
  inputFile: string;
}

export function SpreadsheetView({
  data,
  headers,
  onAddCommand,
  pipeline,
  onStepClick,
  onStepUpdate,
  onStepDelete,
  onPipelineReorder,
  inputFile,
}: SpreadsheetViewProps) {
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [columnWidths] = useState<Record<number, number>>({});
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [editingValue, setEditingValue] = useState("");
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

  const tableRef = useRef<HTMLTableElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

    if (over && active.id !== over.id && onPipelineReorder) {
      const oldIndex = pipeline.findIndex((step) => step.id === active.id);
      const newIndex = pipeline.findIndex((step) => step.id === over.id);
      const newPipeline = arrayMove(pipeline, oldIndex, newIndex);
      onPipelineReorder(newPipeline);
    }
  };

  const handleCellClick = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col });
  }, []);

  const handleCellDoubleClick = useCallback(
    (row: number, col: number) => {
      setEditingCell({ row, col });
      setEditingValue(data[row]?.[col] || "");
    },
    [data],
  );

  const handleEditBlur = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setEditingCell(null);
      setEditingValue("");
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditingValue("");
    }
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

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [closeContextMenu]);

  if (!inputFile || data.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
        <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Table className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Spreadsheet
              </h2>
              <p className="text-xs text-muted-foreground">
                Browse a CSV file to view
              </p>
            </div>
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
      {/* Toolbar */}
      <div className="p-4 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
              <Table className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Spreadsheet
              </h2>
              <p className="text-xs text-muted-foreground">
                {inputFile.split("\\").pop()} - {data.length - 1} rows
              </p>
            </div>
          </div>

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
                    title="Delete step"
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
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50 overflow-hidden">
            <div className="overflow-auto">
              <table ref={tableRef} className="w-full border-collapse">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    {headers.map((header, colIndex) => (
                      <th
                        key={colIndex}
                        className={`border border-border/50 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/70 text-left min-w-[100px] ${
                          selectedCell?.col === colIndex ? "bg-primary/10" : ""
                        }`}
                        style={{
                          width: columnWidths[colIndex] || 120,
                        }}
                        onContextMenu={(e) =>
                          handleHeaderContextMenu(e, colIndex)
                        }
                      >
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{header}</span>
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
                          onDoubleClick={() =>
                            handleCellDoubleClick(rowIndex, colIndex)
                          }
                          onContextMenu={(e) =>
                            handleContextMenu(e, rowIndex, colIndex)
                          }
                          style={{
                            width: columnWidths[colIndex] || 120,
                            maxWidth: columnWidths[colIndex] || 120,
                          }}
                        >
                          {editingCell?.row === rowIndex &&
                          editingCell?.col === colIndex ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={handleEditBlur}
                              onKeyDown={handleEditKeyDown}
                              className="w-full h-full bg-transparent border-none outline-none text-sm"
                            />
                          ) : (
                            <div className="truncate">
                              {row[colIndex] || ""}
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </ScrollArea>

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
    </div>
  );
}
