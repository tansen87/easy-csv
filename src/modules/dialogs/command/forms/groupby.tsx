import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function GroupbyForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} scrollHeight="24vh">
      <div>
        <label className="text-sm font-medium">columns</label>
        <input
          type="text"
          value={commandDialog.params.columns || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "columns",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "groupby",
            "columns",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
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
            "groupby",
            "expression",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">keep</label>
          <input
            type="text"
            value={commandDialog.params.keep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "keep",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "groupby",
              "keep",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">total</label>
          <input
            type="text"
            value={commandDialog.params.total || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "total",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "groupby",
              "total",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">along-cols</label>
          <input
            type="text"
            value={commandDialog.params["along-cols"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-cols",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "groupby",
              "along-cols",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">along-matrix</label>
          <input
            type="text"
            value={commandDialog.params["along-matrix"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-matrix",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "groupby",
              "along-matrix",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex gap-35">
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={commandDialog.params.sorted}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sorted",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          sorted
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
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
              "groupby",
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
