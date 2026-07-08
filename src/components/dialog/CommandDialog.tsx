import { useState, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";

export type CommandDialogType =
  | "search"
  | "bisect"
  | "filter"
  | "sort"
  | "select"
  | "view"
  | "count"
  | "slice"
  | "head"
  | "tail"
  | "sample"
  | "dedup"
  | "shuffle"
  | "frequency"
  | "groupby"
  | "stats"
  | "agg"
  | "bins"
  | "window"
  | "headers"
  | "flatten"
  | "hist"
  | "plot"
  | "drop"
  | "map"
  | "transform"
  | "enum"
  | "fill"
  | "complete"
  | "separate"
  | "top"
  | "cat"
  | "join"
  | "merge"
  | "rename"
  | "behead"
  | "fixlengths"
  | "explode"
  | "implode"
  | "input"
  | "scrape"
  | "fmt"
  | "to"
  | "from"
  | "reverse"
  | "transpose"
  | "pivot"
  | "unpivot"
  | "split"
  | "partition"
  | "range"
  | "run"
  | "eval"
  | "output";

export interface CommandDialogState {
  type: CommandDialogType;
  params: Record<string, any>;
  isUpdate?: boolean;
  stepId?: string;
}

interface CommandDialogProps {
  commandDialog: CommandDialogState;
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
}

export function CommandDialog({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
}: CommandDialogProps) {
  if (!commandDialog) return null;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setOffset({
        x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
        y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="absolute bg-card border rounded-xl shadow-xl w-full max-w-2xl p-4"
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: `calc(50% + ${offset.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between mb-2 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-semibold">
            {commandDialog.type === "search" && "Search"}
            {commandDialog.type === "bisect" && "Bisect"}
            {commandDialog.type === "filter" && "Filter"}
            {commandDialog.type === "sort" && "Sort"}
            {commandDialog.type === "select" && "Select"}
            {commandDialog.type === "view" && "View"}
            {commandDialog.type === "count" && "Count"}
            {commandDialog.type === "slice" && "Slice"}
            {commandDialog.type === "head" && "Head"}
            {commandDialog.type === "tail" && "Tail"}
            {commandDialog.type === "sample" && "Sample"}
            {commandDialog.type === "dedup" && "Dedup"}
            {commandDialog.type === "shuffle" && "Shuffle"}
            {commandDialog.type === "frequency" && "Frequency"}
            {commandDialog.type === "groupby" && "Group By"}
            {commandDialog.type === "stats" && "Stats"}
            {commandDialog.type === "agg" && "Agg"}
            {commandDialog.type === "bins" && "Bins"}
            {commandDialog.type === "window" && "Window"}
            {commandDialog.type === "headers" && "Headers"}
            {commandDialog.type === "flatten" && "Flatten"}
            {commandDialog.type === "hist" && "Hist"}
            {commandDialog.type === "plot" && "Plot"}
            {commandDialog.type === "drop" && "Drop"}
            {commandDialog.type === "map" && "Map"}
            {commandDialog.type === "transform" && "Transform"}
            {commandDialog.type === "enum" && "Enum"}
            {commandDialog.type === "fill" && "Fill"}
            {commandDialog.type === "complete" && "Complete"}
            {commandDialog.type === "separate" && "Separate"}
            {commandDialog.type === "top" && "Top"}
            {commandDialog.type === "cat" && "Cat"}
            {commandDialog.type === "join" && "Join"}
            {commandDialog.type === "merge" && "Merge"}
            {commandDialog.type === "rename" && "Rename"}
            {commandDialog.type === "behead" && "Behead"}
            {commandDialog.type === "fixlengths" && "Fix Lengths"}
            {commandDialog.type === "explode" && "Explode"}
            {commandDialog.type === "implode" && "Implode"}
            {commandDialog.type === "input" && "Input"}
            {commandDialog.type === "scrape" && "Scrape"}
            {commandDialog.type === "fmt" && "Format"}
            {commandDialog.type === "to" && "To"}
            {commandDialog.type === "from" && "From"}
            {commandDialog.type === "reverse" && "Reverse"}
            {commandDialog.type === "transpose" && "Transpose"}
            {commandDialog.type === "pivot" && "Pivot"}
            {commandDialog.type === "unpivot" && "Unpivot"}
            {commandDialog.type === "split" && "Split"}
            {commandDialog.type === "partition" && "Partition"}
            {commandDialog.type === "range" && "Range"}
            {commandDialog.type === "eval" && "Eval"}
            {commandDialog.type === "run" && "Run"}
            {commandDialog.type === "output" && "Output"}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandDialog(null)}
          >
            <X className="h-4 w-4 accent-foreground" />
          </Button>
        </div>

        {commandDialog.type === "search" && (
          <>
            <ScrollArea className="h-[28vh]">
              <div className="space-y-3 pr-2.5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">select</label>
                    <input
                      type="text"
                      value={commandDialog.params.select}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, select: e.target.value },
                        })}
                      placeholder="Select column"
                      className="w-full h-8 px-3 text-sm border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">pattern</label>
                    <input
                      type="text"
                      value={commandDialog.params.pattern}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, pattern: e.target.value },
                        })}
                      placeholder="Search condition"
                      className="w-full h-8 px-3 text-sm border rounded-md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["invert-match"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "invert-match": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    invert-match
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.exact}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, exact: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    exact
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.regex}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, regex: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    regex
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["url-prefix"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "url-prefix": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    url-prefix
                  </label>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["non-empty"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "non-empty": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    non-empty
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.empty}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, empty: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    empty
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["ignore-case"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "ignore-case": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    ignore-case
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, parallel: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    parallel
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["fast-parser"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "fast-parser": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    fast-parser
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["every-column"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "every-column": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    every-column
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.overlapping}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, overlapping: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    overlapping
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.left}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, left: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    left
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.breakdown}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, breakdown: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    breakdown
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div>
                    <label className="text-sm font-medium">flag-column</label>
                    <input
                      type="text"
                      value={commandDialog.params.flag || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, flag: e.target.value },
                        })}
                      placeholder="Column name to report match status"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">count</label>
                    <input
                      type="text"
                      value={commandDialog.params.count || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, count: e.target.value },
                        })}
                      placeholder="Column name to report match count"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">limit</label>
                    <input
                      type="number"
                      min={0}
                      value={commandDialog.params.limit || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, limit: e.target.value },
                        })}
                      placeholder="Maximum rows to return"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">threads</label>
                    <input
                      type="number"
                      min={0}
                      value={commandDialog.params.threads || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, threads: e.target.value },
                        })}
                      placeholder="Number of threads"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">levenshtein</label>
                    <input
                      type="number"
                      value={commandDialog.params.levenshtein || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, levenshtein: e.target.value },
                        })}
                      placeholder="Levenshtein distance"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">damerau-levenshtein</label>
                    <input
                      type="number"
                      value={commandDialog.params["damerau-levenshtein"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "damerau-levenshtein": e.target.value },
                        })}
                      placeholder="Damerau-Levenshtein distance"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <div>
                    <label className="text-sm font-medium">replace</label>
                    <input
                      type="text"
                      value={commandDialog.params.replace || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, replace: e.target.value },
                        })}
                      placeholder="Replacement string"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">add-pattern</label>
                    <input
                      type="text"
                      value={commandDialog.params["add-pattern"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "add-pattern": e.target.value },
                        })}
                      placeholder="Additional pattern"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">unique-matches</label>
                    <input
                      type="text"
                      value={commandDialog.params["unique-matches"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "unique-matches": e.target.value },
                        })}
                      placeholder="Column name for unique matches"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">sep</label>
                    <input
                      type="text"
                      value={commandDialog.params.sep || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, sep: e.target.value },
                        })}
                      placeholder="Separator for unique matches"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">patterns</label>
                  <input
                    type="text"
                    value={commandDialog.params.patterns || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, patterns: e.target.value },
                      })}
                    placeholder="Path to a text file"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">pattern-column</label>
                    <input
                      type="text"
                      value={commandDialog.params["pattern-column"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "pattern-column": e.target.value },
                        })}
                      placeholder="Column with patterns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">replacement-column</label>
                    <input
                      type="text"
                      value={commandDialog.params["replacement-column"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "replacement-column": e.target.value },
                        })}
                      placeholder="Column with replacements"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">name-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["name-column"] || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, "name-column": e.target.value },
                      })}
                    placeholder="Column with pattern names"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const searchCmd = xanCommands.find(
                      (c) => c.id === "search",
                    );
                    if (searchCmd) {
                      const params = {
                        ...searchCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(searchCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={
                  !commandDialog.params.pattern &&
                  !commandDialog.params["non-empty"] &&
                  !commandDialog.params.empty
                }
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "bisect" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column</label>
                <input
                  type="text"
                  value={commandDialog.params.column || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                  placeholder="Column name"
                  className="w-full h-8 px-3 text-sm border rounded-md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">value</label>
                <input
                  type="text"
                  value={commandDialog.params.value || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, value: e.target.value },
                    })}
                  placeholder="Value to search for"
                  className="w-full h-8 px-3 text-sm border rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.search}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, search: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                search
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, reverse: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.numeric}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, numeric: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                numeric
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.exclude}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, exclude: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                exclude
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.verbose}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, verbose: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                verbose
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const bisectCmd = xanCommands.find(
                      (c) => c.id === "bisect",
                    );
                    if (bisectCmd) {
                      const params = {
                        ...bisectCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(bisectCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.column || !commandDialog.params.value}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "filter" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">expression</label>
              <input
                type="text"
                value={commandDialog.params.expression}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expression: e.target.value },
                  })}
                placeholder="e.g. column_name > 100"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["invert-match"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "invert-match": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                invert-match
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                />
                parallel
              </label>
              <div className="flex">
                <input
                  type="number"
                  min={0}
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value },
                    })}
                  placeholder="Threads"
                  className="h-8 px-1 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="flex">
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.limit || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: e.target.value },
                    })}
                  placeholder="Maximum rows to return"
                  className="h-8 px-1 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const filterCmd = xanCommands.find(
                      (c) => c.id === "filter",
                    );
                    if (filterCmd) {
                      const params = {
                        ...filterCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(filterCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.expression}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "sort" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">select</label>
                <input
                  type="text"
                  value={commandDialog.params.select ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value },
                    })}
                  placeholder="Select columns"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">count</label>
                <input
                  type="text"
                  value={commandDialog.params.count ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, count: e.target.value },
                    })}
                  placeholder="Number of times the line was consecutively duplicated"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">memory-limit</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params["memory-limit"] ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "memory-limit": e.target.value },
                    })}
                  placeholder="Max memory for external sorting (MB)"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, reverse: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.numeric ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, numeric: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                numeric
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.check ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, check: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.uniq ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, uniq: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                uniq
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.external ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, external: e.target.checked },
                    })}
                />
                external
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.columns ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                columns
              </label>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.cells ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cells: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                cells
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">tmp-dir</label>
              <input
                type="text"
                value={commandDialog.params["tmp-dir"] ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "tmp-dir": e.target.value },
                  })}
                placeholder="Directory where external sorting chunks will be written"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const sortCmd = xanCommands.find((c) => c.id === "sort");
                    if (sortCmd) {
                      const params = {
                        ...sortCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(sortCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.select}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "select" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">selection</label>
              <input
                type="text"
                value={commandDialog.params.selection}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, selection: e.target.value },
                  })}
                placeholder="e.g. column1,column2 or 0:4"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.evaluate}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, evaluate: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                evaluate
              </label>
            </div>
            <div>
              <label className="text-sm font-medium">evaluate-file</label>
              <input
                type="text"
                value={commandDialog.params["evaluate-file"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "evaluate-file": e.target.value },
                  })}
                placeholder="Read evaluation expression from a file instead"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const selectCmd = xanCommands.find(
                      (c) => c.id === "select",
                    );
                    if (selectCmd) {
                      const params = {
                        ...selectCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(selectCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.selection}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "view" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">theme</label>
              <SearchableSelect
                value={commandDialog.params.theme || "borderless"}
                onChange={(value) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, theme: value },
                  })}
                options={[
                  { label: "table", value: "table" },
                  { label: "borderless", value: "borderless" },
                  { label: "compact", value: "compact" },
                  { label: "rounded", value: "rounded" },
                  { label: "slim", value: "slim" },
                  { label: "striped", value: "striped" },
                ]}
                placeholder="Select theme..."
                size="md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">limit</label>
              <input
                type="number"
                min={1}
                value={commandDialog.params.limit || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, limit: e.target.value },
                  })}
                placeholder="Number of rows to display"
                className="w-full h-8 px-3 text-sm border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })}
                placeholder="Select the columns to visualize, leave empty to show all columns"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="view-all"
                  checked={commandDialog.params.all || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        all: e.target.checked,
                        limit: e.target.checked ? 0 : commandDialog.params.limit || 10,
                      },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                <label htmlFor="view-all" className="text-sm cursor-pointer">
                  all
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="view-expand"
                  checked={commandDialog.params.expand || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, expand: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                <label htmlFor="view-expand" className="text-sm cursor-pointer">
                  expand
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="view-hide-info"
                  checked={commandDialog.params["hide-info"] || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "hide-info": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                <label htmlFor="view-hide-info" className="text-sm cursor-pointer">
                  hide-info
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const viewCmd = xanCommands.find((c) => c.id === "view");
                    if (viewCmd) {
                      const params = {
                        ...viewCmd.parameters.reduce(
                          (acc, param) => {
                            if (param.default !== undefined) {
                              acc[param.name] = param.default;
                            }
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                        theme: commandDialog.params.theme || "borderless",
                      };
                      onAddCommand(viewCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "count" && (
          <div className="space-y-3">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
              <input
                type="number"
                min={0}
                value={commandDialog.params.threads}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, threads: e.target.value },
                  })}
                placeholder="Number of threads"
                className="h-8 px-3 text-sm border rounded-md bg-background"
              />
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, approx: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                approx
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const countCmd = xanCommands.find((c) => c.id === "count");
                    if (countCmd) {
                      const params = {
                        ...countCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(countCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "slice" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">start</label>
                <input
                  type="number"
                  value={commandDialog.params.start || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, start: e.target.value },
                    })}
                  placeholder="Start index"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">end</label>
                <input
                  type="number"
                  value={commandDialog.params.end || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, end: e.target.value },
                    })}
                  placeholder="End index"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">len</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.len || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, len: e.target.value },
                    })}
                  placeholder="Length"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const sliceCmd = xanCommands.find((c) => c.id === "slice");
                    if (sliceCmd) {
                      const params = {
                        ...sliceCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(sliceCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "head" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">limit</label>
              <input
                type="number"
                min={1}
                value={commandDialog.params.limit || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, limit: e.target.value },
                  })}
                placeholder="Number of rows to return"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const headCmd = xanCommands.find((c) => c.id === "head");
                    if (headCmd) {
                      const params = {
                        ...headCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(headCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "tail" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">limit</label>
              <input
                type="number"
                min={1}
                value={commandDialog.params.limit || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, limit: e.target.value },
                  })}
                placeholder="Number of rows to return"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const tailCmd = xanCommands.find((c) => c.id === "tail");
                    if (tailCmd) {
                      const params = {
                        ...tailCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(tailCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "sample" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">sample-size</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params["sample-size"] ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "sample-size": e.target.value },
                    })}
                  placeholder="Number of rows to sample"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">seed</label>
                <input
                  type="number"
                  value={commandDialog.params.seed ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, seed: e.target.value },
                    })}
                  placeholder="RNG seed"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">weight</label>
                <input
                  type="text"
                  value={commandDialog.params.weight ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, weight: e.target.value },
                    })}
                  placeholder="Column containing weights to bias the sample"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">groupby</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })}
                  placeholder="Return a sample per group"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.cursed ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cursed: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                cursed
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const sampleCmd = xanCommands.find(
                      (c) => c.id === "sample",
                    );
                    if (sampleCmd) {
                      const params = {
                        ...sampleCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(sampleCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "dedup" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })}
                placeholder="Column(s) to deduplicate on"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.check}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, check: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sorted: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.external}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, external: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                external
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["keep-last"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "keep-last": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                keep-last
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["keep-duplicates"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "keep-duplicates": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                keep-duplicates
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">choose</label>
                <input
                  type="text"
                  value={commandDialog.params.choose || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, choose: e.target.value },
                    })}
                  placeholder="Expression to decide whether to keep a row (current_*, new_*)"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">flag</label>
                <input
                  type="text"
                  value={commandDialog.params.flag || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, flag: e.target.value },
                    })}
                  placeholder="Add column with this name to flag duplicates"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const dedupCmd = xanCommands.find((c) => c.id === "dedup");
                    if (dedupCmd) {
                      const params = {
                        ...dedupCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(dedupCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "shuffle" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">seed</label>
              <input
                type="number"
                value={commandDialog.params.seed || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, seed: e.target.value },
                  })}
                placeholder="RNG seed"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.external}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, external: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                external
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const shuffleCmd = xanCommands.find(
                      (c) => c.id === "shuffle",
                    );
                    if (shuffleCmd) {
                      const params = {
                        ...shuffleCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(shuffleCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "frequency" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">select</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value },
                    })}
                  placeholder="Column(s) to compute frequencies"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">sep</label>
                <input
                  type="text"
                  value={commandDialog.params.sep || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })}
                  placeholder="Split cells by separator"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">groupby</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })}
                  placeholder="Compute frequencies per group"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">limit</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.limit || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: e.target.value },
                    })}
                  placeholder="Top N items"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.all}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, all: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                all
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, approx: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                approx
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["no-extra"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "no-extra": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                no-extra
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value },
                    })}
                  placeholder="Threads"
                  className="w-32 h-8 px-2 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const frequencyCmd = xanCommands.find(
                      (c) => c.id === "frequency",
                    );
                    if (frequencyCmd) {
                      const params = {
                        ...frequencyCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(frequencyCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "groupby" && (
          <>
            <ScrollArea className="h-[24vh]">
              <div className="space-y-3 pr-2.5">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.columns || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, columns: e.target.value },
                        })}
                      placeholder="Columns to group by"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">expression</label>
                    <input
                      type="text"
                      value={commandDialog.params.expression || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, expression: e.target.value },
                        })}
                      placeholder="Aggregation expression"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">keep</label>
                    <input
                      type="text"
                      value={commandDialog.params.keep || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, keep: e.target.value },
                        })}
                      placeholder="Keep these columns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">total</label>
                    <input
                      type="text"
                      value={commandDialog.params.total || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, total: e.target.value },
                        })}
                      placeholder="Aggregation over whole file"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">along-cols</label>
                    <input
                      type="text"
                      value={commandDialog.params["along-cols"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "along-cols": e.target.value },
                        })}
                      placeholder="Aggregate over columns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">along-matrix</label>
                    <input
                      type="text"
                      value={commandDialog.params["along-matrix"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "along-matrix": e.target.value },
                        })}
                      placeholder="Aggregate all values"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, sorted: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, parallel: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    parallel
                  </label>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={commandDialog.params.threads || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, threads: e.target.value },
                        })}
                      placeholder="Threads"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const groupbyCmd = xanCommands.find(
                      (c) => c.id === "groupby",
                    );
                    if (groupbyCmd) {
                      const params = {
                        ...groupbyCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(groupbyCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "stats" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">select</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value },
                    })}
                  placeholder="Column(s) to compute stats"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">groupby</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })}
                  placeholder="Group by column(s)"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-6 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.all}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, all: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                all
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.cardinality}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cardinality: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                cardinality
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.quartiles}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, quartiles: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                quartiles
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, approx: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                approx
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.nulls}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, nulls: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                nulls
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                value={commandDialog.params.threads || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, threads: e.target.value },
                  })}
                placeholder="Number of threads"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const statsCmd = xanCommands.find((c) => c.id === "stats");
                    if (statsCmd) {
                      const params = {
                        ...statsCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(statsCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "agg" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expression: e.target.value },
                  })}
                placeholder="Aggregation expression (e.g., sum:col1)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">along-rows</label>
                <input
                  type="text"
                  value={commandDialog.params["along-rows"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "along-rows": e.target.value },
                    })}
                  placeholder="Aggregate per row"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">along-cols</label>
                <input
                  type="text"
                  value={commandDialog.params["along-cols"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "along-cols": e.target.value },
                    })}
                  placeholder="Aggregate per column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">along-matrix</label>
              <input
                type="text"
                value={commandDialog.params["along-matrix"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "along-matrix": e.target.value },
                  })}
                placeholder="Aggregate all values"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
              <div className="flex-1">
                <input
                  type="number"
                  min={0}
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value },
                    })}
                  placeholder="Number of threads"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const aggCmd = xanCommands.find((c) => c.id === "agg");
                    if (aggCmd) {
                      const params = {
                        ...aggCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(aggCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "bins" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column</label>
                <input
                  type="text"
                  value={commandDialog.params.column || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                  placeholder="Column to bin"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">select</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value },
                    })}
                  placeholder="Subset of columns"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">bins</label>
                <input
                  type="number"
                  value={commandDialog.params.bins || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, bins: e.target.value },
                    })}
                  placeholder="Number of bins"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">heuristic</label>
                <SearchableSelect
                  value={commandDialog.params.heuristic || ""}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, heuristic: value },
                    })}
                  options={[
                    { label: "None", value: "" },
                    { label: "Freedman-Diaconis", value: "freedman-diaconis" },
                    { label: "Sqrt", value: "sqrt" },
                    { label: "Sturges", value: "sturges" },
                  ]}
                  placeholder="Select heuristic..."
                  size="md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">max-bins</label>
                <input
                  type="number"
                  value={commandDialog.params["max-bins"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "max-bins": e.target.value },
                    })}
                  placeholder="Maximum bins"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">label</label>
                <SearchableSelect
                  value={commandDialog.params.label || "full"}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, label: value },
                    })}
                  options={[
                    { label: "Full", value: "full" },
                    { label: "Lower", value: "lower" },
                    { label: "Upper", value: "upper" },
                  ]}
                  placeholder="Select label..."
                  size="md"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.exact}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, exact: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                exact
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["no-extra"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "no-extra": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                no-extra
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">min</label>
                <input
                  type="number"
                  value={commandDialog.params.min || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, min: e.target.value },
                    })}
                  placeholder="Override min value"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">max</label>
                <input
                  type="number"
                  value={commandDialog.params.max || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, max: e.target.value },
                    })}
                  placeholder="Override max value"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const binsCmd = xanCommands.find((c) => c.id === "bins");
                    if (binsCmd) {
                      const params = {
                        ...binsCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(binsCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "window" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">groupby (optional)</label>
              <input
                type="text"
                value={commandDialog.params.groupby || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, groupby: e.target.value },
                  })}
                placeholder="Reset aggregation on column(s)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expression: e.target.value },
                  })}
                placeholder="Window expression"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">along-columns (optional)</label>
              <input
                type="text"
                value={commandDialog.params["along-columns"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "along-columns": e.target.value },
                  })}
                placeholder="Repeat same expression over a selection of columns at once"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sorted: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.overwrite || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, overwrite: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                overwrite
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const windowCmd = xanCommands.find(
                      (c) => c.id === "window",
                    );
                    if (windowCmd) {
                      const params = {
                        ...windowCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(windowCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "headers" && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["just-names"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "just-names": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                just-names
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.csv}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, csv: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                csv
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const headersCmd = xanCommands.find(
                      (c) => c.id === "headers",
                    );
                    if (headersCmd) {
                      const params = {
                        ...headersCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(headersCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "flatten" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">select</label>
              <input
                type="text"
                value={commandDialog.params.select ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })}
                placeholder="Select the columns to visualize"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">limit</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.limit ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: parseInt(e.target.value) || undefined },
                    })}
                  placeholder="Maximum number of rows to read"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">row-separator</label>
                <input
                  type="text"
                  value={commandDialog.params["row-separator"] ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "row-separator": e.target.value },
                    })}
                  placeholder="Separate rows in the output with the given string"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">split</label>
                <input
                  type="text"
                  value={commandDialog.params.split ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, split: e.target.value },
                    })}
                  placeholder="Split columns containing multiple values separated by sep"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">sep</label>
                <input
                  type="text"
                  value={commandDialog.params.sep ?? "|"}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })}
                  placeholder="Delimiter separating multiple values in cells split by split"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.condense ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, condense: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                condense
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.wrap ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, wrap: e.target.checked },
                    })}
                />
                wrap
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.flatter ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, flatter: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                flatter
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.csv ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, csv: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                csv
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.rainbow ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rainbow: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                rainbow
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["non-empty"] ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "non-empty": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                non-empty
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["ignore-case"] ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "ignore-case": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                ignore-case
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const flattenCmd = xanCommands.find(
                      (c) => c.id === "flatten",
                    );
                    if (flattenCmd) {
                      const params = {
                        ...flattenCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(flattenCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "hist" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">bar-size</label>
              <SearchableSelect
                value={commandDialog.params["bar-size"] ?? "medium"}
                onChange={(value) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "bar-size": value },
                  })}
                options={[
                  { label: "small", value: "small" },
                  { label: "medium", value: "medium" },
                  { label: "large", value: "large" },
                ]}
                placeholder="Select bar size..."
                size="md"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">name</label>
                <input
                  type="text"
                  value={commandDialog.params.name ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, name: e.target.value },
                    })}
                  placeholder="Name of the represented field"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">field</label>
                <input
                  type="text"
                  value={commandDialog.params.field ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, field: e.target.value },
                    })}
                  placeholder="Name of the field column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">label</label>
                <input
                  type="text"
                  value={commandDialog.params.label ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, label: e.target.value },
                    })}
                  placeholder="Name of the label column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">value</label>
                <input
                  type="text"
                  value={commandDialog.params.value ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, value: e.target.value },
                    })}
                  placeholder="Name of the count column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.rainbow ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rainbow: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                rainbow
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.dates ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, dates: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                dates
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["hide-percent"] ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "hide-percent": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                hide-percent
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const histCmd = xanCommands.find((c) => c.id === "hist");
                    if (histCmd) {
                      const params = {
                        ...histCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(histCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "plot" && (
          <>
            <ScrollArea className="h-[30vh]">
              <div className="space-y-3 pr-2.5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">x column</label>
                    <input
                      type="text"
                      value={commandDialog.params.x ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, x: e.target.value },
                        })}
                      placeholder="X axis column"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">y column</label>
                    <input
                      type="text"
                      value={commandDialog.params.y ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, y: e.target.value },
                        })}
                      placeholder="Y axis column (optional if --count)"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">category</label>
                    <input
                      type="text"
                      value={commandDialog.params.category ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, category: e.target.value },
                        })}
                      placeholder="Categorical column for series"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">aggregate</label>
                    <SearchableSelect
                      value={commandDialog.params.aggregate ?? ""}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, aggregate: value },
                        })}
                      options={[
                        { label: "sum", value: "sum" },
                        { label: "mean", value: "mean" },
                      ]}
                      placeholder="Select aggregate mode..."
                      size="md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">marker</label>
                    <SearchableSelect
                      value={commandDialog.params.marker ?? "braille"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, marker: value },
                        })}
                      options={[
                        { label: "braille", value: "braille" },
                        { label: "dot", value: "dot" },
                        { label: "halfblock", value: "halfblock" },
                        { label: "bar", value: "bar" },
                        { label: "block", value: "block" },
                      ]}
                      placeholder="Select marker..."
                      size="md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">granularity</label>
                    <SearchableSelect
                      value={commandDialog.params.granularity ?? ""}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, granularity: value },
                        })}
                      options={[
                        { label: "years", value: "years" },
                        { label: "months", value: "months" },
                        { label: "days", value: "days" },
                        { label: "hours", value: "hours" },
                        { label: "minutes", value: "minutes" },
                        { label: "seconds", value: "seconds" },
                      ]}
                      placeholder="Select granularity..."
                      size="md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">x-scale</label>
                    <SearchableSelect
                      value={commandDialog.params["x-scale"] ?? "lin"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "x-scale": value },
                        })}
                      options={[
                        { label: "lin", value: "lin" },
                        { label: "pow", value: "pow" },
                        { label: "sqrt", value: "sqrt" },
                        { label: "log", value: "log" },
                        { label: "log2", value: "log2" },
                        { label: "log10", value: "log10" },
                      ]}
                      placeholder="Select x scale..."
                      size="md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">y-scale</label>
                    <SearchableSelect
                      value={commandDialog.params["y-scale"] ?? "lin"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "y-scale": value },
                        })}
                      options={[
                        { label: "lin", value: "lin" },
                        { label: "pow", value: "pow" },
                        { label: "sqrt", value: "sqrt" },
                        { label: "log", value: "log" },
                        { label: "log2", value: "log2" },
                        { label: "log10", value: "log10" },
                      ]}
                      placeholder="Select y scale..."
                      size="md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium">x-min</label>
                    <input
                      type="number"
                      value={commandDialog.params["x-min"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "x-min": e.target.value },
                        })}
                      placeholder="Min x value"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">x-max</label>
                    <input
                      type="number"
                      value={commandDialog.params["x-max"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "x-max": e.target.value },
                        })}
                      placeholder="Max x value"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">y-min</label>
                    <input
                      type="number"
                      value={commandDialog.params["y-min"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "y-min": e.target.value },
                        })}
                      placeholder="Min y value"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">y-max</label>
                    <input
                      type="number"
                      value={commandDialog.params["y-max"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "y-max": e.target.value },
                        })}
                      placeholder="Max y value"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">x-ticks</label>
                    <input
                      type="number"
                      value={commandDialog.params["x-ticks"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "x-ticks": e.target.value },
                        })}
                      placeholder="Number of x-axis ticks"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">y-ticks</label>
                    <input
                      type="number"
                      value={commandDialog.params["y-ticks"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "y-ticks": e.target.value },
                        })}
                      placeholder="Number of y-axis ticks"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">density-gradient</label>
                    <input
                      type="text"
                      value={commandDialog.params["density-gradient"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "density-gradient": e.target.value },
                        })}
                      placeholder="Color gradient name"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">density-scale</label>
                    <SearchableSelect
                      value={commandDialog.params["density-scale"] ?? "log"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "density-scale": value },
                        })}
                      options={[
                        { label: "lin", value: "lin" },
                        { label: "pow", value: "pow" },
                        { label: "sqrt", value: "sqrt" },
                        { label: "log", value: "log" },
                        { label: "log2", value: "log2" },
                        { label: "log10", value: "log10" },
                      ]}
                      placeholder="Select density scale..."
                      size="md"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">small-multiples</label>
                    <input
                      type="number"
                      value={commandDialog.params["small-multiples"] ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "small-multiples": e.target.value },
                        })}
                      placeholder="Number of grid columns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">timezone</label>
                    <input
                      type="text"
                      value={commandDialog.params.timezone ?? ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, timezone: e.target.value },
                        })}
                      placeholder="Timezone for time series"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.line ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, line: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    line
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.time ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, time: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    time
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.count ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, count: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    count
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["regression-line"] ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "regression-line": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    regression-line
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.grid ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, grid: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    grid
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.square ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, square: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    square
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.ignore ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, ignore: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    ignore
                  </label>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["hide-legend"] ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "hide-legend": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    hide-legend
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["hide-x-axis"] ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "hide-x-axis": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    hide-x-axis
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["hide-y-axis"] ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "hide-y-axis": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    hide-y-axis
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["hide-all"] ?? false}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "hide-all": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    hide-all
                  </label>
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const plotCmd = xanCommands.find((c) => c.id === "plot");
                    if (plotCmd) {
                      const params = {
                        ...plotCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(plotCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "drop" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">selection</label>
              <input
                type="text"
                value={commandDialog.params.selection || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, selection: e.target.value },
                  })}
                placeholder="Columns to drop (comma-separated)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const dropCmd = xanCommands.find((c) => c.id === "drop");
                    if (dropCmd) {
                      const params = {
                        ...dropCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(dropCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "map" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">expression</label>
              <ExpressionEditor
                value={commandDialog.params.expression || ""}
                onChange={(value) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expression: value },
                  })}
                columns={headers}
                placeholder="Expression to evaluate (e.g., split(name, '.') | first | upper)"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.overwrite}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, overwrite: e.target.checked },
                    })
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                overwrite
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.filter}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, filter: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                filter
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                parallel
              </label>
              <input
                type="number"
                min={0}
                value={commandDialog.params.threads || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, threads: parseInt(e.target.value) || undefined },
                  })}
                placeholder="Number of threads"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const mapCmd = xanCommands.find((c) => c.id === "map");
                    if (mapCmd) {
                      const params = {
                        ...mapCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(mapCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "transform" && (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">column</label>
                  <input
                    type="text"
                    value={commandDialog.params.column || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                    placeholder="Column to transform"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    autoFocus />
                </div>
                <div>
                  <label className="text-sm font-medium">rename</label>
                  <input
                    type="text"
                    value={commandDialog.params.rename || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rename: e.target.value },
                    })}
                    placeholder="New name for the column"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">expression</label>
                <input
                  type="text"
                  value={commandDialog.params.expression || ""}
                  onChange={(e) => setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expression: e.target.value },
                  })}
                  placeholder="Expression to evaluate"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
              </div>
              <div>
                <label className="text-sm font-medium">evaluate-file</label>
                <input
                  type="text"
                  value={commandDialog.params["evaluate-file"] || ""}
                  onChange={(e) => setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "evaluate-file": e.target.value },
                  })}
                  placeholder="Read expression from file"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) => setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, parallel: e.target.checked },
                      })}
                      className="h-3.5 w-3.5 accent-foreground" />
                    parallel
                  </label>
                </div>
                <div>
                  <input
                    type="number"
                    min={0}
                    value={commandDialog.params.threads || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value },
                    })}
                    placeholder="Threads"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
            </div><div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const transformCmd = xanCommands.find(
                      (c) => c.id === "transform"
                    );
                    if (transformCmd) {
                      const params = {
                        ...transformCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(transformCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "enum" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column-name</label>
                <input
                  type="text"
                  value={commandDialog.params["column-name"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "column-name": e.target.value },
                    })}
                  placeholder="Name of the column to prepend"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">start</label>
                <input
                  type="number"
                  value={commandDialog.params.start || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, start: e.target.value },
                    })}
                  placeholder="Number to count from"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["byte-offset"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "byte-offset": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                Byte Offset
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.accumulate}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, accumulate: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                accumulate
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const enumCmd = xanCommands.find((c) => c.id === "enum");
                    if (enumCmd) {
                      const params = {
                        ...enumCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(enumCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "fill" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })}
                placeholder="Selection of columns to fill"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">value</label>
              <input
                type="text"
                value={commandDialog.params.value || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, value: e.target.value },
                  })}
                placeholder="Fill empty cells using provided value"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const fillCmd = xanCommands.find((c) => c.id === "fill");
                    if (fillCmd) {
                      const params = {
                        ...fillCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(fillCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "complete" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column</label>
                <input
                  type="text"
                  value={commandDialog.params.column || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                  placeholder="Column to complete"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">groupby</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })}
                  placeholder="Columns to group by"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.check}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, check: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.dates}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, dates: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                dates
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sorted: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, reverse: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                reverse
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">min</label>
                <input
                  type="text"
                  value={commandDialog.params.min || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, min: e.target.value },
                    })}
                  placeholder="Minimum value of range"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">max</label>
                <input
                  type="text"
                  value={commandDialog.params.max || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, max: e.target.value },
                    })}
                  placeholder="Maximum value of range"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const completeCmd = xanCommands.find(
                      (c) => c.id === "complete",
                    );
                    if (completeCmd) {
                      const params = {
                        ...completeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(completeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "separate" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column</label>
                <input
                  type="text"
                  value={commandDialog.params.column || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                  placeholder="Column to split"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">separator</label>
                <input
                  type="text"
                  value={commandDialog.params.separator || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, separator: e.target.value },
                    })}
                  placeholder="Separator to use"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.regex}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, regex: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                regex
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.match}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, match: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                match
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.captures}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, captures: e.target.checked },
                    })
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                captures
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["all-captures"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "all-captures": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                all-captures
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["fixed-width"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "fixed-width": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                fixed-width
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.keep}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, keep: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                keep
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.trim}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, trim: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                trim
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">widths</label>
                <input
                  type="text"
                  value={commandDialog.params.widths || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, widths: e.target.value },
                    })}
                  placeholder="Comma-separated widths"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">cuts</label>
                <input
                  type="text"
                  value={commandDialog.params.cuts || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cuts: e.target.value },
                    })}
                  placeholder="Comma-separated cuts"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">offsets</label>
                <input
                  type="text"
                  value={commandDialog.params.offsets || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, offsets: e.target.value },
                    })}
                  placeholder="Comma-separated offsets"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">max</label>
                <input
                  type="number"
                  value={commandDialog.params.max || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, max: e.target.value },
                    })}
                  placeholder="Maximum splits"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">too-many</label>
                <SearchableSelect
                  value={commandDialog.params["too-many"] || "error"}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "too-many": value },
                    })}
                  options={[
                    { label: "error", value: "error" },
                    { label: "drop", value: "drop" },
                    { label: "merge", value: "merge" },
                  ]}
                  placeholder="Select too-many..."
                  size="md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">into</label>
                <input
                  type="text"
                  value={commandDialog.params.into || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, into: e.target.value },
                    })}
                  placeholder="Column names (comma-separated)"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">prefix</label>
                <input
                  type="text"
                  value={commandDialog.params.prefix || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, prefix: e.target.value },
                    })}
                  placeholder="Column prefix"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const separateCmd = xanCommands.find(
                      (c) => c.id === "separate",
                    );
                    if (separateCmd) {
                      const params = {
                        ...separateCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(separateCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "top" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">column</label>
                <input
                  type="text"
                  value={commandDialog.params.column ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })}
                  placeholder="Column to top"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium">limit</label>
                <input
                  type="number"
                  value={commandDialog.params.limit ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, limit: e.target.value },
                    })}
                  placeholder="Number of rows to return"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">groupby</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })}
                  placeholder="Return top n values per group"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">rank</label>
                <input
                  type="text"
                  value={commandDialog.params.rank ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rank: e.target.value },
                    })}
                  placeholder="Name of a rank column to prepend"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, reverse: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.lexicographic ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, lexicographic: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                Lexicographic
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.ties ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, ties: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                ties
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const topCmd = xanCommands.find((c) => c.id === "top");
                    if (topCmd) {
                      const params = {
                        ...topCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(topCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "cat" && (
          <>
            <ScrollArea className="h-[28vh]">
              <div className="space-y-3 pr-2.5">
                <div>
                  <label className="text-sm font-medium">Mode</label>
                  <SearchableSelect
                    value={commandDialog.params.mode || "rows"}
                    onChange={(value) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, mode: value },
                      })}
                    options={[
                      { label: "rows", value: "rows" },
                      { label: "columns", value: "columns" },
                    ]}
                    placeholder="Select mode..."
                    size="md"
                  />
                </div>
                {commandDialog.params.mode === "rows" && (
                  <>
                    <div>
                      <label className="text-sm font-medium">paths</label>
                      <input
                        type="text"
                        value={commandDialog.params.paths || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, paths: e.target.value },
                          })}
                        placeholder="Text file containing paths to CSV files"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">path-column</label>
                      <input
                        type="text"
                        value={commandDialog.params["path-column"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "path-column": e.target.value },
                          })}
                        placeholder="Extract paths from this column"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">glob</label>
                      <input
                        type="text"
                        value={commandDialog.params.glob || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, glob: e.target.value },
                          })}
                        placeholder="Glob pattern to collect files"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">source-column</label>
                      <input
                        type="text"
                        value={commandDialog.params["source-column"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "source-column": e.target.value },
                          })}
                        placeholder="Name of source file column"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">preprocess</label>
                      <input
                        type="text"
                        value={commandDialog.params.preprocess || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, preprocess: e.target.value },
                          })}
                        placeholder="Xan subcommands for preprocessing"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">run</label>
                      <input
                        type="text"
                        value={commandDialog.params.run || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, run: e.target.value },
                          })}
                        placeholder="Path to xan script for preprocessing"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">shell-preprocess</label>
                      <input
                        type="text"
                        value={commandDialog.params["shell-preprocess"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "shell-preprocess": e.target.value },
                          })}
                        placeholder="Shell commands for preprocessing"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params.raw}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, raw: e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        raw
                      </label>
                    </div>
                  </>
                )}
                {commandDialog.params.mode === "columns" && (
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params.pad}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, pad: e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      pad
                    </label>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const catCmd = xanCommands.find((c) => c.id === "cat");
                    if (catCmd) {
                      const params = {
                        ...catCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(catCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "join" && (
          <>
            <ScrollArea className="h-[30vh]">
              <div className="space-y-3 pr-2.5">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="text-sm font-medium">columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.columns || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, columns: e.target.value },
                        })}
                      placeholder="Columns 1"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-sm font-medium">input 1</label>
                    <input
                      type="text"
                      value={commandDialog.params.input1 || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, input1: e.target.value },
                        })}
                      placeholder="First input file path"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="text-sm font-medium">columns 2</label>
                    <input
                      type="text"
                      value={commandDialog.params.columns2 || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, columns2: e.target.value },
                        })}
                      placeholder="Columns 2"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-sm font-medium">input 2</label>
                    <input
                      type="text"
                      value={commandDialog.params.input2 || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, input2: e.target.value },
                        })}
                      placeholder="Second input file path"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">join-type</label>
                    <SearchableSelect
                      value={commandDialog.params["join-type"] || "inner"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "join-type": value },
                        })}
                      options={[
                        { label: "Inner", value: "inner" },
                        { label: "Left", value: "left" },
                        { label: "Right", value: "right" },
                        { label: "Full", value: "full" },
                        { label: "Semi", value: "semi" },
                        { label: "Anti", value: "anti" },
                        { label: "Cross", value: "cross" },
                        { label: "Fuzzy", value: "fuzzy" },
                      ]}
                      placeholder="Select join type..."
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">drop-key</label>
                    <SearchableSelect
                      value={commandDialog.params["drop-key"] || "none"}
                      onChange={(value) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "drop-key": value },
                        })}
                      options={[
                        { label: "Left", value: "left" },
                        { label: "Right", value: "right" },
                        { label: "None", value: "none" },
                        { label: "Both", value: "both" },
                      ]}
                      placeholder="Select drop key..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">prefix-left</label>
                    <input
                      type="text"
                      value={commandDialog.params["prefix-left"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "prefix-left": e.target.value },
                        })}
                      placeholder="Prefix for left columns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">prefix-right</label>
                    <input
                      type="text"
                      value={commandDialog.params["prefix-right"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "prefix-right": e.target.value },
                        })}
                      placeholder="Prefix for right columns"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params["ignore-case"]}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, "ignore-case": e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    ignore-case
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.nulls}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, nulls: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    nulls
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.sorted}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, sorted: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, reverse: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    reverse
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.numeric}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, numeric: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    numeric
                  </label>
                </div>
                {commandDialog.params["join-type"] === "fuzzy" && (
                  <>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params.contains}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, contains: e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        Contains
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params.regex}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, regex: e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        regex
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params["url-prefix"]}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, "url-prefix": e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        url-prefix
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params["simplified-urls"]}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, "simplified-urls": e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        simplified-urls
                      </label>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={commandDialog.params.parallel}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, parallel: e.target.checked },
                            })}
                          className="h-3.5 w-3.5 accent-foreground"
                        />
                        parallel
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">threads</label>
                        <input
                          type="number"
                          min={0}
                          value={commandDialog.params.threads || ""}
                          onChange={(e) =>
                            setCommandDialog({
                              ...commandDialog,
                              params: { ...commandDialog.params, threads: e.target.value },
                            })}
                          placeholder="Threads"
                          className="w-20 h-8 px-2 text-sm border rounded-md bg-background"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const joinCmd = xanCommands.find((c) => c.id === "join");
                    if (joinCmd) {
                      const params = {
                        ...joinCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(joinCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "merge" && (
          <>
            <ScrollArea className="h-[30vh]">
              <div className="space-y-3 pr-2.5">
                <div>
                  <label className="text-sm font-medium">inputs</label>
                  <input
                    type="text"
                    value={commandDialog.params.inputs || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, inputs: e.target.value },
                      })}
                    placeholder="Input files to merge"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">select</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, select: e.target.value },
                      })}
                    placeholder="Select a subset of columns to sort"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">paths</label>
                  <input
                    type="text"
                    value={commandDialog.params.paths || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, paths: e.target.value },
                      })}
                    placeholder="Text file containing paths"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">path-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["path-column"] || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, "path-column": e.target.value },
                      })}
                    placeholder="Extract paths from this column"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">source-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["source-column"] || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, "source-column": e.target.value },
                      })}
                    placeholder="Name of source file column"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.numeric}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, numeric: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    Numeric
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.reverse}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, reverse: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    reverse
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.uniq}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, uniq: e.target.checked },
                        })}
                      className="h-3.5 w-3.5 accent-foreground"
                    />
                    uniq
                  </label>
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const mergeCmd = xanCommands.find((c) => c.id === "merge");
                    if (mergeCmd) {
                      const params = {
                        ...mergeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(mergeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "rename" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">select (optional)</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })}
                placeholder="Select the columns to rename (e.g. Company Name,Company ID)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, columns: e.target.value },
                  })}
                placeholder="New column name mapping (If select is empty, Columns must be all columns)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">prefix</label>
                <input
                  type="text"
                  value={commandDialog.params.prefix || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, prefix: e.target.value },
                    })}
                  placeholder="Prefix to add to all column names"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">suffix</label>
                <input
                  type="text"
                  value={commandDialog.params.suffix || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, suffix: e.target.value },
                    })}
                  placeholder="Suffix to add to all column names"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.slugify}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, slugify: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                Slugify
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.replace}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, replace: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                Replace
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.force}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, force: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                force
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const renameCmd = xanCommands.find(
                      (c) => c.id === "rename",
                    );
                    if (renameCmd) {
                      const params = {
                        ...renameCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(renameCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "behead" && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.append}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, append: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                append
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const beheadCmd = xanCommands.find(
                      (c) => c.id === "behead",
                    );
                    if (beheadCmd) {
                      const params = {
                        ...beheadCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(beheadCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "fixlengths" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">length</label>
              <input
                type="number"
                value={commandDialog.params.length || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, length: e.target.value },
                  })}
                placeholder="Forcefully set the length of each record"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["trust-header"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "trust-header": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                trust-header
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const fixlengthsCmd = xanCommands.find(
                      (c) => c.id === "fixlengths",
                    );
                    if (fixlengthsCmd) {
                      const params = {
                        ...fixlengthsCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(fixlengthsCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "explode" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">columns</label>
                <input
                  type="text"
                  value={commandDialog.params.columns || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value },
                    })}
                  placeholder="Columns to explode"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">sep</label>
                <input
                  type="text"
                  value={commandDialog.params.sep || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })}
                  placeholder="Separator to split the cells"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">evaluate-file</label>
              <input
                type="text"
                value={commandDialog.params["evaluate-file"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "evaluate-file": e.target.value },
                  })}
                placeholder="Read splitting expression from a file instead"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">evaluate</label>
                <input
                  type="text"
                  value={commandDialog.params.evaluate || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, evaluate: e.target.value },
                    })}
                  placeholder="Evaluate an expression to split cells instead of using a simple separator"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">rename</label>
                <input
                  type="text"
                  value={commandDialog.params.rename || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rename: e.target.value },
                    })}
                  placeholder="New names for the exploded columns"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.singularize}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, singularize: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                singularize
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.keep}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, keep: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                keep
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["drop-empty"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "drop-empty": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                drop-empty
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.pad}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, pad: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                pad
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const explodeCmd = xanCommands.find(
                      (c) => c.id === "explode",
                    );
                    if (explodeCmd) {
                      const params = {
                        ...explodeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(explodeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "implode" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">columns</label>
                <input
                  type="text"
                  value={commandDialog.params.columns || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, columns: e.target.value },
                    })}
                  placeholder="Columns to implode"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">sep</label>
                <input
                  type="text"
                  value={commandDialog.params.sep || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })}
                  placeholder="Separator for joining cells"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">rename</label>
                <input
                  type="text"
                  value={commandDialog.params.rename || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rename: e.target.value },
                    })}
                  placeholder="New name for the diverging column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">cmp</label>
                <input
                  type="text"
                  value={commandDialog.params.cmp || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cmp: e.target.value },
                    })}
                  placeholder="Columns to compare for merging"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.pluralize}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, pluralize: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                pluralize
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const implodeCmd = xanCommands.find(
                      (c) => c.id === "implode",
                    );
                    if (implodeCmd) {
                      const params = {
                        ...implodeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(implodeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.columns}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "input" && (
          <>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-sm font-medium">quote</label>
                  <input
                    type="text"
                    value={commandDialog.params.quote || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, quote: e.target.value },
                    })}
                    placeholder="Quote character"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">escape</label>
                  <input
                    type="text"
                    value={commandDialog.params.escape || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, escape: e.target.value },
                    })}
                    placeholder="Escape character"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">comment</label>
                  <input
                    type="text"
                    value={commandDialog.params.comment || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, comment: e.target.value },
                    })}
                    placeholder="Skip records starting with this character"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-sm font-medium">skip-lines</label>
                  <input
                    type="number"
                    min={0}
                    value={commandDialog.params["skip-lines"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "skip-lines": e.target.value },
                    })}
                    placeholder="Skip the first n lines"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">skip-until</label>
                  <input
                    type="text"
                    value={commandDialog.params["skip-until"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "skip-until": e.target.value },
                    })}
                    placeholder="Skip lines until matches"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">skip-while</label>
                  <input
                    type="text"
                    value={commandDialog.params["skip-while"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "skip-while": e.target.value },
                    })}
                    placeholder="Skip lines while matches"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.tabs}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, tabs: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  tabs
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["no-quoting"]}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "no-quoting": e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  no-quoting
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.trim}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, trim: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  trim
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.tolerant}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, tolerant: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  tolerant
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.gzip}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, gzip: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .gz
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.zstd}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, zstd: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .zst
                </label>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.vcf}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, vcf: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .vcf
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.gtf}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, gtf: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .gtf
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.gff}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, gff: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .gff
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.sam}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sam: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .sam
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.bed}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, bed: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .bed
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.cdx}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, cdx: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  .cdx
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const inputCmd = xanCommands.find(
                      (c) => c.id === "input"
                    );
                    if (inputCmd) {
                      const params = {
                        ...inputCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(inputCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "scrape" && (
          <><ScrollArea className="h-[30vh]">
            <div className="space-y-3 pr-2.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">evaluate</label>
                  <input
                    type="text"
                    value={commandDialog.params.evaluate || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, evaluate: e.target.value },
                    })}
                    placeholder="Scraping expression"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">evaluate-file</label>
                  <input
                    type="text"
                    value={commandDialog.params["evaluate-file"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "evaluate-file": e.target.value },
                    })}
                    placeholder="Path to expression file"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">paths</label>
                  <input
                    type="text"
                    value={commandDialog.params.paths || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, paths: e.target.value },
                    })}
                    placeholder="Input file with document paths"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">path-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["path-column"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "path-column": e.target.value },
                    })}
                    placeholder="Column name containing paths"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">docs</label>
                  <input
                    type="text"
                    value={commandDialog.params.docs || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, docs: e.target.value },
                    })}
                    placeholder="CSV file with inline documents"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">doc-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["doc-column"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "doc-column": e.target.value },
                    })}
                    placeholder="Column name containing documents"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">glob</label>
                  <input
                    type="text"
                    value={commandDialog.params.glob || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, glob: e.target.value },
                    })}
                    placeholder="Glob pattern"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">input-dir</label>
                  <input
                    type="text"
                    value={commandDialog.params["input-dir"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "input-dir": e.target.value },
                    })}
                    placeholder="Base path for document paths"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["stdin-doc"]}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "stdin-doc": e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  stdin-doc
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.parallel}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, parallel: e.target.checked },
                    })}
                    className="h-3.5 w-3.5 accent-foreground" />
                  parallel
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">encoding</label>
                  <input
                    type="text"
                    value={commandDialog.params.encoding || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, encoding: e.target.value },
                    })}
                    placeholder="File encoding"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">threads</label>
                  <input
                    type="number"
                    value={commandDialog.params.threads || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, threads: e.target.value },
                    })}
                    placeholder="Number of threads"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">keep</label>
                  <input
                    type="text"
                    value={commandDialog.params.keep || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, keep: e.target.value },
                    })}
                    placeholder="Columns to keep in output"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
                <div>
                  <label className="text-sm font-medium">url-column</label>
                  <input
                    type="text"
                    value={commandDialog.params["url-column"] || ""}
                    onChange={(e) => setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "url-column": e.target.value },
                    })}
                    placeholder="Column containing base URL"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">foreach</label>
                <input
                  type="text"
                  value={commandDialog.params.foreach || ""}
                  onChange={(e) => setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, foreach: e.target.value },
                  })}
                  placeholder="CSS selector for iteration"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background" />
              </div>
            </div>
          </ScrollArea>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const scrapeCmd = xanCommands.find(
                      (c) => c.id === "scrape"
                    );
                    if (scrapeCmd) {
                      const params = {
                        ...scrapeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(scrapeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </>
        )}

        {commandDialog.type === "fmt" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">out-delimiter</label>
                <SearchableSelect
                  value={commandDialog.params["out-delimiter"] || ","}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "out-delimiter": value },
                    })}
                  options={[
                    { label: "Comma (,)", value: "," },
                    { label: "Tab (\\t)", value: "\t" },
                    { label: "Semicolon (;)", value: ";" },
                    { label: "Pipe (|)", value: "|" },
                    { label: "Caret (^)", value: "^" },
                  ]}
                  placeholder="Search or select..."
                  size="md"
                />
              </div>
              <div>
                <label className="text-sm font-medium">quote</label>
                <input
                  type="text"
                  value={commandDialog.params.quote || '"'}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, quote: e.target.value },
                    })}
                  placeholder="Quote character"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">escape</label>
                <input
                  type="text"
                  value={commandDialog.params.escape || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, escape: e.target.value },
                    })}
                  placeholder="Escape character"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["in-place"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "in-place": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                in-place
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.tabs}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, tabs: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                tabs
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.crlf}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, crlf: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                crlf
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.ascii}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, ascii: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                ascii
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["quote-always"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "quote-always": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                quote-always
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["quote-never"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "quote-never": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                quote-never
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const fmtCmd = xanCommands.find((c) => c.id === "fmt");
                    if (fmtCmd) {
                      const params = {
                        ...fmtCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(fmtCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "to" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">format</label>
                <SearchableSelect
                  value={commandDialog.params.format || "xlsx"}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, format: value },
                    })}
                  options={[
                    { label: "XLSX", value: "xlsx" },
                    { label: "HTML", value: "html" },
                    { label: "JSON", value: "json" },
                    { label: "JSONL", value: "jsonl" },
                    { label: "Markdown", value: "md" },
                    { label: "NDJSON", value: "ndjson" },
                    { label: "NPY", value: "npy" },
                    { label: "Text", value: "txt" },

                  ]}
                  placeholder="Search or select..."
                  size="md"
                />
              </div>
            </div>
            {(commandDialog.params.format === "json" ||
              commandDialog.params.format === "jsonl" ||
              commandDialog.params.format === "ndjson") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">sample-size</label>
                      <input
                        type="number"
                        min={1}
                        value={commandDialog.params["sample-size"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "sample-size": e.target.value },
                          })}
                        placeholder="Number of rows to sample"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">strings</label>
                      <input
                        type="text"
                        value={commandDialog.params.strings || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, strings: e.target.value },
                          })}
                        placeholder="Force as raw strings"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params.nulls}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, nulls: e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      nulls
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params.omit}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, omit: e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      omit
                    </label>
                  </div>
                </div>
              )}
            {commandDialog.params.format === "npy" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">dtype</label>
                    <select
                      value={commandDialog.params.dtype || "f64"}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, dtype: e.target.value },
                        })}
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    >
                      <option value="f32">f32</option>
                      <option value="f64">f64</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">select</label>
                    <input
                      type="text"
                      value={commandDialog.params.select || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, select: e.target.value },
                        })}
                      placeholder="Numerical columns to emit"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
              </div>
            )}
            {commandDialog.params.format === "txt" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">select</label>
                  <input
                    type="text"
                    value={commandDialog.params.select || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, select: e.target.value },
                      })}
                    placeholder="Column to emit as text"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
              </div>
            )}
            {commandDialog.params.format === "md" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">limit</label>
                  <input
                    type="number"
                    min={0}
                    value={commandDialog.params.limit || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, limit: e.target.value },
                      })}
                    placeholder="Maximum number of rows"
                    className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const toCmd = xanCommands.find((c) => c.id === "to");
                    if (toCmd) {
                      const params = {
                        ...toCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(toCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "from" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">format</label>
                <SearchableSelect
                  value={commandDialog.params.format || ""}
                  onChange={(value) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, format: value },
                    })}
                  options={[
                    { label: "ODS", value: "ods" },
                    { label: "XLS", value: "xls" },
                    { label: "XLSB", value: "xlsb" },
                    { label: "XLSX", value: "xlsx" },
                    { label: "JSON", value: "json" },
                    { label: "JSONL", value: "jsonl" },
                    { label: "NDJSON", value: "ndjson" },
                    { label: "Text", value: "txt" },
                    { label: "NPY", value: "npy" },
                    { label: "TAR", value: "tar" },
                    { label: "Markdown (.md)", value: "md" },
                    { label: "Markdown (.markdown)", value: "markdown" },
                  ]}
                  placeholder="Search or select..."
                  size="md"
                />
              </div>
            </div>

            {(commandDialog.params.format === "ods" ||
              commandDialog.params.format === "xls" ||
              commandDialog.params.format === "xlsb" ||
              commandDialog.params.format === "xlsx") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">sheet-index</label>
                      <input
                        type="number"
                        min={0}
                        value={commandDialog.params["sheet-index"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "sheet-index": e.target.value },
                          })}
                        placeholder="0-based index"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">sheet-name</label>
                      <input
                        type="text"
                        value={commandDialog.params["sheet-name"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "sheet-name": e.target.value },
                          })}
                        placeholder="Name of the sheet"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params["list-sheets"]}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "list-sheets": e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      list-sheets
                    </label>
                  </div>
                </div>
              )}

            {(commandDialog.params.format === "json" ||
              commandDialog.params.format === "jsonl" ||
              commandDialog.params.format === "ndjson") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">sample-size</label>
                      <input
                        type="number"
                        min={1}
                        value={commandDialog.params["sample-size"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "sample-size": e.target.value },
                          })}
                        placeholder="Number of records to sample"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">key-column</label>
                      <input
                        type="text"
                        value={commandDialog.params["key-column"]}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "key-column": e.target.value },
                          })}
                        placeholder="Name for the key column"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">value-column</label>
                      <input
                        type="text"
                        value={commandDialog.params["value-column"]}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "value-column": e.target.value },
                          })}
                        placeholder="Name for the value column"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params["sort-keys"]}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "sort-keys": e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      sort-keys
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commandDialog.params["single-object"]}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "single-object": e.target.checked },
                          })}
                        className="h-3.5 w-3.5 accent-foreground"
                      />
                      single-object
                    </label>
                  </div>
                </div>
              )}

            {commandDialog.params.format === "txt" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">column</label>
                    <input
                      type="text"
                      value={commandDialog.params.column || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: { ...commandDialog.params, column: e.target.value },
                        })}
                      placeholder="Name of the column to create"
                      className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
              </div>
            )}

            {(commandDialog.params.format === "md" ||
              commandDialog.params.format === "markdown") && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">nth-table</label>
                      <input
                        type="number"
                        min={0}
                        value={commandDialog.params["nth-table"] || ""}
                        onChange={(e) =>
                          setCommandDialog({
                            ...commandDialog,
                            params: { ...commandDialog.params, "nth-table": e.target.value },
                          })}
                        placeholder="Select nth table"
                        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                      />
                    </div>
                  </div>
                </div>
              )}

            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const fromCmd = xanCommands.find((c) => c.id === "from");
                    if (fromCmd) {
                      const params = {
                        ...fromCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(fromCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "reverse" && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const reverseCmd = xanCommands.find(
                      (c) => c.id === "reverse",
                    );
                    if (reverseCmd) {
                      const params = {
                        ...reverseCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(reverseCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "transpose" && (
          <div className="space-y-3">
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const transposeCmd = xanCommands.find(
                      (c) => c.id === "transpose",
                    );
                    if (transposeCmd) {
                      const params = {
                        ...transposeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(transposeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "pivot" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, columns: e.target.value },
                  })}
                placeholder="Columns to pivot"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">expr</label>
              <input
                type="text"
                value={commandDialog.params.expr || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expr: e.target.value },
                  })}
                placeholder="Aggregation expression"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">groupby</label>
              <input
                type="text"
                value={commandDialog.params.groupby || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, groupby: e.target.value },
                  })}
                placeholder="Group results by given selection of columns"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">column-sep</label>
              <input
                type="text"
                value={commandDialog.params["column-sep"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "column-sep": e.target.value },
                  })}
                placeholder="Separator used to join column names"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const pivotCmd = xanCommands.find((c) => c.id === "pivot");
                    if (pivotCmd) {
                      const params = {
                        ...pivotCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(pivotCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "unpivot" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, columns: e.target.value },
                  })}
                placeholder="Columns to unpivot"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">name-column</label>
              <input
                type="text"
                value={commandDialog.params["name-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "name-column": e.target.value },
                  })}
                placeholder="Name for the column that will contain unpivoted column names"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">value-column</label>
              <input
                type="text"
                value={commandDialog.params["value-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "value-column": e.target.value },
                  })}
                placeholder="Name for the column that will contain unpivoted column values"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const unpivotCmd = xanCommands.find(
                      (c) => c.id === "unpivot",
                    );
                    if (unpivotCmd) {
                      const params = {
                        ...unpivotCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(unpivotCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "split" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">out-dir</label>
              <input
                type="text"
                value={commandDialog.params["out-dir"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "out-dir": e.target.value },
                  })}
                placeholder="Where to write the chunks"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">size</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.size || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, size: e.target.value },
                    })}
                  placeholder="The number of records to write into each chunk"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">chunks</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.chunks || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, chunks: e.target.value },
                    })}
                  placeholder="Divide the file into at most <n> chunks having roughly the same number of records"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">filename</label>
              <input
                type="text"
                value={commandDialog.params.filename || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, filename: e.target.value },
                  })}
                placeholder="A filename template to use when constructing the names of the output files"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.segments}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, segments: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                segments
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const splitCmd = xanCommands.find((c) => c.id === "split");
                    if (splitCmd) {
                      const params = {
                        ...splitCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(splitCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "partition" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })}
                placeholder="Column to partition by"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">out-dir</label>
              <input
                type="text"
                value={commandDialog.params["out-dir"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "out-dir": e.target.value },
                  })}
                placeholder="Where to write the chunks"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">filename</label>
              <input
                type="text"
                value={commandDialog.params.filename || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, filename: e.target.value },
                  })}
                placeholder="Filename template for output files"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">prefix-length</label>
              <input
                type="number"
                value={commandDialog.params["prefix-length"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "prefix-length": e.target.value },
                  })}
                placeholder="Truncate partition column after n bytes"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sorted: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.drop}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, drop: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                drop
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["case-sensitive"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "case-sensitive": e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                case-sensitive
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const partitionCmd = xanCommands.find(
                      (c) => c.id === "partition",
                    );
                    if (partitionCmd) {
                      const params = {
                        ...partitionCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(partitionCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "range" && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-sm font-medium">end</label>
                <input
                  type="number"
                  value={commandDialog.params.end || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, end: e.target.value },
                    })}
                  placeholder="End"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">start</label>
                <input
                  type="number"
                  value={commandDialog.params.start || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, start: e.target.value },
                    })}
                  placeholder="Start"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">step</label>
                <input
                  type="number"
                  min={1}
                  value={commandDialog.params.step || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, step: e.target.value },
                    })}
                  placeholder="Step"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">column-name</label>
                <input
                  type="text"
                  value={commandDialog.params["column-name"] ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, "column-name": e.target.value },
                    })}
                  placeholder="Name of the column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.inclusive}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, inclusive: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                inclusive
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const rangeCmd = xanCommands.find((c) => c.id === "range");
                    if (rangeCmd) {
                      const params = {
                        ...rangeCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(rangeCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "run" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Mode</label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="run-mode"
                    value="pipeline"
                    checked={commandDialog.params.mode === "pipeline" || !commandDialog.params.mode}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, mode: e.target.value },
                      })}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  Pipeline
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="run-mode"
                    value="script"
                    checked={commandDialog.params.mode === "script"}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: { ...commandDialog.params, mode: e.target.value },
                      })}
                    className="h-3.5 w-3.5 accent-foreground"
                  />
                  Script
                </label>
              </div>
            </div>
            {commandDialog.params.mode !== "script" && (
              <div>
                <label className="text-sm font-medium">Pipeline</label>
                <input
                  type="text"
                  value={commandDialog.params.pipeline || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, pipeline: e.target.value },
                    })}
                  placeholder="Pipeline to run"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            )}
            {(commandDialog.params.mode || "pipeline") !== "pipeline" && (
              <div>
                <label className="text-sm font-medium">Script File</label>
                <input
                  type="text"
                  value={commandDialog.params.file || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, file: e.target.value },
                    })}
                  placeholder="Run <pipeline> from a script file instead"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            )}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.tee}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, tee: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                tee
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const runCmd = xanCommands.find((c) => c.id === "run");
                    if (runCmd) {
                      const params = {
                        ...runCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(runCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={
                  (commandDialog.params.mode === "pipeline" || !commandDialog.params.mode) && !commandDialog.params.pipeline ||
                  commandDialog.params.mode === "script" && !commandDialog.params.file ||
                  commandDialog.params.mode === "both" && (!commandDialog.params.pipeline || !commandDialog.params.file)
                }
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "eval" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">expr</label>
              <input
                type="text"
                value={commandDialog.params.expr || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expr: e.target.value },
                  })}
                placeholder="Expression to evaluate (required)"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">headers</label>
              <input
                type="text"
                value={commandDialog.params.headers || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, headers: e.target.value },
                  })}
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">row</label>
              <input
                type="text"
                value={commandDialog.params.row || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, row: e.target.value },
                  })}
                placeholder="Pretend row with comma-separated cells"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.explain}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, explain: e.target.checked },
                    })}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                explain
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const evalCmd = xanCommands.find((c) => c.id === "eval");
                    if (evalCmd) {
                      const params = {
                        ...evalCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(evalCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}

        {commandDialog.type === "output" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Output Path</label>
              <input
                type="text"
                value={commandDialog.params.path || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, path: e.target.value },
                  })}
                placeholder="Enter output file path"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCommandDialog(null)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (
                    commandDialog.isUpdate &&
                    commandDialog.stepId &&
                    onStepUpdate
                  ) {
                    onStepUpdate(commandDialog.stepId, commandDialog.params);
                  } else {
                    const outputCmd = xanCommands.find((c) => c.id === "output");
                    if (outputCmd) {
                      const params = {
                        ...outputCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(outputCmd, params);
                    }
                  }
                  setCommandDialog(null);
                }}
                disabled={!commandDialog.params.path}
              >
                {commandDialog.isUpdate ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
