import { Select } from "@/components/ui/Select";
import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { open } from "@tauri-apps/plugin-dialog";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function CatForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} scrollHeight="28vh">
      <div>
        <label className="text-sm font-medium">Mode</label>
        <Select
          value={commandDialog.params.mode || "rows"}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "mode", value)
          }
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
          <div className="flex items-center gap-16">
            {["intersection", "union", "raw"].map((n) => (
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
          <div>
            <label className="text-sm font-medium">Input File(s)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={
                  Array.isArray(commandDialog.params.inputs)
                    ? commandDialog.params.inputs.join(", ")
                    : commandDialog.params.inputs || ""
                }
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "inputs",
                    e.target.value,
                  )
                }
                placeholder={getParameterDescription(
                  "cat",
                  "inputs",
                  effectiveLanguage,
                )}
                className="flex-1 h-8 px-3 text-sm border rounded-md bg-background"
              />
              <button
                type="button"
                onClick={async () => {
                  const file = await open({
                    multiple: true,
                    filters: [
                      { name: "Csv", extensions: ["csv", "txt", "tsv"] },
                      { name: "All", extensions: ["*"] },
                    ],
                  });
                  if (file) {
                    updateParam(
                      commandDialog,
                      setCommandDialog,
                      "inputs",
                      file,
                    );
                  }
                }}
                className="h-8 px-2 text-sm border rounded-md bg-background hover:bg-muted"
              >
                ...
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">paths</label>
            <input
              type="text"
              value={commandDialog.params.paths || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "paths",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "cat",
                "paths",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">path-column</label>
            <input
              type="text"
              value={commandDialog.params["path-column"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "path-column",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "cat",
                "path-column",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
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
              placeholder={getParameterDescription(
                "cat",
                "glob",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">source-column</label>
            <input
              type="text"
              value={commandDialog.params["source-column"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "source-column",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "cat",
                "source-column",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">preprocess</label>
            <input
              type="text"
              value={commandDialog.params.preprocess || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "preprocess",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "cat",
                "preprocess",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">run</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={commandDialog.params.run || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "run",
                    e.target.value,
                  )
                }
                placeholder={getParameterDescription(
                  "cat",
                  "run",
                  effectiveLanguage,
                )}
                className="flex-1 h-8 px-3 text-sm border rounded-md bg-background"
              />
              <button
                type="button"
                onClick={async () => {
                  const file = await open({
                    multiple: false,
                    filters: [
                      { name: "Xan Script", extensions: ["xanscript"] },
                      { name: "All", extensions: ["*"] },
                    ],
                  });
                  if (file) {
                    updateParam(commandDialog, setCommandDialog, "run", file);
                  }
                }}
                className="h-8 px-2 text-sm border rounded-md bg-background hover:bg-muted"
              >
                ...
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">shell-preprocess</label>
            <input
              type="text"
              value={commandDialog.params["shell-preprocess"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "shell-preprocess",
                  e.target.value,
                )
              }
              placeholder={getParameterDescription(
                "cat",
                "shell-preprocess",
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
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
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "pad",
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            pad
          </label>
        </div>
      )}
    </CommandFormShell>
  );
}
