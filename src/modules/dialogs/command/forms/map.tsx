import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";
import { Checkbox } from "@/components/ui/Checkbox";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

const BOOLEAN_OPTIONS = ["overwrite", "filter", "parallel"] as const;

export function MapForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog, headers = [] } = props;
  const { t, effectiveLanguage } = useLanguage();
  const expression = commandDialog.params.expression || "";
  const empty = !expression.trim();

  return (
    <CommandFormShell {...props} disabled={empty}>
      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium">{t.mapExpression}</span>
          <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/70">
            expression
          </span>
        </div>
        <ExpressionEditor
          value={expression}
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

      <div className="border-t border-border-soft pt-3.5">
        <div className="mb-2 text-[11.5px] text-muted-foreground">
          {t.mapOptions}
        </div>
        <div className="grid grid-cols-4 items-center gap-3">
          {BOOLEAN_OPTIONS.map((name) => (
            <Checkbox
              key={name}
              checked={commandDialog.params[name]}
              onChange={(checked) =>
                updateParam(commandDialog, setCommandDialog, name, checked)
              }
              label={
                <span className="font-mono text-[11.5px] text-foreground">
                  {name}
                </span>
              }
              className="h-7"
            />
          ))}
          <label className="flex h-7 items-center gap-1.5">
            <span className="font-mono text-[11.5px] text-foreground">
              threads
            </span>
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
              className="h-7 w-[88px] rounded-md border border-border bg-background px-2 font-mono text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        </div>
      </div>

      {empty && (
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-warning">{t.exprMissing}</span>
          <span className="text-foreground">{t.mapExpression}</span>
        </div>
      )}
    </CommandFormShell>
  );
}
