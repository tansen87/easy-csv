import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function HeadersForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["just-names"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "just-names",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          just-names
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.csv}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "csv",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          csv
        </label>
      </div>
    </CommandFormShell>
  );
}
