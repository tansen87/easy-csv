import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function StatsForm(props: CommandFormProps) {
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
              "stats",
              "select",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
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
              "stats",
              "groupby",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex gap-11">
        {["all", "cardinality", "quartiles", "approx", "nulls", "parallel"].map(
          (n) => (
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
          ),
        )}
      </div>
      <div className="flex items-center gap-4">
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
            "stats",
            "threads",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
