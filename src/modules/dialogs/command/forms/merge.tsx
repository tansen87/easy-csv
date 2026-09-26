import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function MergeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} scrollHeight="30vh">
      <div>
        <label className="text-sm font-medium">inputs</label>
        <input
          type="text"
          value={commandDialog.params.inputs || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "inputs",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "merge",
            "inputs",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">select</label>
        <input
          type="text"
          value={commandDialog.params.select || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "select",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "merge",
            "select",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">paths</label>
        <input
          type="text"
          value={commandDialog.params.paths || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "paths",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "merge",
            "paths",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">path-column</label>
        <input
          type="text"
          value={commandDialog.params["path-column"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "path-column",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "merge",
            "path-column",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">source-column</label>
        <input
          type="text"
          value={commandDialog.params["source-column"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "source-column",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "merge",
            "source-column",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        {["numeric", "reverse", "uniq"].map((n) => (
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
