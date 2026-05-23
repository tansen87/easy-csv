import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

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
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not equals" },
  { value: "greater_than", label: "Greater than" },
  { value: "greater_or_equal", label: "Greater or equal" },
  { value: "less_than", label: "Less than" },
  { value: "less_or_equal", label: "Less or equal" },
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
        <div className="absolute z-50 w-[214px] border rounded bg-background shadow-lg">
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

  const columnName = headers[filterDialog.col] || "";

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
            select: columnName,
            empty: true,
            output: "",
          });
        } else if (textOperator === "is_not_null") {
          onAddCommand(searchCommand, {
            select: columnName,
            "non-empty": true,
            output: "",
          });
        } else if (textOperator === "equals" || textOperator === "not_equals") {
          if (!textValue.trim()) return;
          onAddCommand(searchCommand, {
            select: columnName,
            exact: true,
            pattern: textValue,
            "ignore-case": caseInsensitive,
            "invert-match": textOperator === "not_equals",
            output: "",
          });
        } else {
          if (!textValue.trim()) return;
          const isNegative = ["not_starts_with", "not_ends_with", "not_contains"].includes(textOperator);
          onAddCommand(searchCommand, {
            select: columnName,
            pattern: buildRegexPattern(textOperator, textValue),
            regex: true,
            "ignore-case": caseInsensitive,
            "invert-match": isNegative,
            output: "",
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
            expression = `col("${columnName}") == ${numberValue}`;
            break;
          case "not_equals":
            expression = `col("${columnName}") != ${numberValue}`;
            break;
          case "greater_than":
            expression = `col("${columnName}") > ${numberValue}`;
            break;
          case "greater_or_equal":
            expression = `col("${columnName}") >= ${numberValue}`;
            break;
          case "less_than":
            expression = `col("${columnName}") < ${numberValue}`;
            break;
          case "less_or_equal":
            expression = `col("${columnName}") <= ${numberValue}`;
            break;
        }

        onAddCommand(filterCommand, {
          expression,
          parallel: false,
          threads: undefined,
          output: "",
        });
      }
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[240px]"
      style={{
        left: Math.min(filterDialog.x, window.innerWidth - 260),
        top: Math.min(filterDialog.y, window.innerHeight - 350),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-xs font-medium truncate max-w-[160px]">{columnName}</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-1">
        <div className="flex rounded-lg overflow-hidden border">
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              filterType === "text"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent"
            }`}
            onClick={() => setFilterType("text")}
          >
            Text
          </button>
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
              filterType === "number"
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-accent"
            }`}
            onClick={() => setFilterType("number")}
          >
            Number
          </button>
        </div>

        {filterType === "text" && (
          <>
            <SearchableSelect
              label="Operator"
              value={textOperator}
              onChange={(v) => setTextOperator(v as TextOperator)}
              options={textOperators}
              placeholder="Search operator..."
            />

            {textOperator !== "is_null" && textOperator !== "is_not_null" && (
              <>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground">
                    {textOperator === "regex" ? "Pattern" : "Value"}
                  </label>
                  <input
                    type="text"
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    placeholder={textOperator === "regex" ? "Enter regex pattern..." : "Enter search text..."}
                    className="w-full h-7 px-1.5 text-xs border rounded bg-background"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="case-insensitive"
                    checked={caseInsensitive}
                    onChange={(e) => setCaseInsensitive(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label htmlFor="case-insensitive" className="text-[10px] cursor-pointer">
                    Ignore case
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {filterType === "number" && (
          <>
            <SearchableSelect
              label="Operator"
              value={numberOperator}
              onChange={(v) => setNumberOperator(v as NumberOperator)}
              options={numberOperators}
              placeholder="Search operator..."
            />

            <div>
              <label className="text-[10px] font-medium text-muted-foreground">
                Value
              </label>
              <input
                type="number"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                placeholder="Enter number..."
                className="w-full h-7 px-1.5 text-xs border rounded bg-background"
              />
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-2 flex gap-2">
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
          onClick={handleApply}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
