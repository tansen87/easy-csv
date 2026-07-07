import React, { useCallback, useState, useRef } from "react";
import { Handle, Position } from "reactflow";
import { Table, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/i18n";

export interface TableNodeData {
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onContextMenu: (col: number, x: number, y: number) => void;
  onRename: (col: number, newName: string) => void;
  onSave: () => void;
  onDelete?: () => void;
}

export function TableNode({ data, selected }: { data: TableNodeData; selected: boolean }) {
  const { headers, rows, columnWidths, onContextMenu, onRename, onSave, onDelete } = data;
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSaveButton, setShowSaveButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  }, []);

  const handleTableMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleTableMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleStartEdit = (col: number, currentValue: string) => {
    setEditingCol(col);
    setEditValue(currentValue);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[col] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = col * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleHeaderSelect = (colIndex: number) => {
    setEditingCol(colIndex);
    setEditValue(headers[colIndex]);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[colIndex] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = colIndex * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleFinishEdit = () => {
    if (editingCol !== null && editValue.trim() && editValue !== headers[editingCol]) {
      onRename(editingCol, editValue.trim());
    }
    setEditingCol(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishEdit();
    } else if (e.key === "Escape") {
      setEditingCol(null);
      setEditValue("");
    }
  };

  const { t } = useLanguage();

  return (
    <Card
      className={`w-[500px] overflow-hidden transition-all duration-200 ${selected
        ? "border-primary/50 shadow-lg ring-2 ring-primary/20"
        : "border-border/60 hover:border-primary/30"
        }`}
    >
      {/* TableNode 的双向 Handle */}
      <Handle type="source" position={Position.Right} id="table-right-source" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Left} id="table-left-target" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Left} id="table-left-source" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <Handle type="target" position={Position.Right} id="table-right-target" className="opacity-0" style={{ opacity: 0, pointerEvents: 'none' }} />
      <div className="table-node-header px-3 py-2 bg-muted/50 border-b border-border/50 flex items-center gap-2">
        <div className="w-6 h-6 bg-gradient-to-br from-green-500/25 to-green-500/10 rounded flex items-center justify-center">
          <Table className="h-3 w-3 text-green-600" />
        </div>
        <span className="font-semibold text-sm">Input Data</span>
        <div className="flex-1">
          <SearchableSelect
            value=""
            onChange={(value) => {
              const colIndex = headers.indexOf(value);
              if (colIndex !== -1) {
                handleHeaderSelect(colIndex);
              }
            }}
            options={headers.map((h, _i) => ({ label: h, value: h }))}
            placeholder={t.headerRename}
            size="sm"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          5 rows x {headers.length} cols
        </span>
        {showSaveButton && (
          <button
            onClick={() => {
              onSave();
              setShowSaveButton(false);
            }}
            className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-primary/10"
          >
            <Check className="h-3 w-3 text-green-500" />
          </button>
        )}
        <button
          onClick={() => onDelete?.()}
          className="w-5 h-5 rounded-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <ScrollArea
        className="h-[180px]"
        onWheel={handleWheel}
        onMouseDown={handleTableMouseDown}
        onMouseMove={handleTableMouseMove}
        onMouseUp={handleTableMouseUp}
      >
        <div className="min-w-max" ref={scrollContainerRef}>
          <table className="border-collapse">
            <colgroup>
              {headers.map((_, colIndex) => (
                <col key={colIndex} style={{ width: columnWidths[colIndex] || 100 }} />
              ))}
            </colgroup>
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                {headers.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate min-w-[100px]"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(colIndex, e.clientX, e.clientY);
                    }}
                    onDoubleClick={() => handleStartEdit(colIndex, header)}
                  >
                    {editingCol === colIndex ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background px-1 py-0.5 text-xs border border-primary rounded"
                        autoFocus
                      />
                    ) : (
                      header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/20">
                  {headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-border/30 px-2 py-1 text-xs truncate min-w-[100px]"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu(colIndex, e.clientX, e.clientY);
                      }}
                    >
                      {row[colIndex] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </Card>
  );
}
