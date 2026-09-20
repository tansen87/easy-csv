import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SeparateForm(props: CommandFormProps) {
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
              "separate",
              "column",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">separator</label>
          <input
            type="text"
            value={commandDialog.params.separator || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "separator",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "separate",
              "separator",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {[
          "regex",
          "match",
          "captures",
          "all-captures",
          "fixed-width",
          "keep",
          "trim",
        ].map((n) => (
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
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">widths</label>
          <input
            type="text"
            value={commandDialog.params.widths || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "widths",
                e.target.value,
              )
            }
            placeholder="Comma-separated widths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">cuts</label>
          <input
            type="text"
            value={commandDialog.params.cuts || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "cuts",
                e.target.value,
              )
            }
            placeholder="Comma-separated cuts"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">offsets</label>
          <input
            type="text"
            value={commandDialog.params.offsets || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "offsets",
                e.target.value,
              )
            }
            placeholder="Comma-separated offsets"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
            placeholder="Maximum splits"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">too-many</label>
          <select
            value={commandDialog.params["too-many"] || "error"}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "too-many",
                e.target.value,
              )
            }
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          >
            <option value="error">error</option>
            <option value="drop">drop</option>
            <option value="merge">merge</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">into</label>
          <input
            type="text"
            value={commandDialog.params.into || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "into",
                e.target.value,
              )
            }
            placeholder="Column names (comma-separated)"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">prefix</label>
          <input
            type="text"
            value={commandDialog.params.prefix || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix",
                e.target.value,
              )
            }
            placeholder="Column prefix"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
