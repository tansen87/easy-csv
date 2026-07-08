import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { useDraggable } from "@/hooks/useDraggable";

export type NumberTransformType = "abs" | "floor" | "ceil" | "int" | "float" | "round";

interface NumberTransformDialogState {
  col: number;
  x: number;
  y: number;
  transformType?: NumberTransformType;
}

interface NumberTransformDialogProps {
  numberTransformDialog: NumberTransformDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

const transformOptions: { value: NumberTransformType; label: string }[] = [
  { value: "abs", label: "Abs" },
  { value: "floor", label: "Floor" },
  { value: "ceil", label: "Ceil" },
  { value: "int", label: "Integer" },
  { value: "float", label: "Float" },
  { value: "round", label: "Round" },
];

export function NumberTransformDialog({
  numberTransformDialog,
  headers,
  onAddCommand,
  onClose,
}: NumberTransformDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    const initialColumn = headers[numberTransformDialog.col];
    return initialColumn ? [initialColumn] : [];
  });
  const [selectedTransform, setSelectedTransform] = useState<NumberTransformType>(
    numberTransformDialog.transformType || "abs"
  );
  const [search, setSearch] = useState("");
  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: numberTransformDialog.x,
    initialY: numberTransformDialog.y,
    maxWidth: 360,
    maxHeight: 480,
  });

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const filteredHeaders = headers.filter((h) =>
    h.toLowerCase().includes(search.toLowerCase()),
  );

  const handleApply = () => {
    if (selectedColumns.length === 0) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (!mapCommand) return;

    const expressionMap: Record<NumberTransformType, (col: string) => string> = {
      abs: (col) => `abs(col("${col}")) as "${col}"`,
      floor: (col) => `floor(col("${col}")) as "${col}"`,
      ceil: (col) => `ceil(col("${col}")) as "${col}"`,
      int: (col) => `trunc(col("${col}")) as "${col}"`,
      float: (col) => `float(col("${col}")) as "${col}"`,
      round: (col) => `to_fixed(round(col("${col}"), 0.01), 2) as "${col}"`,
    };

    const expressions = selectedColumns.map((col) => expressionMap[selectedTransform](col)).join(", ");
    const alias = transformOptions.find(opt => opt.value === selectedTransform)?.label || selectedTransform;

    onAddCommand(mapCommand, {
      expression: expressions,
      overwrite: true,
      output: "",
    }, alias);
    onClose();
  };

  return (
    <div
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[280px] flex flex-col select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
          <span className="text-base font-medium">Number Transform</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="no-drag flex-1 h-7 px-2 text-xs border rounded-md bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Columns ({selectedColumns.length} selected)
          </label>
          <ScrollArea className="h-[120px] border rounded-md bg-background">
            <div className="p-1.5">
              {filteredHeaders.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5">No matches</span>
              ) : (
                filteredHeaders.map((header) => (
                  <button
                    key={header}
                    onClick={() => toggleColumn(header)}
                    className={`no-drag w-full text-left px-2 py-1 text-xs rounded transition-colors ${selectedColumns.includes(header)
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center ${selectedColumns.includes(header)
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                          }`}
                      >
                        {selectedColumns.includes(header) && (
                          <svg
                            className="w-2.5 h-2.5 text-primary-foreground"
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
                      </div>
                      <span className="truncate">{header}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Transform Type
          </label>
          <div className="border rounded-md bg-background p-1.5">
            <div className="flex flex-wrap -mx-0.5">
              {transformOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedTransform(option.value)}
                  className={`no-drag w-1/3 text-center px-1 py-1.5 text-xs rounded transition-colors ${selectedTransform === option.value
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 pb-3 flex gap-2 shrink-0">
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={handleApply}
          disabled={selectedColumns.length === 0}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}