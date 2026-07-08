import { useState } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useDraggable } from "@/hooks/useDraggable";

interface FilterDialogState {
  col: number;
  x: number;
  y: number;
}

interface FilterDialogProps {
  filterDialog: FilterDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
    alias?: string,
  ) => void;
  onClose: () => void;
}

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

export function FilterDialog({
  filterDialog,
  headers,
  onAddCommand,
  onClose,
}: FilterDialogProps) {
  const [filterType, setFilterType] = useState<FilterType>("text");
  const [textOperator, setTextOperator] = useState<TextOperator>("equals");
  const [numberOperator, setNumberOperator] = useState<NumberOperator>("equals");
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>(headers[filterDialog.col] || "");
  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: filterDialog.x,
    initialY: filterDialog.y,
    maxWidth: 260,
    maxHeight: 400,
  });

  const buildRegexPattern = (
    operator: TextOperator,
    value: string,
  ): string => {
    if (operator === "regex") {
      return value;
    }
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    switch (operator) {
      case "equals":
        return `^${escaped}$`;
      case "starts_with":
        return `^${escaped}`;
      case "ends_with":
        return `${escaped}$`;
      case "contains":
        return escaped;
      default:
        return escaped;
    }
  };

  const handleApply = () => {
    if (filterType === "text") {
      const searchCommand = xanCommands.find((cmd) => cmd.id === "search");
      if (searchCommand) {
        if (textOperator === "is_null") {
          onAddCommand(searchCommand, {
            select: selectedColumn,
            empty: true,
          }, textOperator);
        } else if (textOperator === "is_not_null") {
          onAddCommand(searchCommand, {
            select: selectedColumn,
            "non-empty": true,
          }, textOperator);
        } else if (textOperator === "equals" || textOperator === "not_equals") {
          if (!textValue.trim()) return;
          onAddCommand(searchCommand, {
            select: selectedColumn,
            exact: true,
            pattern: textValue,
            "ignore-case": caseInsensitive,
            "invert-match": textOperator === "not_equals",
          }, textOperator);
        } else {
          if (!textValue.trim()) return;
          const isNegative = ["not_starts_with", "not_ends_with", "not_contains"].includes(textOperator);
          onAddCommand(searchCommand, {
            select: selectedColumn,
            pattern: buildRegexPattern(textOperator, textValue),
            regex: true,
            "ignore-case": caseInsensitive,
            "invert-match": isNegative,
          }, textOperator);
        }
      }
    } else {
      if (!numberValue.trim()) return;

      const filterCommand = xanCommands.find((cmd) => cmd.id === "filter");
      if (filterCommand) {
        let expression = "";

        switch (numberOperator) {
          case "equals":
            expression = `col("${selectedColumn}") == ${numberValue}`;
            break;
          case "not_equals":
            expression = `col("${selectedColumn}") != ${numberValue}`;
            break;
          case "greater_than":
            expression = `col("${selectedColumn}") > ${numberValue}`;
            break;
          case "greater_or_equal":
            expression = `col("${selectedColumn}") >= ${numberValue}`;
            break;
          case "less_than":
            expression = `col("${selectedColumn}") < ${numberValue}`;
            break;
          case "less_or_equal":
            expression = `col("${selectedColumn}") <= ${numberValue}`;
            break;
        }

        onAddCommand(filterCommand, {
          expression,
          parallel: false,
          threads: undefined,
        }, numberOperator);
      }
    }
    onClose();
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
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">Filter</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
          <button
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${filterType === "text"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            onClick={() => setFilterType("text")}
          >
            Text
          </button>
          <button
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${filterType === "number"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            onClick={() => setFilterType("number")}
          >
            Number
          </button>
        </div>

        <div className="no-drag">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <SearchableSelect
            value={selectedColumn}
            onChange={(v) => setSelectedColumn(v as string)}
            options={headers.map((header) => ({ value: header, label: header }))}
            placeholder="Select column..."
          />
        </div>

        {filterType === "text" && (
          <>
            <div className="no-drag">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Operator
              </label>
              <SearchableSelect
                value={textOperator}
                onChange={(v) => setTextOperator(v as TextOperator)}
                options={textOperators}
                placeholder="Search operator..."
              />
            </div>

            {textOperator !== "is_null" && textOperator !== "is_not_null" && (
              <>
                <div className="no-drag">
                  <label className="text-xs font-medium text-muted-foreground">
                    {textOperator === "regex" ? "Pattern" : "Value"}
                  </label>
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder={textOperator === "regex" ? "Regex pattern..." : "Search text..."}
                    className="w-full h-7 px-3 text-sm border rounded-md bg-background"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="case-insensitive"
                    checked={caseInsensitive}
                    onChange={(e) => setCaseInsensitive(e.target.checked)}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  <label htmlFor="case-insensitive" className="text-xs cursor-pointer">
                    Ignore case
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {filterType === "number" && (
          <>
            <div className="no-drag">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Operator
              </label>
              <SearchableSelect
                value={numberOperator}
                onChange={(v) => setNumberOperator(v as NumberOperator)}
                options={numberOperators}
                placeholder="Search operator..."
              />
            </div>

            <div className="no-drag">
              <label className="text-xs font-medium text-muted-foreground">
                Value
              </label>
              <input
                type="number"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                placeholder="Search number..."
                className="w-full h-7 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </>
        )}
      </div>

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
