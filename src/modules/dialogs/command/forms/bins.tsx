import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function BinsForm(props: CommandFormProps) {
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
              "bins",
              "column",
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
              "bins",
              "select",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">bins</label>
          <input
            type="number"
            value={commandDialog.params.bins || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "bins",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bins",
              "bins",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">heuristic</label>
          <select
            value={commandDialog.params.heuristic || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "heuristic",
                e.target.value,
              )
            }
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          >
            <option value="">None</option>
            <option value="freedman-diaconis">Freedman-Diaconis</option>
            <option value="sqrt">Sqrt</option>
            <option value="sturges">Sturges</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">max-bins</label>
          <input
            type="number"
            value={commandDialog.params["max-bins"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "max-bins",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bins",
              "max-bins",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">label</label>
          <select
            value={commandDialog.params.label || "full"}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "label",
                e.target.value,
              )
            }
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          >
            <option value="full">Full</option>
            <option value="lower">Lower</option>
            <option value="upper">Upper</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-0">
        {["exact", "no-extra"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">min</label>
          <input
            type="number"
            value={commandDialog.params.min || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "min",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bins",
              "min",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">max</label>
          <input
            type="number"
            value={commandDialog.params.max || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "max",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "bins",
              "max",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
