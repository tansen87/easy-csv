import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function FrequencyForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-2 gap-4">
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
            placeholder={getParameterDescription(
              "frequency",
              "select",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">sep</label>
          <input
            type="text"
            value={commandDialog.params.sep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sep",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "frequency",
              "sep",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "frequency",
              "groupby",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "limit",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "frequency",
              "limit",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex gap-30">
        {["all", "approx", "no-extra", "parallel"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
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
          "frequency",
          "threads",
          effectiveLanguage,
        )}
        className="w-full h-8 px-2 text-sm border rounded-md bg-background"
      />
    </CommandFormShell>
  );
}
