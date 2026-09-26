import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function MapForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog, headers = [] } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">expression</label>
        <ExpressionEditor
          value={commandDialog.params.expression || ""}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "expression", value)
          }
          columns={headers}
          placeholder={getParameterDescription(
            "map",
            "expression",
            effectiveLanguage,
          )}
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        {["overwrite", "filter", "parallel"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n]}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  n,
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            {n}
          </label>
        ))}
        <input
          type="number"
          min={0}
          value={commandDialog.params.threads || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "threads",
              parseInt(e.target.value) || undefined,
            )
          }
          placeholder={getParameterDescription(
            "map",
            "threads",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
