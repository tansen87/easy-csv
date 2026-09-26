import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function PivotForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      {["columns", "expr", "groupby", "column-sep"].map((n) => (
        <div key={n}>
          <label className="text-sm font-medium">{n}</label>
          <input
            type="text"
            value={commandDialog.params[n] || ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, n, e.target.value)
            }
            placeholder={getParameterDescription("pivot", n, effectiveLanguage)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      ))}
    </CommandFormShell>
  );
}
