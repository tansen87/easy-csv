import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";

export function TransposeForm(props: CommandFormProps) {
  return (
    <CommandFormWrapper {...props}>
      <></>
    </CommandFormWrapper>
  );
}

export function PivotForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      {["columns", "expr", "groupby", "column-sep"].map((n) => (
        <div key={n}>
          <label className="text-sm font-medium">{n}</label>
          <input
            type="text"
            value={commandDialog.params[n] || ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, n, e.target.value)
            }
            placeholder={n}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      ))}
    </CommandFormWrapper>
  );
}

export function UnpivotForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      {["columns", "name-column", "value-column"].map((n) => (
        <div key={n}>
          <label className="text-sm font-medium">{n}</label>
          <input
            type="text"
            value={commandDialog.params[n] || ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, n, e.target.value)
            }
            placeholder={n}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      ))}
    </CommandFormWrapper>
  );
}
