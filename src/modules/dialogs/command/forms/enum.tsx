import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function EnumForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">column-name</label>
          <input
            type="text"
            value={commandDialog.params["column-name"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column-name",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "enum",
              "column-name",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">start</label>
          <input
            type="number"
            value={commandDialog.params.start || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "start",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "enum",
              "start",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["byte-offset"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "byte-offset",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          Byte Offset
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.accumulate}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "accumulate",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          accumulate
        </label>
      </div>
    </CommandFormShell>
  );
}
