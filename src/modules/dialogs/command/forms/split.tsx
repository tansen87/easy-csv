import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SplitForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">out-dir</label>
        <input
          type="text"
          value={commandDialog.params["out-dir"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "out-dir",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "split",
            "out-dir",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">size</label>
        <input
          type="number"
          min={1}
          value={commandDialog.params.size || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "size", e.target.value)
          }
          placeholder={getParameterDescription(
            "split",
            "size",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">chunks</label>
        <input
          type="number"
          min={1}
          value={commandDialog.params.chunks || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "chunks",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "split",
            "chunks",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">filename</label>
        <input
          type="text"
          value={commandDialog.params.filename || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "filename",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "split",
            "filename",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.segments}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "segments",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        segments
      </label>
    </CommandFormShell>
  );
}
