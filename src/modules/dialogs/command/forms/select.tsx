import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SelectForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.selection}>
      <div>
        <label className="text-sm font-medium">selection</label>
        <input
          type="text"
          value={commandDialog.params.selection}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "selection",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "select",
            "selection",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.evaluate}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          evaluate
        </label>
      </div>
      <div>
        <label className="text-sm font-medium">evaluate-file</label>
        <input
          type="text"
          value={commandDialog.params["evaluate-file"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "evaluate-file",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "select",
            "evaluate-file",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
