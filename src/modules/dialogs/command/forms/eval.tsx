import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function EvalForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">expr</label>
        <input
          type="text"
          value={commandDialog.params.expr || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "expr", e.target.value)
          }
          placeholder={getParameterDescription(
            "eval",
            "expr",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">headers</label>
        <input
          type="text"
          value={commandDialog.params.headers || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "headers",
              e.target.value,
            )
          }
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">row</label>
        <input
          type="text"
          value={commandDialog.params.row || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "row", e.target.value)
          }
          placeholder={getParameterDescription(
            "eval",
            "row",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.explain}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "explain",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        explain
      </label>
    </CommandFormShell>
  );
}
