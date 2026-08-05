import React, { useState, useRef, useCallback, useEffect } from "react";
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
  X,
  ArrowDown,
  Save,
  Check,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StepLineage } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { LineageGraph } from "@/components/panel/LineageGraph";
import { Tooltip } from "@/components/ui/tooltip";

interface DataLineagePanelProps {
  lineageData: StepLineage[];
  onGetLineageForColumn: (columnName: string) => StepLineage[];
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

type ViewMode = "graph" | "timeline";

export function DataLineagePanel({
  lineageData,
  onGetLineageForColumn,
  onSaveLineage,
  onClose,
}: DataLineagePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [columnSearch, setColumnSearch] = useState("");
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!isGraphExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsGraphExpanded(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGraphExpanded]);

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

  const handleColumnClick = useCallback((columnName: string) => {
    setSelectedColumn((prev) => (prev === columnName ? null : columnName));
  }, []);

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

  if (isGraphExpanded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="h-12 border-b border-border/50 flex items-center justify-between px-4 bg-card shrink-0">
          <div className="flex items-center gap-3">
            <GitMerge className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t.dataLineage}</span>
            <span className="text-xs text-muted-foreground">
              {lineageData.length} {t.rowsCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="text"
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                placeholder={t.searchColumns}
                className="h-8 w-48 pl-7 pr-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <ScrollArea className="h-8 max-w-[400px]">
              <div className="flex items-center gap-1 px-1">
                {filteredColumns.map((col) => (
                  <button
                    key={col}
                    onClick={() => handleColumnClick(col)}
                    className={`shrink-0 px-2 py-0.5 text-[10px] rounded transition-colors whitespace-nowrap ${
                      selectedColumn === col
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </ScrollArea>
            {lineageData.length > 0 && (
              <button
                onClick={handleSave}
                className="h-8 px-2 flex items-center gap-1 text-xs hover:bg-muted rounded transition-colors"
              >
                {saved ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saved ? "Saved" : "Save"}
              </button>
            )}
            <Tooltip content={t.exitFullscreen}>
              <button
                onClick={() => setIsGraphExpanded(false)}
                className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded transition-colors"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-50">
          <LineageGraph
            lineageData={lineageData}
            highlightedColumn={selectedColumn}
            onColumnClick={handleColumnClick}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            {t.dataLineage}
          </h3>
          <div className="flex items-center gap-1">
            <Tooltip content={t.dagView}>
              <button
                onClick={() => setViewMode("graph")}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                  viewMode === "graph"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            <Tooltip content={t.timelineView}>
              <button
                onClick={() => setViewMode("timeline")}
                className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                  viewMode === "timeline"
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
            {viewMode === "graph" && (
              <Tooltip content={t.fullscreen}>
                <button
                  onClick={() => setIsGraphExpanded(true)}
                  className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            )}
            {lineageData.length > 0 && (
              <Tooltip content={saved ? "Saved!" : "Save lineage"}>
                <button
                  onClick={handleSave}
                  className="h-6 w-6 flex items-center justify-center hover:bg-muted rounded transition-colors"
                >
                  {saved ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </button>
              </Tooltip>
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

      <div className="px-3 py-2 border-b border-border/50 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            placeholder={t.searchColumns}
            className="w-full h-8 pl-7 pr-2 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <ScrollArea className="h-[120px] mt-2">
          {filteredColumns.map((col) => (
            <button
              key={col}
              onClick={() => handleColumnClick(col)}
              className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                selectedColumn === col
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted"
              }`}
            >
              {col}
            </button>
          ))}
        </ScrollArea>
      </div>

      <div className="flex-1 min-h-0">
        {lineageData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            {t.noLineageData}
          </div>
        ) : viewMode === "graph" ? (
          <div className="h-full bg-white dark:bg-slate-50">
            <LineageGraph
              lineageData={lineageData}
              highlightedColumn={selectedColumn}
              onColumnClick={handleColumnClick}
            />
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {selectedColumn && (
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  {t.lineageForColumn}{" "}
                  <span className="text-primary">{selectedColumn}</span>
                </div>
              )}
              {(selectedColumn
                ? onGetLineageForColumn(selectedColumn)
                : lineageData
              ).map((step) => (
                <div
                  key={step.stepId}
                  className="p-3 border rounded-md cursor-pointer transition-all hover:bg-accent/30"
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
                      {step.inputRowCount} → {step.outputRowCount} {t.rowsCount}
                    </span>
                  </div>

                  {expandedSteps.has(step.stepId) && (
                    <div className="mt-2 space-y-2">
                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          {t.inputColumns}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {step.inputSchema.map((col) => (
                            <button
                              key={col.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleColumnClick(col.name);
                              }}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors hover:opacity-80 ${
                                selectedColumn === col.name
                                  ? "ring-1 ring-primary"
                                  : ""
                              } ${TYPE_COLORS[col.type]}`}
                            >
                              {col.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-center">
                        <ArrowDown className="h-3 w-3 text-muted-foreground" />
                      </div>

                      <div>
                        <div className="text-[10px] font-medium text-muted-foreground mb-1">
                          {t.outputColumns}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {step.outputSchema.map((col) => (
                            <button
                              key={col.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleColumnClick(col.name);
                              }}
                              className={`inline-flex items-center px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors hover:opacity-80 ${
                                selectedColumn === col.name
                                  ? "ring-1 ring-primary"
                                  : ""
                              } ${TYPE_COLORS[col.type]}`}
                            >
                              {col.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {step.transformations.length > 0 && (
                        <div>
                          <div className="text-[10px] font-medium text-muted-foreground mb-1">
                            {t.lineageTransformations}
                          </div>
                          <div className="space-y-1">
                            {step.transformations.map((tr, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1 text-[10px] text-muted-foreground"
                              >
                                {TRANSFORMATION_ICONS[tr.type]}
                                <span>{tr.description}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
