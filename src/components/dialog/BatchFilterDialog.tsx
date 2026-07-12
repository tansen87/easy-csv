import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDraggable } from "@/hooks/useDraggable";
import { XanCommand } from "@/types/xan";
import { xanCommands } from "@/data/commands";

type FilterType = "text" | "number";

type TextOperator =
  | "equals"
  | "not_equals"
  | "starts_with"
  | "not_starts_with"
  | "ends_with"
  | "not_ends_with"
  | "contains"
  | "not_contains"
  | "regex"
  | "is_null"
  | "is_not_null";

type NumberOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal";

const textOperators: { value: TextOperator; label: string }[] = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "not_starts_with", label: "Not starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "not_ends_with", label: "Not ends with" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not contains" },
  { value: "regex", label: "Regex" },
  { value: "is_null", label: "Is null" },
  { value: "is_not_null", label: "Is not null" },
];

const numberOperators: { value: NumberOperator; label: string }[] = [
  { value: "equals", label: "==" },
  { value: "not_equals", label: "!=" },
  { value: "greater_than", label: ">" },
  { value: "greater_or_equal", label: "≥" },
  { value: "less_than", label: "<" },
  { value: "less_or_equal", label: "≤" },
];

export interface BatchFilterConfig {
  column: string;
  filterType: FilterType;
  textOperator?: TextOperator;
  numberOperator?: NumberOperator;
  valueMode: "manual" | "column";
  manualValues?: string;
  extractColumn?: string;
  caseInsensitive?: boolean;
  outputDir?: string;
}

interface BatchFilterDialogState {
  x: number;
  y: number;
}

interface BatchFilterDialogProps {
  state: BatchFilterDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

export function BatchFilterDialog({
  state,
  headers,
  onAddCommand,
  onClose,
}: BatchFilterDialogProps) {
  const [filterType, setFilterType] = useState<FilterType>("text");
  const [textOperator, setTextOperator] = useState<TextOperator>("equals");
  const [numberOperator, setNumberOperator] =
    useState<NumberOperator>("equals");
  const [selectedColumn, setSelectedColumn] = useState<string>(
    headers[0] || "",
  );
  const [valueMode, setValueMode] = useState<"manual" | "column">("manual");
  const [manualValues, setManualValues] = useState("");
  const [extractColumn, setExtractColumn] = useState<string>(headers[0] || "");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [outputDir, setOutputDir] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogHeight, setDialogHeight] = useState(600);
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
    initialX: state.x,
    initialY: state.y,
    maxWidth: dialogWidth,
    maxHeight: dialogHeight,
    maxX,
    maxY,
  });

  // Reset state when dialog opens
  useEffect(() => {
    setFilterType("text");
    setTextOperator("equals");
    setNumberOperator("equals");
    setSelectedColumn(headers[0] || "");
    setValueMode("manual");
    setManualValues("");
    setExtractColumn(headers[0] || "");
    setCaseInsensitive(false);
    setOutputDir("");
  }, [headers]);

  const handleApply = () => {
    const needsValue =
      textOperator !== "is_null" && textOperator !== "is_not_null";
    if (needsValue && valueMode === "manual" && !manualValues.trim()) return;

    const batchFilterCmd = xanCommands.find((cmd) => cmd.id === "batch-filter");
    if (!batchFilterCmd) return;

    const parameters: Record<string, any> = {
      column: selectedColumn,
      "filter-type": filterType,
      "value-mode": valueMode,
    };

    if (filterType === "text") {
      parameters["text-operator"] = textOperator;
      if (caseInsensitive) {
        parameters["case-insensitive"] = true;
      }
    } else {
      parameters["number-operator"] = numberOperator;
    }

    if (valueMode === "manual") {
      parameters["manual-values"] = manualValues;
    } else {
      parameters["extract-column"] = extractColumn;
    }

    if (outputDir.trim()) {
      parameters["output-dir"] = outputDir.trim();
    }

    const alias = `Batch: ${selectedColumn} ${filterType === "text" ? textOperator : numberOperator}`;
    onAddCommand(batchFilterCmd, parameters, alias);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[280px] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-sm font-medium">Batch Filter</span>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="h-[34vh]">
        <div className="p-3 space-y-3">
          {/* Column selection */}
          <div className="no-drag">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Column
            </label>
            <SearchableSelect
              value={selectedColumn}
              onChange={(v) => setSelectedColumn(v as string)}
              options={headers.map((header) => ({
                value: header,
                label: header,
              }))}
              placeholder="Select column..."
            />
          </div>

          {/* Filter type toggle */}
          <div className="no-drag flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                filterType === "text"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => setFilterType("text")}
            >
              Text
            </button>
            <button
              className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                filterType === "number"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              onClick={() => setFilterType("number")}
            >
              Number
            </button>
          </div>

          {/* Operator selection */}
          {filterType === "text" ? (
            <div className="no-drag">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Operator
              </label>
              <SearchableSelect
                value={textOperator}
                onChange={(v) => setTextOperator(v as TextOperator)}
                options={textOperators}
                placeholder="Select operator..."
              />
            </div>
          ) : (
            <div className="no-drag">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Operator
              </label>
              <SearchableSelect
                value={numberOperator}
                onChange={(v) => setNumberOperator(v as NumberOperator)}
                options={numberOperators}
                placeholder="Select operator..."
              />
            </div>
          )}

          {/* Case insensitive */}
          {filterType === "text" && (
            <div className="no-drag flex items-center gap-1.5">
              <input
                type="checkbox"
                id="case-insensitive"
                checked={caseInsensitive}
                onChange={(e) => setCaseInsensitive(e.target.checked)}
                className="h-3.5 w-3.5 accent-foreground"
              />
              <label
                htmlFor="case-insensitive"
                className="text-xs cursor-pointer"
              >
                Ignore case
              </label>
            </div>
          )}

          {/* Value source — hidden for is_null / is_not_null */}
          {textOperator !== "is_null" && textOperator !== "is_not_null" && (
            <>
              <div className="no-drag">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Value Source
                </label>
                <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
                  <button
                    className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      valueMode === "manual"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    onClick={() => setValueMode("manual")}
                  >
                    Manual Input
                  </button>
                  <button
                    className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      valueMode === "column"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                    onClick={() => {
                      setExtractColumn(selectedColumn);
                      setValueMode("column");
                    }}
                  >
                    From Column
                  </button>
                </div>
              </div>

              {/* Value input */}
              {valueMode === "manual" ? (
                <div className="no-drag">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Values (one per line)
                  </label>
                  <textarea
                    value={manualValues}
                    onChange={(e) => setManualValues(e.target.value)}
                    placeholder={
                      textOperator === "regex"
                        ? "regex1\nregex2"
                        : "value1\nvalue2\nvalue3"
                    }
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background resize-none font-mono"
                  />
                </div>
              ) : (
                <div className="no-drag">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Extract unique values from column
                  </label>
                  <SearchableSelect
                    value={extractColumn}
                    onChange={(v) => setExtractColumn(v as string)}
                    options={headers.map((header) => ({
                      value: header,
                      label: header,
                    }))}
                    placeholder="Select column to extract values..."
                  />
                </div>
              )}
            </>
          )}

          {/* Output path */}
          <div className="no-drag">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Output Path (optional)
            </label>
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="Same as source file"
              className="w-full h-7 px-3 text-sm border rounded-md bg-background"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave empty to use source file directory
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="no-drag px-3 py-2 flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleApply}
          disabled={
            textOperator !== "is_null" &&
            textOperator !== "is_not_null" &&
            valueMode === "manual" &&
            !manualValues.trim()
          }
        >
          Add to Pipeline
        </Button>
      </div>
    </div>
  );
}
