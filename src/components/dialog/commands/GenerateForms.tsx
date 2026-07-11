import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";

export function RangeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-4 gap-2">
        {["end", "start", "step"].map((n) => (
          <div key={n}>
            <label className="text-sm font-medium">{n}</label>
            <input
              type="number"
              value={commandDialog.params[n] || ""}
              onChange={(e) =>
                updateParam(commandDialog, setCommandDialog, n, e.target.value)
              }
              placeholder={n}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        ))}
        <div>
          <label className="text-sm font-medium">column-name</label>
          <input
            type="text"
            value={commandDialog.params["column-name"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column-name",
                e.target.value,
              )
            }
            placeholder="Name of the column"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.inclusive}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "inclusive",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        inclusive
      </label>
    </CommandFormWrapper>
  );
}
