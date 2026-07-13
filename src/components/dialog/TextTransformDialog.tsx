import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { useDraggable } from "@/hooks/useDraggable";

export type TextTransformType =
  | "len"
  | "lower"
  | "upper"
  | "trim"
  | "ltrim"
  | "rtrim"
  | "strip";

interface TextTransformDialogState {
  col: number;
  x: number;
  y: number;
  transformType?: TextTransformType;
}

interface TextTransformDialogProps {
  textTransformDialog: TextTransformDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

const transformOptions: { value: TextTransformType; label: string }[] = [
  { value: "len", label: "Len" },
  { value: "lower", label: "Lower" },
  { value: "upper", label: "Upper" },
  { value: "trim", label: "Trim" },
  { value: "ltrim", label: "Ltrim" },
  { value: "rtrim", label: "Rtrim" },
  { value: "strip", label: "Strip" },
];

export function TextTransformDialog({
  textTransformDialog,
  headers,
  onAddCommand,
  onClose,
}: TextTransformDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    const initialColumn = headers[textTransformDialog.col];
    return initialColumn ? [initialColumn] : [];
  });
  const [selectedTransform, setSelectedTransform] = useState<TextTransformType>(
    textTransformDialog.transformType || "lower",
  );
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogHeight, setDialogHeight] = useState(480);
  const [dialogWidth, setDialogWidth] = useState(280);

  useEffect(() => {
    if (dialogRef.current) {
      setDialogHeight(dialogRef.current.offsetHeight);
      setDialogWidth(dialogRef.current.offsetWidth);
    }
  }, []);

  const maxY = window.innerHeight - dialogHeight;
  const maxX = window.innerWidth - dialogWidth;

  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: textTransformDialog.x,
    initialY: textTransformDialog.y,
    maxWidth: dialogWidth,
    maxHeight: dialogHeight,
    maxX,
    maxY,
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

    const expressionMap: Record<TextTransformType, (col: string) => string> = {
      len: (col) => `col("${col}").len() as "${col}"`,
      lower: (col) => `col("${col}").lower() as "${col}"`,
      upper: (col) => `col("${col}").upper() as "${col}"`,
      trim: (col) => `col("${col}").trim() as "${col}"`,
      ltrim: (col) => `col("${col}").ltrim() as "${col}"`,
      rtrim: (col) => `col("${col}").rtrim() as "${col}"`,
      strip: (col) => `replace(col("${col}"), /[\r\t\n]/, "") as "${col}"`,
    };

    const expressions = selectedColumns
      .map((col) => expressionMap[selectedTransform](col))
      .join(", ");
    const alias =
      transformOptions.find((opt) => opt.value === selectedTransform)?.label ||
      selectedTransform;

    onAddCommand(
      mapCommand,
      {
        expression: expressions,
        overwrite: true,
        output: "",
      },
      alias,
    );
    onClose();
  };

  return (
    <div
      ref={dialogRef}
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
          <span className="text-base font-medium">Text Transform</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 shrink-0 no-drag">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="flex-1 h-7 px-2 text-xs border rounded-md bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-3 no-drag">
        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Columns ({selectedColumns.length} selected)
          </label>
          <ScrollArea className="h-[120px] border rounded-md bg-background">
            <div className="p-1.5">
              {filteredHeaders.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5">
                  No matches
                </span>
              ) : (
                filteredHeaders.map((header) => (
                  <button
                    key={header}
                    onClick={() => toggleColumn(header)}
                    className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                      selectedColumns.includes(header)
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center ${
                          selectedColumns.includes(header)
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
                  className={`w-1/3 text-center px-1 py-1.5 text-xs rounded transition-colors ${
                    selectedTransform === option.value
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

      <div className="px-3 pb-3 flex gap-2 shrink-0 no-drag">
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
