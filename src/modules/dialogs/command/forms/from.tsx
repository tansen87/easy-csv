import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";

export function FromForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">format</label>
          <Select
            value={commandDialog.params.format || ""}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "format", value)
            }
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sheet-index",
                    e.target.value,
                  )
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sheet-name",
                    e.target.value,
                  )
                }
                placeholder="Name of the sheet"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            {["no-infer", "strip-empty"].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={commandDialog.params[n]}
                  onChange={(e) =>
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      n,
                      e.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      )}
      {(commandDialog.params.format === "json" ||
        commandDialog.params.format === "jsonl" ||
        commandDialog.params.format === "ndjson") && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            {["explode-arrays", "json"].map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={commandDialog.params[n]}
                  onChange={(e) =>
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      n,
                      e.target.checked,
                    )
                  }
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      )}
      {commandDialog.params.format === "npy" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">select</label>
            <input
              type="text"
              value={commandDialog.params.select || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "select",
                  e.target.value,
                )
              }
              placeholder="Numerical columns to read"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
      {commandDialog.params.format === "tar" && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">glob</label>
            <input
              type="text"
              value={commandDialog.params.glob || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "glob",
                  e.target.value,
                )
              }
              placeholder="Glob pattern to filter"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">skip</label>
            <input
              type="number"
              min={0}
              value={commandDialog.params.skip || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "skip",
                  e.target.value,
                )
              }
              placeholder="Number of entries to skip"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">limit</label>
            <input
              type="number"
              min={0}
              value={commandDialog.params.limit || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "limit",
                  e.target.value,
                )
              }
              placeholder="Maximum number of entries to read"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
    </CommandFormShell>
  );
}
