import { useState, useRef, useEffect } from "react";
import { X, ArrowUpAZ, ArrowDownAZ } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { useDraggable } from "@/hooks/useDraggable";

interface SortDialogState {
  col: number;
  x: number;
  y: number;
}

interface SortDialogProps {
  sortDialog: SortDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

export function SortDialog({
  sortDialog,
  headers,
  onAddCommand,
  onClose,
}: SortDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    const initialColumn = headers[sortDialog.col];
    return initialColumn ? [initialColumn] : [];
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [sortNumeric, setSortNumeric] = useState(false);
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogHeight, setDialogHeight] = useState(500);
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
    initialX: sortDialog.x,
    initialY: sortDialog.y,
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

    const sortCommand = xanCommands.find((cmd) => cmd.id === "sort");
    if (!sortCommand) return;

    const columns = selectedColumns.join(",");

    const params: Record<string, any> = {
      select: columns,
      output: "",
      reverse: sortOrder === "desc",
      numeric: sortNumeric,
    };

    onAddCommand(sortCommand, params, "Sort");
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
          <span className="text-base font-medium">Sort</span>
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
            <div className="p-1.5 space-y-0.5">
              {filteredHeaders.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-1.5">
                  No matches
                </span>
              ) : (
                filteredHeaders.map((header) => {
                  const selected = selectedColumns.includes(header);
                  return (
                    <button
                      key={header}
                      onClick={() => toggleColumn(header)}
                      className={`no-drag w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${
                        selected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-3.5 h-3.5 border rounded-md flex items-center justify-center ${
                            selected
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {selected && (
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
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Sort Order:
          </div>
          <ScrollArea className="h-[100px] border rounded-md bg-background p-2">
            <div className="space-y-0.5">
              {selectedColumns.map((col, index) => (
                <div key={col} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground/60">{index + 1}.</span>
                  <span className="font-medium">{col}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      onClick={() =>
                        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                      }
                      className="no-drag p-0.5 hover:bg-accent/50 rounded-md text-muted-foreground/60 hover:text-muted-foreground"
                    >
                      {sortOrder === "asc" ? (
                        <ArrowDownAZ className="h-4 w-4" />
                      ) : (
                        <ArrowUpAZ className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => setSortNumeric(!sortNumeric)}
                      className={`no-drag px-1.5 py-0.5 text-xs rounded-md transition-colors ${
                        sortNumeric
                          ? "bg-primary/20 text-primary"
                          : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {sortNumeric ? "Num" : "Text"}
                    </button>
                  </div>
                </div>
              ))}
              {selectedColumns.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No columns selected
                </span>
              )}
            </div>
          </ScrollArea>
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
