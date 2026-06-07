import { useState, useRef, useEffect, useCallback } from "react";
import { X, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ThemeAwareInput } from "@/components/theme/ThemeAwareInput";

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
        <div className="p-3 space-y-2">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Column
            </label>
            <SearchableSelect
              value={selectedColumn}
              onChange={setSelectedColumn}
              options={headers.map(h => ({ label: h, value: h }))}
              placeholder="Search or select column..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Length
              </label>
              <ThemeAwareInput
                type="number"
                value={leftLength}
                onChange={(e) => setLeftLength(e.target.value)}
              />
            </div>
          )}

          {sliceType === "right" && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Length
              </label>
              <ThemeAwareInput
                type="number"
                value={rightLength}
                onChange={(e) => setRightLength(e.target.value)}
              />
            </div>
          )}

          {sliceType === "slice" && (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Start Index
                </label>
                <ThemeAwareInput
                  type="number"
                  value={sliceStart}
                  onChange={(e) => setSliceStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  End Index
                </label>
                <ThemeAwareInput
                  type="number"
                  value={sliceEnd}
                  onChange={(e) => setSliceEnd(e.target.value)}
                />
              </div>
            </div>
          )}

          {sliceType === "split" && (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
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
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    Custom Separator
                  </label>
                  <ThemeAwareInput
                    type="text"
                    value={customSeparator}
                    onChange={(e) => setCustomSeparator(e.target.value)}
                    placeholder="Custom separator"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Array Indices (0-based)
                </label>
                <div className="space-y-1">
                  {indices.map((index, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <ThemeAwareInput
                        type="text"
                        value={index}
                        onChange={(e) => updateIndex(idx, e.target.value)}
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
                    className="w-full h-8 px-2 text-xs border border-dashed rounded hover:border-accent transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="h-3 w-3 text-muted-foreground" />
                    Add Index
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  Join With (for multiple indices)
                </label>
                <ThemeAwareInput
                  type="text"
                  value={joinWith}
                  onChange={(e) => setJoinWith(e.target.value)}
                  placeholder="e.g., -, _, /, etc."
                />
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Output Column Name
            </label>
            <ThemeAwareInput
              type="text"
              value={outputColumnName}
              onChange={(e) => setOutputColumnName(e.target.value)}
              placeholder="Leave blank to keep original"
            />
          </div>
        </div>
      </ScrollArea>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 px-2 py-1.5 rounded text-sm bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedColumn || (sliceType === "split" && separator === "custom" && !customSeparator)}
          className="flex-1 px-2 py-1.5 rounded text-sm bg-muted transition-colors">
          Apply
        </button>
      </div>
    </div>
  );
}
