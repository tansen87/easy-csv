import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function InputForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">quote</label>
          <input
            type="text"
            value={commandDialog.params.quote || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "quote",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "quote",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">escape</label>
          <input
            type="text"
            value={commandDialog.params.escape || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "escape",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "escape",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">comment</label>
          <input
            type="text"
            value={commandDialog.params.comment || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "comment",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "comment",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-sm font-medium">skip-lines</label>
          <input
            type="number"
            min={0}
            value={commandDialog.params["skip-lines"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-lines",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "skip-lines",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip-until</label>
          <input
            type="text"
            value={commandDialog.params["skip-until"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-until",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "skip-until",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">skip-while</label>
          <input
            type="text"
            value={commandDialog.params["skip-while"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "skip-while",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "input",
              "skip-while",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {["tabs", "no-quoting", "trim", "tolerant", "gzip", "zstd"].map((n) => (
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
      <div className="grid grid-cols-6 gap-2">
        {["vcf", "gtf", "gff", "sam", "bed", "cdx"].map((n) => (
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
            .{n}
          </label>
        ))}
      </div>
    </CommandFormShell>
  );
}
