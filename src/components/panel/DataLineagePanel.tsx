import React, { useState, useRef, useCallback } from "react";
import {
  GitMerge,
  Search,
  ChevronDown,
  ChevronRight,
  Filter,
  Plus,
  Minus,
  RefreshCw,
  BarChart3,
  Columns,
  X,
  ArrowDown,
  Save,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLineage } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface DataLineagePanelProps {
  lineageData: StepLineage[];
  onGetLineageForColumn: (columnName: string) => StepLineage[];
  isLineageMode: boolean;
  onToggleLineageMode: (enabled: boolean) => void;
  onSaveLineage: () => void;
  onClose: () => void;
}

const TRANSFORMATION_ICONS: Record<string, React.ReactNode> = {
  filter: <Filter className="h-3 w-3" />,
  add: <Plus className="h-3 w-3" />,
  remove: <Minus className="h-3 w-3" />,
  rename: <RefreshCw className="h-3 w-3" />,
  cast: <RefreshCw className="h-3 w-3" />,
  aggregate: <BarChart3 className="h-3 w-3" />,
  sort: <RefreshCw className="h-3 w-3" />,
  group: <BarChart3 className="h-3 w-3" />,
  pivot: <RefreshCw className="h-3 w-3" />,
  flatten: <RefreshCw className="h-3 w-3" />,
  other: <RefreshCw className="h-3 w-3" />,
};

const TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-100 text-blue-800",
  number: "bg-green-100 text-green-800",
  date: "bg-purple-100 text-purple-800",
  boolean: "bg-amber-100 text-amber-800",
};

export function DataLineagePanel({
  lineageData,
  onGetLineageForColumn,
  isLineageMode,
  onToggleLineageMode,
  onSaveLineage,
  onClose,
}: DataLineagePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [columnSearch, setColumnSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  const handleSave = useCallback(() => {
    onSaveLineage();
    setSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaved(false), 3000);
  }, [onSaveLineage]);

  const allColumns = React.useMemo(() => {
    const columns = new Set<string>();
    lineageData.forEach((step) => {
      step.inputSchema.forEach((col) => columns.add(col.name));
      step.outputSchema.forEach((col) => columns.add(col.name));
    });
    return Array.from(columns).sort();
  }, [lineageData]);

  const filteredColumns = React.useMemo(() => {
    if (!columnSearch) return allColumns;
    return allColumns.filter((col) =>
      col.toLowerCase().includes(columnSearch.toLowerCase()),
    );
  }, [allColumns, columnSearch]);

  const columnLineage = React.useMemo(() => {
    if (!selectedColumn) return [];
    return onGetLineageForColumn(selectedColumn);
  }, [selectedColumn, onGetLineageForColumn]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            {t.dataLineage}
          </h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isLineageMode}
                onChange={(e) => onToggleLineageMode(e.target.checked)}
                className="w-4 h-4 rounded border-input accent-foreground"
              />
              <span className="text-xs">Track</span>
            </label>
            {lineageData.length > 0 && (
              <button
                onClick={handleSave}
                className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
                title={saved ? "Saved!" : "Save lineage"}
              >
                {saved ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full h-8 pl-7 pr-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <ScrollArea className="h-[120px]">
          {filteredColumns.map((col) => (
            <button
              key={col}
              onClick={() =>
                setSelectedColumn(selectedColumn === col ? null : col)
              }
              className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                selectedColumn === col
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              <Columns className="inline h-3 w-3 mr-1" />
              {col}
            </button>
          ))}
        </ScrollArea>
      </div>

      <ScrollArea className="flex-1 h-[120px]">
        <div className="p-3">
          {lineageData.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              No lineage data available.
              <br />
              Enable tracking and execute a pipeline to see data flow.
            </div>
          ) : selectedColumn ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Lineage for column:{" "}
                <span className="text-primary">{selectedColumn}</span>
              </div>
              {columnLineage.map((step, index) => (
                <Card key={step.stepId} className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="text-xs font-medium">
                      {step.commandName}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Rows: {step.inputRowCount} → {step.outputRowCount}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {lineageData.map((step) => (
                <Card
                  key={step.stepId}
                  className="p-3 cursor-pointer transition-all hover:bg-accent/30"
                  onClick={() => toggleStep(step.stepId)}
                >
                  <div className="flex items-center gap-2">
                    {expandedSteps.has(step.stepId) ? (
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium">
                      {step.commandName}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {step.inputRowCount} → {step.outputRowCount} rows
                    </span>
                  </div>

                  {expandedSteps.has(step.stepId) && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          Input Columns
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {step.inputSchema.map((col) => (
                            <span
                              key={col.name}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded ${TYPE_COLORS[col.type]}`}
                            >
                              {col.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      </div>

                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          Output Columns
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {step.outputSchema.map((col) => (
                            <span
                              key={col.name}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded ${TYPE_COLORS[col.type]}`}
                            >
                              {col.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {step.transformations.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">
                            Transformations
                          </div>
                          <div className="space-y-1">
                            {step.transformations.map((t, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground"
                              >
                                {TRANSFORMATION_ICONS[t.type]}
                                <span>{t.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
