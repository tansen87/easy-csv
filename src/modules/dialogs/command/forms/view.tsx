import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function ViewForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div>
        <label className="text-sm font-medium">theme</label>
        <Select
          value={commandDialog.params.theme || "borderless"}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "theme", value)
          }
          options={[
            { label: "table", value: "table" },
            { label: "borderless", value: "borderless" },
            { label: "compact", value: "compact" },
            { label: "rounded", value: "rounded" },
            { label: "slim", value: "slim" },
            { label: "striped", value: "striped" },
          ]}
          placeholder="Select theme..."
          size="md"
        />
      </div>
      <div>
        <label className="text-sm font-medium">limit</label>
        <input
          type="number"
          min={1}
          value={commandDialog.params.limit || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "limit",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "view",
            "limit",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md"
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
            "view",
            "select",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="view-all"
            checked={commandDialog.params.all || false}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  all: e.target.checked,
                  limit: e.target.checked
                    ? 0
                    : commandDialog.params.limit || 10,
                },
              })
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          <label htmlFor="view-all" className="text-sm cursor-pointer">
            all
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="view-expand"
            checked={commandDialog.params.expand || false}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "expand",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          <label htmlFor="view-expand" className="text-sm cursor-pointer">
            expand
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="view-hide-info"
            checked={commandDialog.params["hide-info"] || false}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "hide-info",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          <label htmlFor="view-hide-info" className="text-sm cursor-pointer">
            hide-info
          </label>
        </div>
      </div>
    </CommandFormShell>
  );
}
