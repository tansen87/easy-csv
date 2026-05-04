import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

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
  ) => void;
  onClose: () => void;
}

type AggregationType = "count" | "sum" | "avg" | "min" | "max" | "first" | "last";

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
    (h) => !selectedColumns.includes(h) && (h.toLowerCase().includes(search.toLowerCase()) || valueColumns.some((vc) => vc.column === h)),
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

    const wrapColumn = (col: string) => {
      if (/[\s,"'()`\\]/.test(col)) {
        return `\`${col}\``;
      }
      return col;
    };

    const columnsExpr = valueColumns
      .map((vc) => {
        const wrappedCol = wrapColumn(vc.column);
        if (vc.aggregation === "count") {
          return `count(${wrappedCol})`;
        }
        return `${vc.aggregation}(${wrappedCol})`;
      })
      .join(",");

    if (selectedColumns.length === 0 && selectedGroupBy.length === 0) {
      const aggCommand = xanCommands.find((cmd) => cmd.id === "agg");
      if (aggCommand) {
        onAddCommand(aggCommand, {
          expression: columnsExpr,
          output: "",
        });
      }
    } else if (selectedColumns.length === 0) {
      const groupbyCommand = xanCommands.find((cmd) => cmd.id === "groupby");
      if (groupbyCommand) {
        onAddCommand(groupbyCommand, {
          columns: selectedGroupBy.map(wrapColumn).join(","),
          expression: columnsExpr,
          output: "",
        });
      }
    } else {
      const pivotCommand = xanCommands.find((cmd) => cmd.id === "pivot");
      if (pivotCommand) {
        onAddCommand(pivotCommand, {
          columns: selectedColumns.map(wrapColumn).join(","),
          expr: columnsExpr,
          groupby: selectedGroupBy.length > 0 ? selectedGroupBy.map(wrapColumn).join(",") : undefined,
          "column-sep": columnSep || "_",
          output: "",
        });
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[380px]"
      style={{
        left: Math.min(pivotDialog.x, window.innerWidth - 400),
        top: Math.min(pivotDialog.y, window.innerHeight - 500),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-xs font-medium">Pivot Table</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[400px] overflow-y-auto">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="flex-1 h-7 px-2 text-xs border rounded bg-background"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Columns (Pivot on)
          </label>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 border rounded bg-background">
            {filteredHeaders.length === 0 ? (
              <span className="text-[10px] text-muted-foreground px-2 py-0.5">No matches</span>
            ) : (
              filteredHeaders.map((header) => (
                <button
                  key={header}
                  onClick={() => toggleColumn(header)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${selectedColumns.includes(header)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent"
                    }`}
                >
                  {header}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Row (groupby)
          </label>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 border rounded bg-background">
            {filteredHeaders.length === 0 ? (
              <span className="text-[10px] text-muted-foreground px-2 py-0.5">No matches</span>
            ) : (
              filteredHeaders.map((header) => (
                <button
                  key={header}
                  onClick={() => toggleGroupBy(header)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${selectedGroupBy.includes(header)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent"
                    }`}
                >
                  {header}
                </button>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium text-muted-foreground">
              Values (agg)
            </label>
            <button
              onClick={addValueColumn}
              className="p-0.5 hover:bg-accent rounded transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {valueColumns.length === 0 ? (
              <div className="p-2 border rounded bg-muted/30 text-[10px] text-muted-foreground text-center">
                Click + to add value columns
              </div>
            ) : (
              valueColumns.map((vc, index) => (
                <div key={index} className="flex items-center gap-1">
                  <select
                    value={vc.column}
                    onChange={(e) =>
                      updateValueColumn(index, "column", e.target.value)
                    }
                    className="flex-1 h-7 px-1.5 text-[10px] border rounded bg-background"
                  >
                    {availableForValues.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <select
                    value={vc.aggregation}
                    onChange={(e) =>
                      updateValueColumn(index, "aggregation", e.target.value)
                    }
                    className="w-24 h-7 px-1.5 text-[10px] border rounded bg-background"
                  >
                    {aggregationTypes.map((agg) => (
                      <option key={agg.value} value={agg.value}>
                        {agg.label}
                      </option>
                    ))}
                  </select>
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
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Column Separator
          </label>
          <input
            type="text"
            value={columnSep}
            onChange={(e) => setColumnSep(e.target.value)}
            placeholder="_"
            className="w-full h-7 px-2 text-xs border rounded bg-background"
            maxLength={5}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors hover:bg-accent"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-2 py-1.5 rounded text-xs bg-primary bg-muted transition-colors disabled:opacity-50"
            onClick={handleApply}
            disabled={valueColumns.length === 0}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}