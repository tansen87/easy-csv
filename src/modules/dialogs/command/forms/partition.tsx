import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function PartitionForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
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
            "partition",
            "column",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
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
            "partition",
            "out-dir",
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
            "partition",
            "filename",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">prefix-length</label>
        <input
          type="number"
          value={commandDialog.params["prefix-length"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "prefix-length",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "partition",
            "prefix-length",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        {["sorted", "drop", "case-sensitive"].map((n) => (
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
