import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function HistForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">bar-size</label>
        <Select
          value={commandDialog.params["bar-size"] ?? "medium"}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "bar-size", value)
          }
          options={[
            { label: "small", value: "small" },
            { label: "medium", value: "medium" },
            { label: "large", value: "large" },
          ]}
          placeholder="Select bar size..."
          size="md"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">name</label>
          <input
            type="text"
            value={commandDialog.params.name ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "name",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "hist",
              "name",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">field</label>
          <input
            type="text"
            value={commandDialog.params.field ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "field",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "hist",
              "field",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">label</label>
          <input
            type="text"
            value={commandDialog.params.label ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "label",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "hist",
              "label",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">value</label>
          <input
            type="text"
            value={commandDialog.params.value ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "value",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "hist",
              "value",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["rainbow", "dates", "hide-percent"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n] ?? false}
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
