import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";

export function ToForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">format</label>
          <Select
            value={commandDialog.params.format || "xlsx"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "format", value)
            }
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "sample-size",
                    e.target.value,
                  )
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "strings",
                    e.target.value,
                  )
                }
                placeholder="Force as raw strings"
                className="w-full h-8 px-3 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {["nulls", "omit"].map((n) => (
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">dtype</label>
              <select
                value={commandDialog.params.dtype || "f64"}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "dtype",
                    e.target.value,
                  )
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "select",
                    e.target.value,
                  )
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
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "select",
                  e.target.value,
                )
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
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "limit",
                  e.target.value,
                )
              }
              placeholder="Maximum number of rows"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </div>
      )}
    </CommandFormShell>
  );
}
