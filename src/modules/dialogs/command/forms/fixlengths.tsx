import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function FixlengthsForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">length</label>
        <input
          type="number"
          value={commandDialog.params.length || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "length",
              e.target.value,
            )
          }
          placeholder="Forcefully set the length of each record"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["trust-header"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "trust-header",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          trust-header
        </label>
      </div>
    </CommandFormShell>
  );
}
