import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SliceForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-2 gap-4">
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
              "slice",
              "start",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip</label>
          <input
            type="number"
            value={commandDialog.params.skip || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "skip",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">end</label>
          <input
            type="number"
            value={commandDialog.params.end || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "end",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "end",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">len</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.len || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "len",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "len",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">index</label>
          <input
            type="number"
            value={commandDialog.params.index || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "index",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "index",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">indices</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.indices || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "indices",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "indices",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">last</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.last || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "last",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "slice",
              "last",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
