import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function TransformForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
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
              "transform",
              "column",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">rename</label>
          <input
            type="text"
            value={commandDialog.params.rename || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rename",
                e.target.value,
              )
            }
            placeholder="New name for the column"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "transform",
            "expression",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">evaluate-file</label>
        <input
          type="text"
          value={commandDialog.params["evaluate-file"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "evaluate-file",
              e.target.value,
            )
          }
          placeholder="Read expression from file"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
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
        <div>
          <input
            type="number"
            min={0}
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "transform",
              "threads",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
