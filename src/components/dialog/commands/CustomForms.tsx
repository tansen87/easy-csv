import { FolderOpen, File } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Button } from "@/components/ui/button";

export function OutputForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.path}>
      <div>
        <label className="text-sm font-medium">Output Path</label>
        <input
          type="text"
          value={commandDialog.params.path || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "path", e.target.value)
          }
          placeholder="Enter output file path"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
    </CommandFormWrapper>
  );
}

export function BatchFilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.column}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
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
              placeholder="Column to filter on"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Filter Type</label>
            <SearchableSelect
              value={commandDialog.params["filter-type"] || "text"}
              onChange={(value) => {
                const newParams: Record<string, any> = {
                  ...commandDialog.params,
                  "filter-type": value,
                };
                // Clear the opposite operator when switching types
                if (value === "text") {
                  delete newParams["number-operator"];
                  if (!newParams["text-operator"]) {
                    newParams["text-operator"] = "equals";
                  }
                } else {
                  delete newParams["text-operator"];
                  if (!newParams["number-operator"]) {
                    newParams["number-operator"] = "equals";
                  }
                }
                setCommandDialog({
                  ...commandDialog,
                  params: newParams,
                });
              }}
              options={[
                { label: "Text", value: "text" },
                { label: "Number", value: "number" },
              ]}
              placeholder="Select type..."
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Operator</label>
            <SearchableSelect
              value={
                commandDialog.params["text-operator"] ||
                commandDialog.params["number-operator"] ||
                "equals"
              }
              onChange={(value) => {
                if (commandDialog.params["filter-type"] === "number") {
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "number-operator": value,
                    },
                  });
                } else {
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "text-operator": value },
                  });
                }
              }}
              options={
                commandDialog.params["filter-type"] === "number"
                  ? [
                      { label: "==", value: "equals" },
                      { label: "!=", value: "not_equals" },
                      { label: ">", value: "greater_than" },
                      { label: ">=", value: "greater_or_equal" },
                      { label: "<", value: "less_than" },
                      { label: "<=", value: "less_or_equal" },
                    ]
                  : [
                      { label: "Equals", value: "equals" },
                      { label: "Not equals", value: "not_equals" },
                      { label: "Starts with", value: "starts_with" },
                      { label: "Not starts with", value: "not_starts_with" },
                      { label: "Ends with", value: "ends_with" },
                      { label: "Not ends with", value: "not_ends_with" },
                      { label: "Contains", value: "contains" },
                      { label: "Not contains", value: "not_contains" },
                      { label: "Regex", value: "regex" },
                      { label: "Is null", value: "is_null" },
                      { label: "Is not null", value: "is_not_null" },
                    ]
              }
              placeholder="Select operator..."
            />
          </div>
          <div>
            <label className="text-sm font-medium">Value Source</label>
            <SearchableSelect
              value={commandDialog.params["value-mode"] || "manual"}
              onChange={(value) => {
                const newParams: Record<string, any> = {
                  ...commandDialog.params,
                  "value-mode": value,
                };
                // Auto-select extract-column to current column when switching to "column" mode
                if (value === "column" && !newParams["extract-column"]) {
                  newParams["extract-column"] =
                    commandDialog.params.column || "";
                }
                setCommandDialog({
                  ...commandDialog,
                  params: newParams,
                });
              }}
              options={[
                { label: "Manual Input", value: "manual" },
                { label: "From Column", value: "column" },
              ]}
              placeholder="Select source..."
            />
          </div>
        </div>
        {commandDialog.params["value-mode"] === "manual" ? (
          <div>
            <label className="text-sm font-medium">Values (one per line)</label>
            <textarea
              value={commandDialog.params["manual-values"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "manual-values": e.target.value,
                  },
                })
              }
              placeholder={"value1\nvalue2\nvalue3"}
              className="w-full h-24 px-3 text-sm border rounded-md bg-background resize-none font-mono"
            />
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium">Extract Column</label>
            <input
              type="text"
              value={commandDialog.params["extract-column"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "extract-column": e.target.value,
                  },
                })
              }
              placeholder="Column to extract values from"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">
            Output Directory (optional)
          </label>
          <input
            type="text"
            value={commandDialog.params["output-dir"] || ""}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  "output-dir": e.target.value,
                },
              })
            }
            placeholder="Same as source file"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["case-insensitive"] || false}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  "case-insensitive": e.target.checked,
                },
              })
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          Case insensitive
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function BatchFromForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper
      {...props}
      disabled={!commandDialog.params["source-path"]}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Source Path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={commandDialog.params["source-path"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "source-path": e.target.value,
                  },
                })
              }
              placeholder="Select files or folder..."
              className="flex-1 h-8 px-3 text-sm border rounded-md bg-background"
              readOnly
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const selected = await open({
                  multiple: true,
                  directory: true,
                });
                if (selected) {
                  const files = Array.isArray(selected) ? selected : [selected];
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "source-path": files.join(";"),
                    },
                  });
                }
              }}
              title="Select folder"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const selected = await open({
                  multiple: true,
                  filters: [
                    { name: "All", extensions: ["*"] },
                    { name: "CSV", extensions: ["csv", "txt", "tsv"] },
                    { name: "JSON", extensions: ["json", "jsonl", "ndjson"] },
                    {
                      name: "Excel",
                      extensions: ["xlsx", "xls", "xlsm", "xlsb"],
                    },
                    { name: "OpenDocument", extensions: ["ods"] },
                    { name: "Parquet", extensions: ["parquet"] },
                    { name: "Markdown", extensions: ["md", "markdown"] },
                  ],
                });
                if (selected) {
                  const files = Array.isArray(selected) ? selected : [selected];
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "source-path": files.join(";"),
                    },
                  });
                }
              }}
              title="Select files"
            >
              <File className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">format (optional)</label>
            <SearchableSelect
              value={commandDialog.params.format || ""}
              onChange={(value) =>
                setCommandDialog({
                  ...commandDialog,
                  params: { ...commandDialog.params, format: value },
                })
              }
              options={[
                { label: "CSV", value: "csv" },
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
              placeholder="Auto-infer from extension..."
              size="md"
            />
          </div>
          <div>
            <label className="text-sm font-medium">pattern</label>
            <input
              type="text"
              value={commandDialog.params.pattern || "*"}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: { ...commandDialog.params, pattern: e.target.value },
                })
              }
              placeholder="*.xlsx"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.recursive || false}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  recursive: e.target.checked,
                },
              })
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          Search subdirectories
        </label>

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
                      params: {
                        ...commandDialog.params,
                        "sheet-index": e.target.value,
                      },
                    })
                  }
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
                      params: {
                        ...commandDialog.params,
                        "sheet-name": e.target.value,
                      },
                    })
                  }
                  placeholder="Name of the sheet"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
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
                      params: {
                        ...commandDialog.params,
                        "sample-size": e.target.value,
                      },
                    })
                  }
                  placeholder="Number of records to sample"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">key-column</label>
                <input
                  type="text"
                  value={commandDialog.params["key-column"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "key-column": e.target.value,
                      },
                    })
                  }
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
                  value={commandDialog.params["value-column"] || ""}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "value-column": e.target.value,
                      },
                    })
                  }
                  placeholder="Name for the value column"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["sort-keys"] || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "sort-keys": e.target.checked,
                      },
                    })
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                sort-keys
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params["single-object"] || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        "single-object": e.target.checked,
                      },
                    })
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                single-object
              </label>
            </div>
          </div>
        )}

        {commandDialog.params.format === "txt" && (
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
                  })
                }
                placeholder="Name of the column to create"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        )}

        {(commandDialog.params.format === "md" ||
          commandDialog.params.format === "markdown") && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">nth-table</label>
              <input
                type="number"
                min={0}
                value={commandDialog.params["nth-table"] || ""}
                onChange={(e) =>
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "nth-table": e.target.value,
                    },
                  })
                }
                placeholder="Select nth table"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        )}
      </div>
    </CommandFormWrapper>
  );
}

export function BatchToForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">format</label>
            <SearchableSelect
              value={commandDialog.params.format || "xlsx"}
              onChange={(value) =>
                setCommandDialog({
                  ...commandDialog,
                  params: { ...commandDialog.params, format: value },
                })
              }
              options={[
                { label: "CSV", value: "csv" },
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
          <div>
            <label className="text-sm font-medium">output-dir (optional)</label>
            <input
              type="text"
              value={commandDialog.params["output-dir"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "output-dir": e.target.value,
                  },
                })
              }
              placeholder="Same as source file"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
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
                      params: {
                        ...commandDialog.params,
                        "sample-size": e.target.value,
                      },
                    })
                  }
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
                      params: {
                        ...commandDialog.params,
                        strings: e.target.value,
                      },
                    })
                  }
                  placeholder="Force as raw strings"
                  className="w-full h-8 px-3 text-sm border rounded-md bg-background"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.nulls || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        nulls: e.target.checked,
                      },
                    })
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                nulls
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={commandDialog.params.omit || false}
                  onChange={(e) =>
                    setCommandDialog({
                      ...commandDialog,
                      params: {
                        ...commandDialog.params,
                        omit: e.target.checked,
                      },
                    })
                  }
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
                      params: {
                        ...commandDialog.params,
                        dtype: e.target.value,
                      },
                    })
                  }
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
                      params: {
                        ...commandDialog.params,
                        select: e.target.value,
                      },
                    })
                  }
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
                  })
                }
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
                  })
                }
                placeholder="Maximum number of rows"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        )}
      </div>
    </CommandFormWrapper>
  );
}
