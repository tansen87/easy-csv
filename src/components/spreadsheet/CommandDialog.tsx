import { useState, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

export type CommandDialogType =
  | "search"
  | "filter"
  | "sort"
  | "select"
  | "view"
  | "count"
  | "slice"
  | "head"
  | "tail"
  | "grep"
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
  | "drop"
  | "map"
  | "transform"
  | "enum"
  | "fill"
  | "complete"
  | "flatmap"
  | "separate"
  | "top"
  | "cat"
  | "join"
  | "merge"
  | "fuzzy-join"
  | "rename"
  | "behead"
  | "fixlengths"
  | "explode"
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
  | "eval";

export interface CommandDialogState {
  type: CommandDialogType;
  params: Record<string, any>;
  isUpdate?: boolean;
  stepId?: string;
}

interface CommandDialogProps {
  commandDialog: CommandDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
}

export function CommandDialog({
  commandDialog,
  headers,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
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
    <div className="fixed inset-0 z-50">
      <div
        className="absolute bg-card border rounded-lg shadow-lg w-full max-w-2xl p-4"
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: `calc(50% + ${offset.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          className="flex items-center justify-between mb-2 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-semibold">
            {commandDialog.type === "search" && "Search"}
            {commandDialog.type === "filter" && "Filter"}
            {commandDialog.type === "sort" && "Sort"}
            {commandDialog.type === "select" && "Select"}
            {commandDialog.type === "view" && "View"}
            {commandDialog.type === "count" && "Count"}
            {commandDialog.type === "slice" && "Slice"}
            {commandDialog.type === "head" && "Head"}
            {commandDialog.type === "tail" && "Tail"}
            {commandDialog.type === "grep" && "Grep"}
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
            {commandDialog.type === "drop" && "Drop"}
            {commandDialog.type === "map" && "Map"}
            {commandDialog.type === "transform" && "Transform"}
            {commandDialog.type === "enum" && "Enum"}
            {commandDialog.type === "fill" && "Fill"}
            {commandDialog.type === "complete" && "Complete"}
            {commandDialog.type === "flatmap" && "Flatmap"}
            {commandDialog.type === "separate" && "Separate"}
            {commandDialog.type === "top" && "Top"}
            {commandDialog.type === "cat" && "Cat"}
            {commandDialog.type === "join" && "Join"}
            {commandDialog.type === "merge" && "Merge"}
            {commandDialog.type === "fuzzy-join" && "Fuzzy Join"}
            {commandDialog.type === "rename" && "Rename"}
            {commandDialog.type === "behead" && "Behead"}
            {commandDialog.type === "fixlengths" && "Fix Lengths"}
            {commandDialog.type === "explode" && "Explode"}
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
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandDialog(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {commandDialog.type === "search" && (
          <>
            <ScrollArea className="h-[40vh]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <select
                  value={commandDialog.params.select}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        select: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                >
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pattern</label>
                <input
                  type="text"
                  value={commandDialog.params.pattern}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        pattern: e.target.value,
                      },
                    })
                  }
                  placeholder="Enter search pattern"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["invert-match"]}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          "invert-match": e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Invert Match
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.exact}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          exact: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Exact Match
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.regex}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          regex: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Regex
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["url-prefix"]}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          "url-prefix": e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  URL Prefix
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["non-empty"]}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          "non-empty": e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Non-Empty
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.empty}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          empty: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Empty
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params["ignore-case"]}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          "ignore-case": e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Ignore Case
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commandDialog.params.parallel}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          parallel: e.target.checked,
                        },
                      })
                    }
                    className="h-4 w-4"
                  />
                  Parallel
                </label>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Flag Column</label>
                <input
                  type="text"
                  value={commandDialog.params.flag || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, flag: e.target.value },
                    })
                  }
                  placeholder="Column name to report match status"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Count Column</label>
                <input
                  type="text"
                  value={commandDialog.params.count || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        count: e.target.value,
                      },
                    })
                  }
                  placeholder="Column name to report match count"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit</label>
                <input
                  type="number"
                  value={commandDialog.params.limit || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        limit: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Maximum rows to return"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Threads</label>
                <input
                  type="number"
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        threads: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Number of threads"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Output</label>
                <input
                  type="text"
                  value={commandDialog.params.output || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        output: e.target.value,
                      },
                    })
                  }
                  placeholder="Write output to file instead of stdout"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
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

        {commandDialog.type === "filter" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="e.g. column_name > 100"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
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
                      params: {
                        ...commandDialog.params,
                        "invert-match": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Invert Match
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Threads</label>
              <input
                type="number"
                value={commandDialog.params.threads || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      threads: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    },
                  })
                }
                placeholder="Number of threads"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <select
                  value={commandDialog.params.select}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, select: e.target.value },
                    })
                  }
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                >
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Count</label>
                <input
                  type="text"
                  value={commandDialog.params.count ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, count: e.target.value },
                    })
                  }
                  placeholder="Number of times the line was consecutively duplicated"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Memory Limit</label>
                <input
                  type="number"
                  value={commandDialog.params["memory-limit"] ?? 512}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "memory-limit": parseInt(e.target.value) || 512,
                      },
                    })
                  }
                  placeholder="Max memory for external sorting (MB)"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tmp Dir</label>
              <input
                type="text"
                value={commandDialog.params["tmp-dir"] ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "tmp-dir": e.target.value },
                  })
                }
                placeholder="Directory where external sorting chunks will be written"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        reverse: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.numeric ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        numeric: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Numeric
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.check ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        check: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.uniq ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        uniq: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Uniq
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.unstable ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        unstable: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Unstable
              </label>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.external ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        external: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                External
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.columns ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        columns: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Columns
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.cells ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        cells: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Cells
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selection</label>
              <input
                type="text"
                value={commandDialog.params.selection}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      selection: e.target.value,
                    },
                  })
                }
                placeholder="e.g. column1,column2 or column1:column5"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        evaluate: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Evaluate Expression
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Limit</label>
              <input
                type="number"
                value={commandDialog.params.limit}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      limit: parseInt(e.target.value) || 10,
                    },
                  })
                }
                placeholder="Number of rows to display"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                    const viewCmd = xanCommands.find((c) => c.id === "view");
                    if (viewCmd) {
                      const params = {
                        ...viewCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
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
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        approx: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Approximate
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
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start</label>
                <input
                  type="number"
                  value={commandDialog.params.start || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        start: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Start index"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End</label>
                <input
                  type="number"
                  value={commandDialog.params.end || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        end: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="End index"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Length</label>
                <input
                  type="number"
                  value={commandDialog.params.len || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        len: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Length"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Limit</label>
              <input
                type="number"
                value={commandDialog.params.limit || 10}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      limit: parseInt(e.target.value) || 10,
                    },
                  })
                }
                placeholder="Number of rows to return"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Limit</label>
              <input
                type="number"
                value={commandDialog.params.limit || 10}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      limit: parseInt(e.target.value) || 10,
                    },
                  })
                }
                placeholder="Number of rows to return"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sample Size</label>
                <input
                  type="number"
                  value={commandDialog.params["sample-size"] ?? 10}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "sample-size": parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  placeholder="Number of rows to sample"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Seed</label>
                <input
                  type="number"
                  value={commandDialog.params.seed ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        seed: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="RNG seed"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Weight</label>
                <input
                  type="text"
                  value={commandDialog.params.weight ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, weight: e.target.value },
                    })
                  }
                  placeholder="Column containing weights to bias the sample"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, groupby: e.target.value },
                    })
                  }
                  placeholder="Return a sample per group"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        cursed: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Cursed
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Columns (Optional)
              </label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Column(s) to deduplicate on"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
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
                      params: {
                        ...commandDialog.params,
                        check: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        sorted: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.external}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        external: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                External
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["keep-last"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "keep-last": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Keep Last
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["keep-duplicates"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "keep-duplicates": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Keep Duplicates
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seed (Optional)</label>
              <input
                type="number"
                value={commandDialog.params.seed || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      seed: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="RNG seed"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        external: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                External
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Columns</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        select: e.target.value,
                      },
                    })
                  }
                  placeholder="Column(s) to compute frequencies"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Separator</label>
                <input
                  type="text"
                  value={commandDialog.params.sep || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })
                  }
                  placeholder="Split cells by separator"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <input
                type="text"
                value={commandDialog.params.groupby || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      groupby: e.target.value,
                    },
                  })
                }
                placeholder="Compute frequencies per group"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-5 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.all}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        all: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                All
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        approx: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Approx
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["no-extra"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "no-extra": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                No Extra
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit</label>
                <input
                  type="number"
                  value={commandDialog.params.limit || 10}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        limit: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  placeholder="Top N items"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Threads</label>
                <input
                  type="number"
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        threads: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Number of threads"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
              <div className="space-y-3 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params.columns || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            columns: e.target.value,
                          },
                        })
                      }
                      placeholder="Columns to group by"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expression</label>
                    <input
                      type="text"
                      value={commandDialog.params.expression || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            expression: e.target.value,
                          },
                        })
                      }
                      placeholder="Aggregation expression"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Keep</label>
                    <input
                      type="text"
                      value={commandDialog.params.keep || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            keep: e.target.value,
                          },
                        })
                      }
                      placeholder="Keep these columns"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Total</label>
                    <input
                      type="text"
                      value={commandDialog.params.total || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            total: e.target.value,
                          },
                        })
                      }
                      placeholder="Aggregation over whole file"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Columns</label>
                    <input
                      type="text"
                      value={commandDialog.params["along-cols"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            "along-cols": e.target.value,
                          },
                        })
                      }
                      placeholder="Aggregate over columns"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Along Matrix</label>
                    <input
                      type="text"
                      value={commandDialog.params["along-matrix"] || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            "along-matrix": e.target.value,
                          },
                        })
                      }
                      placeholder="Aggregate all values"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                          params: {
                            ...commandDialog.params,
                            sorted: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4"
                    />
                    Sorted
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={commandDialog.params.parallel}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            parallel: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4"
                    />
                    Parallel
                  </label>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={commandDialog.params.threads || ""}
                      onChange={(e) =>
                        setCommandDialog({
                          ...commandDialog,
                          params: {
                            ...commandDialog.params,
                            threads: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          },
                        })
                      }
                      placeholder="Threads"
                      className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Output</label>
                  <input
                    type="text"
                    value={commandDialog.params.output || ""}
                    onChange={(e) =>
                      setCommandDialog({
                        ...commandDialog,
                        params: {
                          ...commandDialog.params,
                          output: e.target.value,
                        },
                      })
                    }
                    placeholder="Write output to file instead of stdout"
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Columns</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        select: e.target.value,
                      },
                    })
                  }
                  placeholder="Column(s) to compute stats"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        groupby: e.target.value,
                      },
                    })
                  }
                  placeholder="Group by column(s)"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        all: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                All
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.cardinality}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        cardinality: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Cardinality
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.quartiles}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        quartiles: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Quartiles
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.approx}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        approx: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Approx
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.nulls}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        nulls: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Nulls
              </label>
            </div>
            <div className="grid grid-cols-3 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
              <div></div>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Threads</label>
                <input
                  type="number"
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        threads: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Number of threads"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="Aggregation expression (e.g., sum:col1)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Along Rows</label>
                <input
                  type="text"
                  value={commandDialog.params["along-rows"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "along-rows": e.target.value,
                      },
                    })
                  }
                  placeholder="Aggregate per row"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Along Columns</label>
                <input
                  type="text"
                  value={commandDialog.params["along-cols"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "along-cols": e.target.value,
                      },
                    })
                  }
                  placeholder="Aggregate per column"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Along Matrix</label>
              <input
                type="text"
                value={commandDialog.params["along-matrix"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "along-matrix": e.target.value,
                    },
                  })
                }
                placeholder="Aggregate all values"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-3 gap-0">
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
              <div></div>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Threads</label>
                <input
                  type="number"
                  value={commandDialog.params.threads || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        threads: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Number of threads"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <input
                  type="text"
                  value={commandDialog.params.column || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        column: e.target.value,
                      },
                    })
                  }
                  placeholder="Column to bin"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Columns</label>
                <input
                  type="text"
                  value={commandDialog.params.select || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        select: e.target.value,
                      },
                    })
                  }
                  placeholder="Subset of columns"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Bins</label>
                <input
                  type="number"
                  value={commandDialog.params.bins || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        bins: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Number of bins"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Heuristic</label>
                <select
                  value={commandDialog.params.heuristic || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        heuristic: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                >
                  <option value="">None</option>
                  <option value="freedman-diaconis">Freedman-Diaconis</option>
                  <option value="sqrt">Sqrt</option>
                  <option value="sturges">Sturges</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Bins</label>
                <input
                  type="number"
                  value={commandDialog.params["max-bins"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "max-bins": e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Maximum bins"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Label</label>
                <select
                  value={commandDialog.params.label || "full"}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        label: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                >
                  <option value="full">Full</option>
                  <option value="lower">Lower</option>
                  <option value="upper">Upper</option>
                </select>
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
                      params: {
                        ...commandDialog.params,
                        exact: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Exact
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={commandDialog.params["no-extra"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "no-extra": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                No Extra
              </label>
              <div></div>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Min</label>
                <input
                  type="number"
                  value={commandDialog.params.min || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        min: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Override min value"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max</label>
                <input
                  type="number"
                  value={commandDialog.params.max || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        max: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      },
                    })
                  }
                  placeholder="Override max value"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="Window expression (e.g., lag:col1)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <input
                type="text"
                value={commandDialog.params.groupby || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      groupby: e.target.value,
                    },
                  })
                }
                placeholder="Reset aggregation on column(s)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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

        {commandDialog.type === "grep" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pattern</label>
              <input
                type="text"
                value={commandDialog.params.pattern}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      pattern: e.target.value,
                    },
                  })
                }
                placeholder="Pattern to match"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["ignore-case"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "ignore-case": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Ignore Case
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["invert-match"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "invert-match": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Invert Match
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.count}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        count: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Count
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                    const grepCmd = xanCommands.find((c) => c.id === "grep");
                    if (grepCmd) {
                      const params = {
                        ...grepCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(grepCmd, params);
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
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["just-names"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "just-names": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Just Names
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Columns</label>
              <input
                type="text"
                value={commandDialog.params.select ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Column(s) to visualize"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit</label>
                <input
                  type="number"
                  value={commandDialog.params.limit ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        limit: parseInt(e.target.value) || undefined,
                      },
                    })
                  }
                  placeholder="Maximum number of rows to read"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Separator</label>
                <input
                  type="text"
                  value={commandDialog.params.sep ?? "|"}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, sep: e.target.value },
                    })
                  }
                  placeholder="Delimiter for split values"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.condense ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        condense: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Condense
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.wrap ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        wrap: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Wrap
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.flatter ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        flatter: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Flatter
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.csv ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        csv: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                CSV
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.rainbow ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        rainbow: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Rainbow
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["non-empty"] ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "non-empty": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Non Empty
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <input
                type="text"
                value={commandDialog.params.name ?? "unknown"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, name: e.target.value },
                  })
                }
                placeholder="Name of the represented field"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Field</label>
              <input
                type="text"
                value={commandDialog.params.field ?? "field"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, field: e.target.value },
                  })
                }
                placeholder="Name of the field column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Label</label>
              <input
                type="text"
                value={commandDialog.params.label ?? "value"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, label: e.target.value },
                  })
                }
                placeholder="Name of the label column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Value</label>
              <input
                type="text"
                value={commandDialog.params.value ?? "count"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, value: e.target.value },
                  })
                }
                placeholder="Name of the count column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.rainbow ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        rainbow: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Rainbow
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.dates ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        dates: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Dates
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["hide-percent"] ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "hide-percent": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Hide Percent
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

        {commandDialog.type === "drop" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selection</label>
              <input
                type="text"
                value={commandDialog.params.selection || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      selection: e.target.value,
                    },
                  })
                }
                placeholder="Columns to drop (comma-separated)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="Expression to evaluate"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        overwrite: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Overwrite
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.filter}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        filter: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Filter
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Threads</label>
              <input
                type="number"
                value={commandDialog.params.threads || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      threads: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                placeholder="Number of threads to use"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Column to transform"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="Expression to evaluate"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                    const transformCmd = xanCommands.find(
                      (c) => c.id === "transform",
                    );
                    if (transformCmd) {
                      const params = {
                        ...transformCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
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
          </div>
        )}

        {commandDialog.type === "enum" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Column Name</label>
              <input
                type="text"
                value={commandDialog.params["column-name"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "column-name": e.target.value,
                    },
                  })
                }
                placeholder="Name of the column to prepend"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start</label>
              <input
                type="number"
                value={commandDialog.params.start || 0}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      start: parseInt(e.target.value) || 0,
                    },
                  })
                }
                placeholder="Number to count from"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["byte-offset"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "byte-offset": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
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
                      params: {
                        ...commandDialog.params,
                        accumulate: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Accumulate
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Selection of columns to fill"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Value</label>
              <input
                type="text"
                value={commandDialog.params.value || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, value: e.target.value },
                  })
                }
                placeholder="Fill empty cells using provided value"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Column to complete"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.check}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        check: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Check
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.dates}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        dates: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Dates
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.sorted}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        sorted: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.reverse}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        reverse: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Reverse
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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

        {commandDialog.type === "flatmap" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expression || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      expression: e.target.value,
                    },
                  })
                }
                placeholder="Expression to evaluate"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Column to apply expression to"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Replace</label>
              <input
                type="text"
                value={commandDialog.params.replace || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      replace: e.target.value,
                    },
                  })
                }
                placeholder="Name of the column to replace"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.parallel}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        parallel: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Parallel
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                    const flatmapCmd = xanCommands.find(
                      (c) => c.id === "flatmap",
                    );
                    if (flatmapCmd) {
                      const params = {
                        ...flatmapCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(flatmapCmd, params);
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Column to split"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Separator</label>
              <input
                type="text"
                value={commandDialog.params.separator || ","}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      separator: e.target.value,
                    },
                  })
                }
                placeholder="Separator to use"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Column</label>
                <input
                  type="text"
                  value={commandDialog.params.column ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, column: e.target.value },
                    })
                  }
                  placeholder="Column to top"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Limit</label>
                <input
                  type="number"
                  value={commandDialog.params.limit ?? 10}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        limit: parseInt(e.target.value) || 10,
                      },
                    })
                  }
                  placeholder="Number of rows to return"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Group By</label>
                <input
                  type="text"
                  value={commandDialog.params.groupby ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        groupby: e.target.value,
                      },
                    })
                  }
                  placeholder="Return top n values per group"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rank</label>
                <input
                  type="text"
                  value={commandDialog.params.rank ?? ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: { ...commandDialog.params, rank: e.target.value },
                    })
                  }
                  placeholder="Name of a rank column to prepend"
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        reverse: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.lexicographic ?? false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        lexicographic: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
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
                      params: {
                        ...commandDialog.params,
                        ties: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Ties
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output ?? ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mode</label>
              <select
                value={commandDialog.params.mode || "rows"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, mode: e.target.value },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="rows">Rows</option>
                <option value="columns">Columns</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paths</label>
              <input
                type="text"
                value={commandDialog.params.paths || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, paths: e.target.value },
                  })
                }
                placeholder="Text file containing paths to CSV files"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Path Column</label>
              <input
                type="text"
                value={commandDialog.params["path-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "path-column": e.target.value,
                    },
                  })
                }
                placeholder="Extract paths from this column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Column</label>
              <input
                type="text"
                value={commandDialog.params["source-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "source-column": e.target.value,
                    },
                  })
                }
                placeholder="Name of source file column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.pad}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        pad: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Pad
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          </div>
        )}

        {commandDialog.type === "join" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Columns to join on"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Input 1</label>
              <input
                type="text"
                value={commandDialog.params.input1 || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, input1: e.target.value },
                  })
                }
                placeholder="First input file path"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns 2</label>
              <input
                type="text"
                value={commandDialog.params.columns2 || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns2: e.target.value,
                    },
                  })
                }
                placeholder="Right columns to join on"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Input 2</label>
              <input
                type="text"
                value={commandDialog.params.input2 || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, input2: e.target.value },
                  })
                }
                placeholder="Second input file path"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Join Type</label>
              <select
                value={commandDialog.params["join-type"] || "inner"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "join-type": e.target.value,
                    },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="inner">Inner</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="full">Full</option>
                <option value="semi">Semi</option>
                <option value="anti">Anti</option>
                <option value="cross">Cross</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Drop Key</label>
              <select
                value={commandDialog.params["drop-key"] || "none"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "drop-key": e.target.value,
                    },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="none">None</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix Left</label>
              <input
                type="text"
                value={commandDialog.params["prefix-left"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "prefix-left": e.target.value,
                    },
                  })
                }
                placeholder="Prefix for left columns"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix Right</label>
              <input
                type="text"
                value={commandDialog.params["prefix-right"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "prefix-right": e.target.value,
                    },
                  })
                }
                placeholder="Prefix for right columns"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["ignore-case"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "ignore-case": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Ignore Case
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.nulls}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        nulls: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Nulls
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          </div>
        )}

        {commandDialog.type === "merge" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Inputs</label>
              <input
                type="text"
                value={commandDialog.params.inputs || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, inputs: e.target.value },
                  })
                }
                placeholder="Input files to merge"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Select a subset of columns to sort"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Paths</label>
              <input
                type="text"
                value={commandDialog.params.paths || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, paths: e.target.value },
                  })
                }
                placeholder="Text file containing paths"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Path Column</label>
              <input
                type="text"
                value={commandDialog.params["path-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "path-column": e.target.value,
                    },
                  })
                }
                placeholder="Extract paths from this column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Source Column</label>
              <input
                type="text"
                value={commandDialog.params["source-column"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "source-column": e.target.value,
                    },
                  })
                }
                placeholder="Name of source file column"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        numeric: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
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
                      params: {
                        ...commandDialog.params,
                        reverse: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Reverse
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.uniq}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        uniq: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Uniq
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          </div>
        )}

        {commandDialog.type === "fuzzy-join" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Columns to join on"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Input</label>
              <input
                type="text"
                value={commandDialog.params.input || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, input: e.target.value },
                  })
                }
                placeholder="Input file path"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                    const fuzzyJoinCmd = xanCommands.find(
                      (c) => c.id === "fuzzy-join",
                    );
                    if (fuzzyJoinCmd) {
                      const params = {
                        ...fuzzyJoinCmd.parameters.reduce(
                          (acc, param) => {
                            acc[param.name] = param.default;
                            return acc;
                          },
                          {} as Record<string, any>,
                        ),
                        ...commandDialog.params,
                      };
                      onAddCommand(fuzzyJoinCmd, params);
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

        {commandDialog.type === "rename" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Columns to rename"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Column mappings (e.g., old1:new1,old2:new2)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix</label>
              <input
                type="text"
                value={commandDialog.params.prefix || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, prefix: e.target.value },
                  })
                }
                placeholder="Prefix to add to all column names"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Suffix</label>
              <input
                type="text"
                value={commandDialog.params.suffix || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, suffix: e.target.value },
                  })
                }
                placeholder="Suffix to add to all column names"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.slugify}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        slugify: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
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
                      params: {
                        ...commandDialog.params,
                        replace: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
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
                      params: {
                        ...commandDialog.params,
                        force: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Force
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.append}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        append: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Append
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Length</label>
              <input
                type="number"
                value={commandDialog.params.length || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      length: parseInt(e.target.value) || undefined,
                    },
                  })
                }
                placeholder="Forcefully set the length of each record"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        "trust-header": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Trust Header
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Columns to explode"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Separator</label>
              <input
                type="text"
                value={commandDialog.params.sep || "|"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, sep: e.target.value },
                  })
                }
                placeholder="Separator to split the cells"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rename</label>
              <input
                type="text"
                value={commandDialog.params.rename || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, rename: e.target.value },
                  })
                }
                placeholder="New names for the exploded columns"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.singularize}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        singularize: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Singularize
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["drop-empty"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "drop-empty": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Drop Empty
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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

        {commandDialog.type === "fmt" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Output Delimiter</label>
              <select
                value={commandDialog.params["out-delimiter"] || ","}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "out-delimiter": e.target.value,
                    },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value=",">Comma (,)</option>
                <option value="\t">Tab (\t)</option>
                <option value=";">Semicolon (;)</option>
                <option value="|">Pipe (|)</option>
                <option value="^">Caret (^)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quote Character</label>
              <input
                type="text"
                value={commandDialog.params.quote || '"'}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, quote: e.target.value },
                  })
                }
                placeholder="Quote character to use"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Escape Character</label>
              <input
                type="text"
                value={commandDialog.params.escape || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, escape: e.target.value },
                  })
                }
                placeholder="Escape character to use"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.tabs}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        tabs: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Tabs
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.crlf}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        crlf: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                CRLF
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.ascii}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        ascii: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                ASCII
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["quote-always"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "quote-always": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Quote Always
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["quote-never"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "quote-never": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Quote Never
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <select
                value={commandDialog.params.format || "json"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, format: e.target.value },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="html">HTML</option>
                <option value="json">JSON</option>
                <option value="jsonl">JSONL</option>
                <option value="md">Markdown</option>
                <option value="ndjson">NDJSON</option>
                <option value="npy">NPY</option>
                <option value="txt">Text</option>
                <option value="xlsx">XLSX</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sample Size</label>
              <input
                type="number"
                value={commandDialog.params["sample-size"] || 512}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "sample-size": parseInt(e.target.value) || 512,
                    },
                  })
                }
                placeholder="Number of rows to sample for JSON type inference"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Strings</label>
              <input
                type="text"
                value={commandDialog.params.strings || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      strings: e.target.value,
                    },
                  })
                }
                placeholder="Force selected columns as raw strings (JSON)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select (Text)</label>
              <input
                type="text"
                value={commandDialog.params.select || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, select: e.target.value },
                  })
                }
                placeholder="Column to emit as text (txt)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Number Type (NPY)</label>
              <select
                value={commandDialog.params.dtype || "f64"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, dtype: e.target.value },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="f32">f32</option>
                <option value="f64">f64</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.nulls}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        nulls: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Nulls
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.omit}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        omit: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Omit Empty
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Format</label>
              <select
                value={commandDialog.params.format || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, format: e.target.value },
                  })
                }
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              >
                <option value="">Auto-detect</option>
                <option value="ods">ODS</option>
                <option value="xls">XLS</option>
                <option value="xlsb">XLSB</option>
                <option value="xlsx">XLSX</option>
                <option value="json">JSON</option>
                <option value="jsonl">JSONL</option>
                <option value="ndjson">NDJSON</option>
                <option value="txt">Text</option>
                <option value="npy">NPY</option>
                <option value="tar"> TAR</option>
                <option value="md">Markdown</option>
                <option value="markdown">Markdown (full)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sheet Index</label>
              <input
                type="number"
                value={commandDialog.params["sheet-index"] || 0}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "sheet-index": parseInt(e.target.value) || 0,
                    },
                  })
                }
                placeholder="0-based index of the sheet to convert"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sheet Name</label>
              <input
                type="text"
                value={commandDialog.params["sheet-name"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "sheet-name": e.target.value,
                    },
                  })
                }
                placeholder="Name of the sheet to convert"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sample Size</label>
              <input
                type="number"
                value={commandDialog.params["sample-size"] || 64}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "sample-size": parseInt(e.target.value) || 64,
                    },
                  })
                }
                placeholder="Number of records to sample (JSON)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Column Name (Text)</label>
              <input
                type="text"
                value={commandDialog.params.column || "value"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Name of the column to create"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nth Table (Markdown)
              </label>
              <input
                type="number"
                value={commandDialog.params["nth-table"] || 0}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "nth-table": parseInt(e.target.value) || 0,
                    },
                  })
                }
                placeholder="Select nth table in Markdown document"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["sort-keys"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "sort-keys": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Sort Keys
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Columns to pivot"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expr || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expr: e.target.value },
                  })
                }
                placeholder="Aggregation expression"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Group By</label>
              <input
                type="text"
                value={commandDialog.params.groupby || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      groupby: e.target.value,
                    },
                  })
                }
                placeholder="Group results by given selection of columns"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Column Separator</label>
              <input
                type="text"
                value={commandDialog.params["column-sep"] || "_"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "column-sep": e.target.value,
                    },
                  })
                }
                placeholder="Separator used to join column names"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stack multiple columns into fewer columns.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Columns</label>
              <input
                type="text"
                value={commandDialog.params.columns || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      columns: e.target.value,
                    },
                  })
                }
                placeholder="Columns to unpivot (required)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name Column</label>
              <input
                type="text"
                value={commandDialog.params["name-column"] || "name"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "name-column": e.target.value,
                    },
                  })
                }
                placeholder="Name for the column containing unpivoted column names"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Value Column</label>
              <input
                type="text"
                value={commandDialog.params["value-column"] || "value"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "value-column": e.target.value,
                    },
                  })
                }
                placeholder="Name for the column containing unpivoted column values"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Split CSV data into chunks.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output Directory</label>
              <input
                type="text"
                value={commandDialog.params["out-dir"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "out-dir": e.target.value,
                    },
                  })
                }
                placeholder="Where to write the chunks"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Size (records per chunk)
              </label>
              <input
                type="number"
                value={commandDialog.params.size || 4096}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      size: parseInt(e.target.value) || 4096,
                    },
                  })
                }
                placeholder="Number of records per chunk"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Chunks (max number)</label>
              <input
                type="number"
                value={commandDialog.params.chunks || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      chunks: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                placeholder="Divide into at most n chunks"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Filename Template</label>
              <input
                type="text"
                value={commandDialog.params.filename || "{}.csv"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      filename: e.target.value,
                    },
                  })
                }
                placeholder="Filename template for output files"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        segments: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Segments
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Partition CSV data based on a column value.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Column</label>
              <input
                type="text"
                value={commandDialog.params.column || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, column: e.target.value },
                  })
                }
                placeholder="Column to partition by (required)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output Directory</label>
              <input
                type="text"
                value={commandDialog.params["out-dir"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "out-dir": e.target.value,
                    },
                  })
                }
                placeholder="Where to write the chunks"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Filename Template</label>
              <input
                type="text"
                value={commandDialog.params.filename || "{}.csv"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      filename: e.target.value,
                    },
                  })
                }
                placeholder="Filename template for output files"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix Length</label>
              <input
                type="number"
                value={commandDialog.params["prefix-length"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "prefix-length": e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                placeholder="Truncate partition column after n bytes"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        sorted: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Sorted
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.drop}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        drop: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Drop Partition Column
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["case-sensitive"]}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "case-sensitive": e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Case Sensitive
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a CSV file from a numerical range.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">End</label>
              <input
                type="number"
                value={commandDialog.params.end || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      end: e.target.value
                        ? parseInt(e.target.value)
                        : undefined,
                    },
                  })
                }
                placeholder="End of the range (required)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Start</label>
              <input
                type="number"
                value={commandDialog.params.start ?? 0}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      start: e.target.value ? parseInt(e.target.value) : 0,
                    },
                  })
                }
                placeholder="Start of the range"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Step</label>
              <input
                type="number"
                value={commandDialog.params.step ?? 1}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      step: e.target.value ? parseInt(e.target.value) : 1,
                    },
                  })
                }
                placeholder="Step of the range"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Column Name</label>
              <input
                type="text"
                value={commandDialog.params["column-name"] || "n"}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "column-name": e.target.value,
                    },
                  })
                }
                placeholder="Name of the column containing the range"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.inclusive}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        inclusive: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Inclusive
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Output</label>
              <input
                type="text"
                value={commandDialog.params.output || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, output: e.target.value },
                  })
                }
                placeholder="Write output to file instead of stdout"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
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

        {commandDialog.type === "eval" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Evaluate/debug a single expression.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Expression</label>
              <input
                type="text"
                value={commandDialog.params.expr || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, expr: e.target.value },
                  })
                }
                placeholder="Expression to evaluate (required)"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Headers</label>
              <input
                type="text"
                value={commandDialog.params.headers || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      headers: e.target.value,
                    },
                  })
                }
                placeholder="Pretend headers, separated by commas"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Row</label>
              <input
                type="text"
                value={commandDialog.params.row || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, row: e.target.value },
                  })
                }
                placeholder="Pretend row with comma-separated cells"
                className="w-full h-10 px-3 text-sm border rounded-md bg-background"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.serialize}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        serialize: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Serialize
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.explain}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        explain: e.target.checked,
                      },
                    })
                  }
                  className="h-4 w-4"
                />
                Explain
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
      </div>
    </div>
  );
}
