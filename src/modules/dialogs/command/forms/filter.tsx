import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function FilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.expression}>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "filter",
            "expression",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["invert-match"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "invert-match",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          invert-match
        </label>
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
          />
          parallel
        </label>
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
            "filter",
            "threads",
            effectiveLanguage,
          )}
          className="h-8 px-1 text-sm border rounded-md bg-background"
        />
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
            "filter",
            "limit",
            effectiveLanguage,
          )}
          className="h-8 px-1 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
