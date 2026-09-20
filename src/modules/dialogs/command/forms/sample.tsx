import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SampleForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">sample-size</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params["sample-size"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sample-size",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sample",
              "sample-size",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "seed",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sample",
              "seed",
              effectiveLanguage,
            )}
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
              updateParam(
                commandDialog,
                setCommandDialog,
                "weight",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sample",
              "weight",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">groupby</label>
          <input
            type="text"
            value={commandDialog.params.groupby ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sample",
              "groupby",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["sorted", "cursed"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n] ?? false}
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
    </CommandFormShell>
  );
}
