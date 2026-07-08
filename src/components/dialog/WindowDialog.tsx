import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useDraggable } from "@/hooks/useDraggable";

interface WindowDialogState {
  col: number;
  x: number;
  y: number;
}

interface WindowDialogProps {
  windowDialog: WindowDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

interface WindowEntry {
  column: string;
  func: string;
  alias: string;
  windowSize: string;
}

const WINDOW_EXPRS = [
  { value: "cume_dist", label: "cume_dist", hasWindowSize: false },
  { value: "cummax", label: "cummax", hasWindowSize: false },
  { value: "cummin", label: "cummin", hasWindowSize: false },
  { value: "cumsum", label: "cumsum", hasWindowSize: false },
  { value: "dense_rank", label: "dense_rank", hasWindowSize: false },
  { value: "frac", label: "frac", hasWindowSize: false },
  { value: "front_coding", label: "front_coding", hasWindowSize: false },
  { value: "lag", label: "lag", hasWindowSize: false },
  { value: "lead", label: "lead", hasWindowSize: false },
  { value: "ntile", label: "ntile", hasWindowSize: true },
  { value: "percent_rank", label: "percent_rank", hasWindowSize: false },
  { value: "rank", label: "rank", hasWindowSize: false },
  { value: "rolling_avg", label: "rolling_avg", hasWindowSize: true },
  { value: "rolling_mean", label: "rolling_mean", hasWindowSize: true },
  { value: "rolling_stddev", label: "rolling_stddev", hasWindowSize: true },
  { value: "rolling_sum", label: "rolling_sum", hasWindowSize: true },
  { value: "rolling_var", label: "rolling_var", hasWindowSize: true },
  { value: "row_index", label: "row_index", hasWindowSize: false },
  { value: "row_number", label: "row_number", hasWindowSize: false },
];

const DEFAULT_WINDOW_SIZE = "10";

function buildExpression(entry: WindowEntry): string {
  const func = WINDOW_EXPRS.find(f => f.value === entry.func) || WINDOW_EXPRS[0];
  let expr = "";

  if (func.value === "ntile") {
    expr = `${func.value}(${entry.windowSize || DEFAULT_WINDOW_SIZE}, col("${entry.column}"))`;
  } else if (func.hasWindowSize) {
    expr = `${func.value}(${entry.windowSize || DEFAULT_WINDOW_SIZE}, col("${entry.column}"))`;
  } else if (func.value === "lag" || func.value === "lead") {
    expr = `${func.value}(col("${entry.column}"))`;
  } else if (func.value === "row_index" || func.value === "row_number") {
    expr = `${func.value}()`;
  } else {
    expr = `${func.value}(col("${entry.column}"))`;
  }

  if (entry.alias.trim()) {
    expr += ` as "${entry.alias.trim()}"`;
  }

  return expr;
}

export function WindowDialog({
  windowDialog,
  headers,
  onAddCommand,
  onClose,
}: WindowDialogProps) {
  const [entries, setEntries] = useState<WindowEntry[]>([
    {
      column: headers[windowDialog.col] || "",
      func: WINDOW_EXPRS[0].value,
      alias: "",
      windowSize: DEFAULT_WINDOW_SIZE
    }
  ]);
  const [groupby, setGroupby] = useState("");
  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: windowDialog.x,
    initialY: windowDialog.y,
    maxWidth: 380,
    maxHeight: 480,
  });

  const addEntry = () => {
    setEntries([...entries, {
      column: "",
      func: WINDOW_EXPRS[0].value,
      alias: "",
      windowSize: DEFAULT_WINDOW_SIZE
    }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: keyof WindowEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  const handleApply = () => {
    const validEntries = entries.filter(e => e.column.trim());
    if (validEntries.length === 0) return;

    const windowCommand = xanCommands.find((cmd) => cmd.id === "window");
    if (!windowCommand) return;

    const expressions = validEntries.map(e => buildExpression(e));
    const expression = expressions.join(", ");

    onAddCommand(windowCommand, {
      expression,
      groupby: groupby.trim() || undefined,
      output: "",
    }, "Window");
    onClose();
  };

  return (
    <div
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[360px] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
          <span className="text-base font-medium">Window Aggregation</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ScrollArea className="h-[270px]">
        <div className="p-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              GroupBy (optional)
            </label>
            <input
              type="text"
              value={groupby}
              onChange={(e) => setGroupby(e.target.value)}
              placeholder="Column(s) to group by..."
              className="w-full h-8 px-2 text-xs border rounded-md bg-background"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Expressions
              </span>
              <button
                onClick={addEntry}
                className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>

            {entries.map((entry, index) => {
              const func = WINDOW_EXPRS.find(f => f.value === entry.func);
              return (
                <div key={index} className="border rounded-md p-2 space-y-2 bg-muted/10">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Column</label>
                      <input
                        type="text"
                        value={entry.column}
                        onChange={(e) => updateEntry(index, "column", e.target.value)}
                        placeholder="Column..."
                        className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Alias</label>
                      <input
                        type="text"
                        value={entry.alias}
                        onChange={(e) => updateEntry(index, "alias", e.target.value)}
                        placeholder="Alias (Optional)"
                        className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                      />
                    </div>
                    <div className="w-4 shrink-0 self-start">
                      {entries.length > 1 && (
                        <button
                          onClick={() => removeEntry(index)}
                          className="p-0.5 hover:bg-accent rounded-md transition-colors"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Expression</label>
                      <SearchableSelect
                        value={entry.func}
                        onChange={(value) => updateEntry(index, "func", value)}
                        options={WINDOW_EXPRS.map(f => ({ value: f.value, label: f.label }))}
                        placeholder="Select expression..."
                      />
                    </div>
                    {func?.hasWindowSize && (
                      <div className="flex-1 space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">WinSize</label>
                        <input
                          type="number"
                          value={entry.windowSize}
                          onChange={(e) => updateEntry(index, "windowSize", e.target.value)}
                          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                          min="1"
                        />
                      </div>
                    )}
                    <div className="w-4 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 pb-2 flex gap-2">
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
        >
          Apply
        </Button>
      </div>
    </div>
  );
}