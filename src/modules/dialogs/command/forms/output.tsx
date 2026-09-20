import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function OutputForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.path}>
      <div>
        <label className="text-sm font-medium">Output Path</label>
        <input
          type="text"
          value={commandDialog.params.path || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "path", e.target.value)
          }
          placeholder={getParameterDescription(
            "output",
            "path",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
    </CommandFormShell>
  );
}
