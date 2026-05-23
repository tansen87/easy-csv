import { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Search or select...",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchValue
    ? options.filter(opt => opt.label.toLowerCase().includes(searchValue.toLowerCase()))
    : options;

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchValue("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchValue("");
  };

  return (
    <div className="space-y-1" ref={dropdownRef}>
      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchValue : (selectedOption?.label || "")}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-8 px-2 pr-8 text-xs border rounded bg-background"
        />
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchValue("");
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors">
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full border rounded bg-background shadow-lg">
          <ScrollArea className="h-36">
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors truncate"
                  >
                    {opt.label}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No options found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

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
        onAddCommand(aggCommand, {
          expression: columnsExpr,
          output: "",
        });
      }
    } else if (selectedColumns.length === 0) {
      const groupbyCommand = xanCommands.find((cmd) => cmd.id === "groupby");
      if (groupbyCommand) {
        onAddCommand(groupbyCommand, {
          columns: selectedGroupBy.map((col) => `"${col}"`).join(","),
          expression: columnsExpr,
          output: "",
        });
      }
    } else {
      const pivotCommand = xanCommands.find((cmd) => cmd.id === "pivot");
      if (pivotCommand) {
        onAddCommand(pivotCommand, {
          columns: selectedColumns.map((col) => `"${col}"`).join(","),
          expr: columnsExpr,
          groupby: selectedGroupBy.length > 0 ? selectedGroupBy.map((col) => `"${col}"`).join(",") : undefined,
          "column-sep": columnSep || "_",
          output: "",
        });
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[360px] h-[400px] flex flex-col"
      style={{
        left: Math.min(pivotDialog.x, window.innerWidth - 420),
        top: Math.min(pivotDialog.y, window.innerHeight - 520),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs font-medium">Pivot Table</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
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
            className="flex-1 h-7 px-2 text-xs border rounded bg-background"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Columns (pivot)
          </label>
          <ScrollArea>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded bg-background">
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
          </ScrollArea>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Row (groupby)
          </label>
          <ScrollArea>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded bg-background">
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
          </ScrollArea>
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
          <div className="space-y-1.5">
            {valueColumns.length === 0 ? (
              <div className="p-2 border rounded bg-muted/30 text-[10px] text-muted-foreground text-center">
                Click + to add value columns
              </div>
            ) : (
              valueColumns.map((vc, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <SearchableSelect
                      value={vc.column}
                      onChange={(v) => updateValueColumn(index, "column", v)}
                      options={availableForValues.map((h) => ({ label: h, value: h }))}
                      placeholder="Select column..."
                      label={""}
                    />
                  </div>
                  <div className="relative w-24">
                    <SearchableSelect
                      value={vc.aggregation}
                      onChange={(v) => updateValueColumn(index, "aggregation", v)}
                      options={aggregationTypes}
                      placeholder="Agg..."
                      label={""}
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
      </ScrollArea>

      <div className="flex gap-2 p-2 ml-1 mr-1 bg-muted/20 shrink-0">
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors hover:bg-accent"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors disabled:opacity-50"
          onClick={handleApply}
          disabled={valueColumns.length === 0}
        >
          Apply
        </button>
      </div>
    </div>
  );
}