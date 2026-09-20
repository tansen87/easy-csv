import { Select } from "@/components/ui/Select";
import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function JoinForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} scrollHeight="30vh">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <label className="text-sm font-medium">columns</label>
          <input
            type="text"
            value={commandDialog.params.columns || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "columns",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "input1",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "input1",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns2",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "columns2",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div className="col-span-3">
          <label className="text-sm font-medium">input 2</label>
          <input
            type="text"
            value={commandDialog.params.input2 || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "input2",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "input2",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">join-type</label>
          <Select
            value={commandDialog.params["join-type"] || "inner"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "join-type", value)
            }
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
          <Select
            value={commandDialog.params["drop-key"] || "none"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "drop-key", value)
            }
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix-left",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "prefix-left",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">prefix-right</label>
          <input
            type="text"
            value={commandDialog.params["prefix-right"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix-right",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "join",
              "prefix-right",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-12">
        {["ignore-case", "nulls", "sorted", "reverse", "numeric"].map((n) => (
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
      {commandDialog.params["join-type"] === "fuzzy" && (
        <>
          <div className="flex items-center gap-4">
            {["contains", "regex", "url-prefix", "simplified-urls"].map((n) => (
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
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={commandDialog.params.parallel}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "parallel",
                    e.target.checked,
                  )
                }
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
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "threads",
                    e.target.value,
                  )
                }
                placeholder={getParameterDescription(
                  "join",
                  "threads",
                  effectiveLanguage,
                )}
                className="w-20 h-8 px-2 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        </>
      )}
    </CommandFormShell>
  );
}
