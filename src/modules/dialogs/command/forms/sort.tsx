import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SortForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.select}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">select</label>
          <input
            type="text"
            value={commandDialog.params.select ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "select",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sort",
              "select",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">count</label>
          <input
            type="text"
            value={commandDialog.params.count ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "count",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sort",
              "count",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">memory-limit</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params["memory-limit"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "memory-limit",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "sort",
              "memory-limit",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-4">
        {[
          "reverse",
          "numeric",
          "check",
          "uniq",
          "parallel",
          "external",
          "compress",
          "columns",
          "cells",
        ].map((n) => (
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
      <div>
        <label className="text-sm font-medium">tmp-dir</label>
        <input
          type="text"
          value={commandDialog.params["tmp-dir"] ?? ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "tmp-dir",
              e.target.value,
            )
          }
          placeholder={getParameterDescription(
            "sort",
            "tmp-dir",
            effectiveLanguage,
          )}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
