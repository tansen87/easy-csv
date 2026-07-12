import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function SortForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.select}>
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
            placeholder={getParameterDescription("sort", "select", language)}
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
            placeholder={getParameterDescription("sort", "count", language)}
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
            placeholder={getParameterDescription("sort", "memory-limit", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {[
          "reverse",
          "numeric",
          "check",
          "uniq",
          "parallel",
          "external",
          "compress",
          "columns",
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
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.cells ?? false}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "cells",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          cells
        </label>
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
          placeholder={getParameterDescription("sort", "tmp-dir", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function DedupForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
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
          placeholder={getParameterDescription("dedup", "select", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-5">
        {["check", "sorted", "external", "keep-last", "keep-duplicates"].map(
          (n) => (
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
          ),
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">choose</label>
          <input
            type="text"
            value={commandDialog.params.choose || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "choose",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("dedup", "choose", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">flag</label>
          <input
            type="text"
            value={commandDialog.params.flag || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "flag",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("dedup", "boolean", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function ShuffleForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">seed</label>
        <input
          type="number"
          value={commandDialog.params.seed || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "seed", e.target.value)
          }
          placeholder={getParameterDescription("shuffle", "seed", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={commandDialog.params.external}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "external",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          external
        </label>
      </div>
    </CommandFormWrapper>
  );
}
