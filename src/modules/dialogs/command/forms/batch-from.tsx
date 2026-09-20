import { FolderOpen, File } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { CommandFormProps } from "@/types/dialog";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export function BatchFromForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell
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
            >
              <File className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">format</label>
            <Select
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
    </CommandFormShell>
  );
}
