import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function ImplodeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.columns}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">columns</label>
          <input
            type="text"
            value={commandDialog.params.columns || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns",
                e.target.value,
              )
            }
            placeholder="Columns to implode"
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
            placeholder="Separator for joining cells"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">rename</label>
          <input
            type="text"
            value={commandDialog.params.rename || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rename",
                e.target.value,
              )
            }
            placeholder="New name for the diverging column"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">cmp</label>
          <input
            type="text"
            value={commandDialog.params.cmp || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "cmp",
                e.target.value,
              )
            }
            placeholder="Columns to compare for merging"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.pluralize}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "pluralize",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          pluralize
        </label>
      </div>
    </CommandFormShell>
  );
}
