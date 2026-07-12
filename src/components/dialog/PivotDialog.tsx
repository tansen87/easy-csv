import { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useDraggable } from "@/hooks/useDraggable";

interface PivotDialogState {
  x: number;
  y: number;
}

interface PivotDialogProps {
  pivotDialog: PivotDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

type AggregationType =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "first"
  | "last";

const aggregationTypes: { value: AggregationType; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "first", label: "First" },
  { value: "last", label: "Last" },
];

interface ValueColumn {
  column: string;
  aggregation: AggregationType;
}

export function PivotDialog({
  pivotDialog,
  headers,
  onAddCommand,
  onClose,
}: PivotDialogProps) {
  const [selectedGroupBy, setSelectedGroupBy] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [valueColumns, setValueColumns] = useState<ValueColumn[]>([]);
  const [columnSep, setColumnSep] = useState("_");
  const [search, setSearch] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogHeight, setDialogHeight] = useState(420);
  const [dialogWidth, setDialogWidth] = useState(360);

  useEffect(() => {
    if (dialogRef.current) {
      setDialogHeight(dialogRef.current.offsetHeight);
      setDialogWidth(dialogRef.current.offsetWidth);
    }
  }, []);

  const maxY = window.innerHeight - dialogHeight;
  const maxX = window.innerWidth - dialogWidth;

  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: pivotDialog.x,
    initialY: pivotDialog.y,
    maxWidth: dialogWidth,
    maxHeight: dialogHeight,
    maxX,
    maxY,
  });

  const toggleGroupBy = (col: string) => {
    setSelectedGroupBy((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const filteredHeaders = headers.filter((h) =>
    h.toLowerCase().includes(search.toLowerCase()),
  );

  const availableForValues = headers.filter(
    (h) =>
      !selectedColumns.includes(h) &&
      (h.toLowerCase().includes(search.toLowerCase()) ||
        valueColumns.some((vc) => vc.column === h)),
  );

  const addValueColumn = () => {
    const available = availableForValues.filter(
      (h) => !valueColumns.some((vc) => vc.column === h),
    );
    if (available.length > 0) {
      setValueColumns((prev) => [
        ...prev,
        { column: available[0], aggregation: "count" },
      ]);
    }
  };

  const removeValueColumn = (index: number) => {
    setValueColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const updateValueColumn = (
    index: number,
    field: "column" | "aggregation",
    value: string,
  ) => {
    setValueColumns((prev) =>
      prev.map((vc, i) =>
        i === index
          ? {
              ...vc,
              [field]:
                field === "aggregation" ? (value as AggregationType) : value,
            }
          : vc,
      ),
    );
  };

  const handleApply = () => {
    if (valueColumns.length === 0) return;

    const columnsExpr = valueColumns
      .map((vc) => {
        const col = `"${vc.column}"`;
        if (vc.aggregation === "count") {
          return `count(col(${col})) as ${col}`;
        }
        return `${vc.aggregation}(col(${col})) as ${col}`;
      })
      .join(",");

    if (selectedColumns.length === 0 && selectedGroupBy.length === 0) {
      const aggCommand = xanCommands.find((cmd) => cmd.id === "agg");
      if (aggCommand) {
        onAddCommand(
          aggCommand,
          {
            expression: columnsExpr,
            output: "",
          },
          "Agg",
        );
      }
    } else if (selectedColumns.length === 0) {
      const groupbyCommand = xanCommands.find((cmd) => cmd.id === "groupby");
      if (groupbyCommand) {
        onAddCommand(
          groupbyCommand,
          {
            columns: selectedGroupBy.map((col) => `"${col}"`).join(","),
            expression: columnsExpr,
            output: "",
          },
          "Groupby",
        );
      }
    } else {
      const pivotCommand = xanCommands.find((cmd) => cmd.id === "pivot");
      if (pivotCommand) {
        onAddCommand(
          pivotCommand,
          {
            columns: selectedColumns.map((col) => `"${col}"`).join(","),
            expr: columnsExpr,
            groupby:
              selectedGroupBy.length > 0
                ? selectedGroupBy.map((col) => `"${col}"`).join(",")
                : undefined,
            "column-sep": columnSep || "_",
            output: "",
          },
          "Pivot",
        );
      }
    }
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[360px] h-[420px] flex flex-col select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
          <span className="text-base font-medium">Pivot Table</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-3 py-2 border-b shrink-0">
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
            Columns (pivot)
          </label>
          <ScrollArea>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded-md bg-background">
              {filteredHeaders.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5">
                  No matches
                </span>
              ) : (
                filteredHeaders.map((header) => (
                  <button
                    key={header}
                    onClick={() => toggleColumn(header)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      selectedColumns.includes(header)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {header}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="mb-3">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Row (groupby)
          </label>
          <ScrollArea>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded-md bg-background">
              {filteredHeaders.length === 0 ? (
                <span className="text-xs text-muted-foreground px-2 py-0.5">
                  No matches
                </span>
              ) : (
                filteredHeaders.map((header) => (
                  <button
                    key={header}
                    onClick={() => toggleGroupBy(header)}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      selectedGroupBy.includes(header)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-accent"
                    }`}
                  >
                    {header}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-muted-foreground">
              Values (agg)
            </label>
            <button
              onClick={addValueColumn}
              className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="space-y-1.5">
            {valueColumns.length === 0 ? (
              <div className="p-2 border rounded-md bg-muted/30 text-xs text-muted-foreground text-center">
                Click + to add value columns
              </div>
            ) : (
              valueColumns.map((vc, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="relative flex-1 no-drag">
                    <SearchableSelect
                      value={vc.column}
                      onChange={(v) => updateValueColumn(index, "column", v)}
                      options={availableForValues.map((h) => ({
                        label: h,
                        value: h,
                      }))}
                      placeholder="Select column..."
                    />
                  </div>
                  <div className="relative w-24 no-drag">
                    <SearchableSelect
                      value={vc.aggregation}
                      onChange={(v) =>
                        updateValueColumn(index, "aggregation", v)
                      }
                      options={aggregationTypes}
                      placeholder="Agg..."
                    />
                  </div>
                  <button
                    onClick={() => removeValueColumn(index)}
                    className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Column Separator
          </label>
          <input
            type="text"
            value={columnSep}
            onChange={(e) => setColumnSep(e.target.value)}
            placeholder="_"
            className="no-drag w-full h-7 px-2 text-xs border rounded-md bg-background"
            maxLength={5}
          />
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
          disabled={valueColumns.length === 0}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
