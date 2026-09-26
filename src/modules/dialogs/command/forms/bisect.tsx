import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function BisectForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell
      {...props}
      disabled={!commandDialog.params.column || !commandDialog.params.value}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">column</label>
          <input
            type="text"
            value={commandDialog.params.column || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bisect",
              "column",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">value</label>
          <input
            type="text"
            value={commandDialog.params.value || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "value",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bisect",
              "value",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md"
          />
        </div>
      </div>
      <div className="flex gap-16">
        {["search", "reverse", "numeric", "exclude", "verbose"].map((n) => (
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
      </div>
    </CommandFormShell>
  );
}
