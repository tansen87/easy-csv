import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDraggable } from "@/hooks/useDraggable";
import { useLanguage } from "@/i18n";
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

    const alias = `${t.batchFilter}: ${selectedColumn} ${filterType === "text" ? textOperator : numberOperator}`;
    onAddCommand(batchFilterCmd, parameters, alias);
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[280px] select-none"
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
        <span className="text-sm font-medium">{t.batchFilter}</span>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ScrollArea className="h-[34vh] no-drag">
        <div className="p-2 space-y-3">
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

          {filterType === "text" ? (
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
          ) : (
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
          )}

          {filterType === "text" && (
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
          )}

          {textOperator !== "is_null" && textOperator !== "is_not_null" && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  {t.valueSource}
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
                    {t.manualInput}
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
                    {t.fromColumn}
                  </button>
                </div>
              </div>

              {valueMode === "manual" ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t.valuesOnePerLine}
                  </label>
                  <textarea
                    value={manualValues}
                    onChange={(e) => setManualValues(e.target.value)}
                    placeholder={
                      textOperator === "regex"
                        ? "regex1\nregex2"
                        : "value1\nvalue2\nvalue3"
                    }
                    className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono expr-editor-scrollbar"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t.extractUniqueValues}
                  </label>
                  <Select
                    value={extractColumn}
                    onChange={(v) => setExtractColumn(v as string)}
                    options={headers.map((header) => ({
                      value: header,
                      label: header,
                    }))}
                    placeholder={t.selectColumn}
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              {t.outputPathOptional}
            </label>
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder={t.outputPathLeaveEmpty}
              className="w-full h-7 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      </ScrollArea>

      <div className="no-drag px-3 py-2 flex gap-2 justify-end">
        <Button variant="secondary" size="sm" onClick={onClose}>
          {t.cancel}
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
          {t.apply}
        </Button>
      </div>
    </div>
  );
}
