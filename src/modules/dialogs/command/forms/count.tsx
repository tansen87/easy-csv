import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function CountForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="flex gap-16">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["human-readable"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "human-readable",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          human-readable
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.approx}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "approx",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          approx
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["check-alignment"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "check-alignment",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          check-alignment
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.parallel}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "parallel",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          parallel
        </label>
      </div>
      <input
        type="number"
        min={0}
        value={commandDialog.params.threads}
        onChange={(e) =>
          updateParam(
            commandDialog,
            setCommandDialog,
            "threads",
            e.target.value,
          )
        }
        placeholder={getParameterDescription(
          "count",
          "threads",
          effectiveLanguage,
        )}
        className="h-8 px-3 w-full text-sm border rounded-md bg-background"
      />
    </CommandFormShell>
  );
}
