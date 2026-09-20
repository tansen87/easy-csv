import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function BeheadForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.append}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "append",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          append
        </label>
      </div>
    </CommandFormShell>
  );
}
