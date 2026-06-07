import { useState, useRef, useEffect, useCallback, SetStateAction } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ThemeAwareInput } from "@/components/theme/ThemeAwareInput";
import { ThemeAwareCheckbox } from "@/components/theme/ThemeAwareCheckbox";
import { ThemeAwareButton } from "@/components/theme/ThemeAwareButton";

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
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>(headers[filterDialog.col] || "");
  const [position, setPosition] = useState({ x: filterDialog.x, y: filterDialog.y });
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
      x: Math.max(0, Math.min(dragRef.current.startPosX + deltaX, window.innerWidth - 260)),
      y: Math.max(0, Math.min(dragRef.current.startPosY + deltaY, window.innerHeight - 400)),
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
          });
        } else if (textOperator === "is_not_null") {
          onAddCommand(searchCommand, {
            select: selectedColumn,
            "non-empty": true,
          });
        } else if (textOperator === "equals" || textOperator === "not_equals") {
          if (!textValue.trim()) return;
          onAddCommand(searchCommand, {
            select: selectedColumn,
            exact: true,
            pattern: textValue,
            "ignore-case": ignoreCase,
            "invert-match": textOperator === "not_equals",
          });
        } else {
          if (!textValue.trim()) return;
          const isNegative = ["not_starts_with", "not_ends_with", "not_contains"].includes(textOperator);
          onAddCommand(searchCommand, {
            select: selectedColumn,
            pattern: buildRegexPattern(textOperator, textValue),
            regex: true,
            "ignore-case": ignoreCase,
            "invert-match": isNegative,
          });
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
        });
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
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
          <button
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === "text"
              ? "bg-accent text-foreground"
              : "text-primary hover:text-primary hover:bg-primary/10"
              }`}
            onClick={() => setFilterType("text")}
          >
            Text
          </button>
          <button
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${filterType === "number"
              ? "bg-accent text-foreground"
              : "text-primary hover:text-primary hover:bg-primary/10"
              }`}
            onClick={() => setFilterType("number")}
          >
            Number
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">
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
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
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
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    {textOperator === "regex" ? "Pattern" : "Value"}
                  </label>
                  <ThemeAwareInput
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder={textOperator === "regex" ? "Regex pattern..." : "Search text..."}
                  />
                </div>

                <ThemeAwareCheckbox
                  checked={ignoreCase}
                  onChange={(e) => setIgnoreCase(e)}
                >
                  Ignore case
                </ThemeAwareCheckbox>
              </>
            )}
          </>
        )}

        {filterType === "number" && (
          <>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Operator
              </label>
              <SearchableSelect
                value={numberOperator}
                onChange={(v) => setNumberOperator(v as NumberOperator)}
                options={numberOperators}
                placeholder="Search operator..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Value
              </label>
              <ThemeAwareInput
                type="number"
                value={numberValue}
                onChange={(e: { target: { value: SetStateAction<string>; }; }) => setNumberValue(e.target.value)}
                placeholder="Search number..."
              />
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-2 flex gap-2">
        <ThemeAwareButton
          className="flex-1"
          onClick={onClose}
        >
          Cancel
        </ThemeAwareButton>
        <ThemeAwareButton
          className="flex-1"
          onClick={handleApply}
        >
          Apply
        </ThemeAwareButton>
      </div>
    </div>
  );
}
