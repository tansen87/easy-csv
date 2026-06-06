import { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronDown, GripVertical } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface DateTransformDialogState {
  col: number;
  x: number;
  y: number;
}

interface DateTransformDialogProps {
  dateTransformDialog: DateTransformDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand, initialParameters?: Record<string, any>) => void;
  onClose: () => void;
}

const DATE_FORMATS = [
  { label: "YYYYMMDD", value: "%Y%m%d" },
  { label: "YYYYMMDDHHMMSS", value: "%Y%m%d%H%M%S" },
  { label: "YYYYMMDDHHMM", value: "%Y%m%d%H%M" },
  { label: "DDMMYYYY", value: "%d%m%Y" },
  { label: "DDMMYYYYHHMMSS", value: "%d%m%Y%H%M%S" },
  { label: "MMDDYYYY", value: "%m%d%Y" },
  { label: "MMDDYYYYHHMMSS", value: "%m%d%Y%H%M%S" },

  // YMD
  { label: "YYYY-MM-DD", value: "%Y-%m-%d" },
  { label: "YYYY/MM/DD", value: "%Y/%m/%d" },
  { label: "YYYY-MM-DD HH:mm:ss", value: "%Y-%m-%d %H:%M:%S" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "%Y/%m/%d %H:%M:%S" },

  // YDM
  { label: "YYYY-DD-MM", value: "%Y-%d-%m" },
  { label: "YYYY/DD/MM", value: "%Y/%d/%m" },
  { label: "YYYY-DD-MM HH:mm:ss", value: "%Y-%d-%m %H:%M:%S" },
  { label: "YYYY/DD/MM HH:mm:ss", value: "%Y/%d/%m %H:%M:%S" },

  // MDY
  { label: "MM-DD-YYYY", value: "%m-%d-%Y" },
  { label: "MM/DD/YYYY", value: "%m/%d/%Y" },
  { label: "MM-DD-YYYY HH:mm:ss", value: "%m-%d-%Y %H:%M:%S" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "%m/%d/%Y %H:%M:%S" },

  // MYD
  { label: "MM-YYYY-DD", value: "%m-%Y-%d" },
  { label: "MM/YYYY/DD", value: "%m/%Y/%d" },
  { label: "MM-YYYY-DD HH:mm:ss", value: "%m-%Y-%d %H:%M:%S" },
  { label: "MM/YYYY/DD HH:mm:ss", value: "%m/%Y/%d %H:%M:%S" },

  // DMY
  { label: "DD-MM-YYYY", value: "%d-%m-%Y" },
  { label: "DD/MM/YYYY", value: "%d/%m/%Y" },
  { label: "DD-MM-YYYY HH:mm:ss", value: "%d-%m-%Y %H:%M:%S" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "%d/%m/%Y %H:%M:%S" },

  // DYM
  { label: "DD-YYYY-MM", value: "%d-%Y-%m" },
  { label: "DD/YYYY/MM", value: "%d/%Y/%m" },
  { label: "DD-YYYY-MM HH:mm:ss", value: "%d-%Y-%m %H:%M:%S" },
  { label: "DD/YYYY/MM HH:mm:ss", value: "%d/%Y/%m %H:%M:%S" },
];

export function DateTransformDialog({
  dateTransformDialog,
  headers,
  onAddCommand,
  onClose,
}: DateTransformDialogProps) {
  const [inputFormat, setInputFormat] = useState("%Y%m%d");
  const [outputFormat, setOutputFormat] = useState("%d/%m/%Y");
  const [outputColumnName, setOutputColumnName] = useState("new_date");
  const [selectedColumn, setSelectedColumn] = useState(headers[dateTransformDialog.col] || "");
  const [isColumnOpen, setIsColumnOpen] = useState(false);
  const [position, setPosition] = useState({ x: dateTransformDialog.x, y: dateTransformDialog.y });
  const [isDragging, setIsDragging] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const filteredHeaders = selectedColumn
    ? headers.filter(header => header.toLowerCase().includes(selectedColumn.toLowerCase()))
    : headers;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    setPosition({
      x: Math.max(0, Math.min(dragRef.current.startPosX + deltaX, window.innerWidth - 360)),
      y: Math.max(0, Math.min(dragRef.current.startPosY + deltaY, window.innerHeight - 500)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setIsColumnOpen(false);
      }
    };
    if (isColumnOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isColumnOpen]);

  const handleColumnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedColumn(e.target.value);
    setIsColumnOpen(true);
  };

  const handleColumnSelect = (header: string) => {
    setSelectedColumn(header);
    setIsColumnOpen(false);
  };

  const handleApply = () => {
    if (!selectedColumn) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (!mapCommand) return;

    const outputName = outputColumnName.trim();
    const isOverwrite = outputName === selectedColumn;

    const expression = `strftime(datetime(col("${selectedColumn}"), "${inputFormat}"), "${outputFormat}")`;
    const expressionWithAlias = outputName !== ""
      ? `${expression} as "${outputName}"`
      : expression;

    onAddCommand(mapCommand, {
      expression: expressionWithAlias,
      output: "",
      overwrite: isOverwrite,
    });
    onClose();
  };

  return (
    <div
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[240px] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium">Date Transform</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-1">
        <div className="space-y-1" ref={columnRef}>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <div className="relative">
            <input
              type="text"
              value={selectedColumn}
              onChange={handleColumnInputChange}
              onFocus={() => setIsColumnOpen(true)}
              placeholder="Search or select column..."
              className="w-full h-8 px-2 pr-8 text-xs border rounded bg-background"
            />
            <button
              onClick={() => setIsColumnOpen(!isColumnOpen)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors">
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isColumnOpen ? "rotate-180" : ""}`} />
            </button>
            {isColumnOpen && (
              <div className="absolute z-50 w-full overflow-y-auto border rounded bg-background shadow-lg mt-1">
                {filteredHeaders.length > 0 ? (
                  filteredHeaders.map((header) => (
                    <button
                      key={header}
                      onClick={() => handleColumnSelect(header)}
                      className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors truncate"
                    >
                      {header}
                    </button>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No columns found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Input Format
          </label>
          <SearchableSelect
            value={inputFormat}
            onChange={setInputFormat}
            options={DATE_FORMATS}
            placeholder="Search input format..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Output Format
          </label>
          <SearchableSelect
            value={outputFormat}
            onChange={setOutputFormat}
            options={DATE_FORMATS}
            placeholder="Search output format..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Output Column Name
          </label>
          <input
            type="text"
            value={outputColumnName}
            onChange={(e) => setOutputColumnName(e.target.value)}
            placeholder="Leave blank to keep original"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
          />
        </div>
      </div>
      <div className="px-3 pb-2 flex gap-2">
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
