import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { MultiValueInput } from "@/components/ui/MultiValueInput";
import { VariableHint } from "@/components/dialog/commands/VariableHint";
import { useDraggable } from "@/hooks/useDraggable";
import { useLanguage } from "@/i18n";

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

const textOperators: TextOperator[] = [
  "equals",
  "not_equals",
  "starts_with",
  "not_starts_with",
  "ends_with",
  "not_ends_with",
  "contains",
  "not_contains",
  "regex",
  "is_null",
  "is_not_null",
];

const numberOperators: NumberOperator[] = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_or_equal",
  "less_than",
  "less_or_equal",
];

const NUMBER_OPERATOR_LABELS: Record<NumberOperator, string> = {
  equals: "==",
  not_equals: "!=",
  greater_than: ">",
  greater_or_equal: "≥",
  less_than: "<",
  less_or_equal: "≤",
};

export function FilterDialog({
  filterDialog,
  headers,
  onAddCommand,
  onClose,
}: FilterDialogProps) {
  const { t } = useLanguage();
  const textOperatorLabels: Record<TextOperator, string> = {
    equals: t.opEquals,
    not_equals: t.opNotEquals,
    starts_with: t.opStartsWith,
    not_starts_with: t.opNotStartsWith,
    ends_with: t.opEndsWith,
    not_ends_with: t.opNotEndsWith,
    contains: t.opContains,
    not_contains: t.opNotContains,
    regex: t.opRegex,
    is_null: t.opIsNull,
    is_not_null: t.opIsNotNull,
  };
  const [filterType, setFilterType] = useState<FilterType>("text");
  const [textOperator, setTextOperator] = useState<TextOperator>("equals");
  const [numberOperator, setNumberOperator] =
    useState<NumberOperator>("equals");
  const [textValues, setTextValues] = useState<string[]>([]);
  const [numberValue, setNumberValue] = useState("");
  const [caseInsensitive, setCaseInsensitive] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>(
    headers[filterDialog.col] || "",
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const [dialogHeight, setDialogHeight] = useState(400);
  const [dialogWidth, setDialogWidth] = useState(240);

  useEffect(() => {
    if (dialogRef.current) {
      setDialogHeight(dialogRef.current.offsetHeight);
      setDialogWidth(dialogRef.current.offsetWidth);
    }
  }, []);

  const maxY = window.innerHeight - dialogHeight;
  const maxX = window.innerWidth - dialogWidth;

  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: filterDialog.x,
    initialY: filterDialog.y,
    maxWidth: dialogWidth,
    maxHeight: dialogHeight,
    maxX,
    maxY,
  });

  const buildRegexPattern = (operator: TextOperator, value: string): string => {
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
          onAddCommand(
            searchCommand,
            {
              select: selectedColumn,
              empty: true,
            },
            textOperator,
          );
        } else if (textOperator === "is_not_null") {
          onAddCommand(
            searchCommand,
            {
              select: selectedColumn,
              "non-empty": true,
            },
            textOperator,
          );
        } else {
          const patterns = textValues.map((v) => v.trim()).filter(Boolean);
          if (patterns.length === 0) return;
          const restPatterns = patterns.slice(1);
          // Empty string tells serialization there are no extra -P patterns.
          const addPattern = restPatterns.length ? restPatterns : "";
          if (textOperator === "equals" || textOperator === "not_equals") {
            onAddCommand(
              searchCommand,
              {
                select: selectedColumn,
                exact: true,
                pattern: patterns[0],
                "add-pattern": addPattern,
                "ignore-case": caseInsensitive,
                "invert-match": textOperator === "not_equals",
              },
              textOperator,
            );
          } else {
            const isNegative = [
              "not_starts_with",
              "not_ends_with",
              "not_contains",
            ].includes(textOperator);
            const escapeDash = (p: string) =>
              (textOperator === "contains" ||
                textOperator === "not_contains") &&
              p.startsWith("-")
                ? "\\" + p
                : p;
            onAddCommand(
              searchCommand,
              {
                select: selectedColumn,
                pattern: escapeDash(
                  buildRegexPattern(textOperator, patterns[0]),
                ),
                "add-pattern": addPattern
                  ? patterns
                      .slice(1)
                      .map((p) =>
                        escapeDash(buildRegexPattern(textOperator, p)),
                      )
                  : "",
                regex: true,
                "ignore-case": caseInsensitive,
                "invert-match": isNegative,
              },
              textOperator,
            );
          }
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

        onAddCommand(
          filterCommand,
          {
            expression,
            parallel: false,
            threads: undefined,
          },
          numberOperator,
        );
      }
    }
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[240px] select-none"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        onMouseDown={handleMouseDown}
        className={`flex items-center justify-between px-3 py-2 border-b bg-muted/20 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">{t.filterAction}</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground dark:text-muted-foreground/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3 no-drag">
        <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
          <button
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
              filterType === "text"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            onClick={() => setFilterType("text")}
          >
            {t.text}
          </button>
          <button
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
              filterType === "number"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
            onClick={() => setFilterType("number")}
          >
            {t.number}
          </button>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {t.filterColumn}
          </label>
          <Select
            value={selectedColumn}
            onChange={(v) => setSelectedColumn(v as string)}
            options={headers.map((header) => ({
              value: header,
              label: header,
            }))}
            placeholder={t.selectColumn}
          />
        </div>

        {filterType === "text" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t.filterOperator}
              </label>
              <Select
                value={textOperator}
                onChange={(v) => setTextOperator(v as TextOperator)}
                options={textOperators.map((value) => ({
                  value,
                  label: textOperatorLabels[value],
                }))}
                placeholder={t.selectOperator}
              />
            </div>

            {textOperator !== "is_null" && textOperator !== "is_not_null" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    {textOperator === "regex" ? t.pattern : t.value}
                  </label>
                  <MultiValueInput
                    values={textValues}
                    onChange={setTextValues}
                    placeholder={
                      textOperator === "regex"
                        ? t.regexPatterns
                        : t.addValuesEnter
                    }
                    className="mt-1"
                  />
                  <VariableHint value={textValues.join(" ")} />
                </div>

                <div className="flex items-center gap-1.5">
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
                    {t.ignoreCase}
                  </label>
                </div>
              </>
            )}
          </>
        )}

        {filterType === "number" && (
          <>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t.filterOperator}
              </label>
              <Select
                value={numberOperator}
                onChange={(v) => setNumberOperator(v as NumberOperator)}
                options={numberOperators.map((value) => ({
                  value,
                  label: NUMBER_OPERATOR_LABELS[value],
                }))}
                placeholder={t.selectOperator}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {t.value}
              </label>
              <input
                type="number"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                placeholder={t.searchNumber}
                className="w-full h-7 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </>
        )}
      </div>

      <div className="px-3 pb-2 flex gap-2 no-drag">
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          {t.cancel}
        </Button>
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={handleApply}
        >
          {t.apply}
        </Button>
      </div>
    </div>
  );
}
