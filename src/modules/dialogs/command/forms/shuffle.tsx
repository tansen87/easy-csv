import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function ShuffleForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">seed</label>
        <input
          type="number"
          value={commandDialog.params.seed || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "seed", e.target.value)
          }
          placeholder={getParameterDescription(
            "shuffle",
            "seed",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={commandDialog.params.external}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "external",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          external
        </label>
      </div>
    </CommandFormShell>
  );
}
