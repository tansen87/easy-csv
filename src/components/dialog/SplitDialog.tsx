import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface SplitDialogState {
  col: number;
  x: number;
  y: number;
  sliceType?: string;
}

interface SplitDialogProps {
  splitDialog: SplitDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand, initialParameters?: Record<string, any>) => void;
  onClose: () => void;
}

const SPLIT_SEPARATORS = [
  { label: "Custom", value: "custom" },
  { label: "Space", value: " " },
  { label: "Tab (\\t)", value: "\\t" },
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Pipe (|)", value: "|" },
  { label: "Hyphen (-)", value: "-" },
  { label: "Underscore (_)", value: "_" },
  { label: "Colon (:)", value: ":" },
  { label: "Slash (/)", value: "/" },
];

const SLICE_TYPES = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Slice", value: "slice" },
  { label: "Split", value: "split" },
];

export function SplitDialog({
  splitDialog,
  headers,
  onAddCommand,
  onClose,
}: SplitDialogProps) {
  const [sliceType, setSliceType] = useState(splitDialog.sliceType || "split");
  const [separator, setSeparator] = useState("/");
  const [customSeparator, setCustomSeparator] = useState("");
  const [outputColumnName, setOutputColumnName] = useState("new_col");
  const [selectedColumn, setSelectedColumn] = useState(headers[splitDialog.col] || "");
  const [leftLength, setLeftLength] = useState("4");
  const [rightLength, setRightLength] = useState("4");
  const [sliceStart, setSliceStart] = useState("0");
  const [sliceEnd, setSliceEnd] = useState("4");
  const [indices, setIndices] = useState<string[]>(["0"]);
  const [joinWith, setJoinWith] = useState("-");
  const [position, setPosition] = useState({ x: splitDialog.x, y: splitDialog.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

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
      y: Math.max(0, Math.min(dragRef.current.startPosY + deltaY, window.innerHeight - 540)),
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

  const handleApply = () => {
    if (!selectedColumn) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (!mapCommand) return;

    const outputName = outputColumnName.trim();
    const isOverwrite = outputName === selectedColumn;

    let expression = "";

    switch (sliceType) {
      case "left":
        expression = `col("${selectedColumn}")[:${leftLength}]`;
        break;
      case "right":
        expression = `col("${selectedColumn}")[-${rightLength}:]`;
        break;
      case "slice":
        expression = `col("${selectedColumn}")[${sliceStart}:${sliceEnd}]`;
        break;
      case "split": {
        const actualSeparator = separator === "custom" ? customSeparator : separator;
        const validIndices = indices.filter(i => i.trim() !== "");
        let splitExpr = `split(col("${selectedColumn}"), "${actualSeparator}")`;

        if (validIndices.length > 0) {
          if (validIndices.length === 1) {
            expression = `${splitExpr}[${validIndices[0]}]`;
          } else {
            const joinStr = joinWith || "";
            const indexParts = validIndices.map(i => `${splitExpr}[${i}]`).join(` ++ "${joinStr}" ++ `);
            expression = indexParts;
          }
        } else {
          expression = splitExpr;
        }
        break;
      }
    }

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

  const addIndexField = () => {
    setIndices([...indices, ""]);
  };

  const updateIndex = (index: number, value: string) => {
    const newIndices = [...indices];
    newIndices[index] = value;
    setIndices(newIndices);
  };

  const removeIndexField = (index: number) => {
    if (indices.length > 1) {
      setIndices(indices.filter((_, i) => i !== index));
    }
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
          <span className="text-base font-medium">Slice</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollArea className="h-[280px]">
        <div className="p-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Column
            </label>
            <SearchableSelect
              value={selectedColumn}
              onChange={setSelectedColumn}
              options={headers.map(header => ({ label: header, value: header }))}
              placeholder="Search or select column..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Operation Type
            </label>
            <SearchableSelect
              value={sliceType}
              onChange={setSliceType}
              options={SLICE_TYPES}
              placeholder="Select operation..."
            />
          </div>

          {sliceType === "left" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Length
              </label>
              <input
                type="number"
                value={leftLength}
                onChange={(e) => setLeftLength(e.target.value)}
                placeholder="4"
                className="w-full h-8 px-2 text-xs border rounded-md bg-background"
              />
            </div>
          )}

          {sliceType === "right" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Length
              </label>
              <input
                type="number"
                value={rightLength}
                onChange={(e) => setRightLength(e.target.value)}
                placeholder="4"
                className="w-full h-8 px-2 text-xs border rounded-md bg-background"
              />
            </div>
          )}

          {sliceType === "slice" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Start Index
                </label>
                <input
                  type="number"
                  value={sliceStart}
                  onChange={(e) => setSliceStart(e.target.value)}
                  placeholder="0"
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  End Index
                </label>
                <input
                  type="number"
                  value={sliceEnd}
                  onChange={(e) => setSliceEnd(e.target.value)}
                  placeholder="4"
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
            </div>
          )}

          {sliceType === "split" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Separator
                </label>
                <SearchableSelect
                  value={separator}
                  onChange={setSeparator}
                  options={SPLIT_SEPARATORS}
                  placeholder="Select separator..."
                />
              </div>

              {separator === "custom" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Custom Separator
                  </label>
                  <input
                    type="text"
                    value={customSeparator}
                    onChange={(e) => setCustomSeparator(e.target.value)}
                    placeholder="Enter custom separator"
                    className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                  />
                </div>
              )}

              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Array Indices (0-based)
                </label>
                <div>
                  {indices.map((index, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={index}
                        onChange={(e) => updateIndex(idx, e.target.value)}
                        placeholder="0"
                        className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
                      />
                      {indices.length > 1 && (
                        <button
                          onClick={() => removeIndexField(idx)}
                          className="p-1 hover:bg-accent rounded transition-colors"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addIndexField}
                    className="w-full h-8 px-2 text-xs border border-dashed rounded-md hover:border-accent transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    Add Index
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Join With (for multiple indices)
                </label>
                <input
                  type="text"
                  value={joinWith}
                  onChange={(e) => setJoinWith(e.target.value)}
                  placeholder="e.g., -, _, /, etc."
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Alias (Optional)
            </label>
            <input
              type="text"
              value={outputColumnName}
              onChange={(e) => setOutputColumnName(e.target.value)}
              placeholder="Leave blank to keep original"
              className="w-full h-8 px-2 text-xs border rounded-md bg-background"
            />
          </div>
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
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
          disabled={!selectedColumn || (sliceType === "split" && separator === "custom" && !customSeparator)}
          >
          Apply
        </Button>
      </div>
    </div>
  );
}
