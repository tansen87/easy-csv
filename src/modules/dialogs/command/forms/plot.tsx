import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { getParameterDescription } from "@/modules/dialogs/command/lib/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function PlotForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { effectiveLanguage } = useLanguage();
  return (
    <CommandFormShell {...props} scrollHeight="30vh">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">x column</label>
          <input
            type="text"
            value={commandDialog.params.x ?? ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, "x", e.target.value)
            }
            placeholder={getParameterDescription(
              "plot",
              "x",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">y column</label>
          <input
            type="text"
            value={commandDialog.params.y ?? ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, "y", e.target.value)
            }
            placeholder={getParameterDescription(
              "plot",
              "y",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">category</label>
          <input
            type="text"
            value={commandDialog.params.category ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "category",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "category",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">aggregate</label>
          <Select
            value={commandDialog.params.aggregate ?? ""}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "aggregate", value)
            }
            options={[
              { label: "sum", value: "sum" },
              { label: "mean", value: "mean" },
            ]}
            placeholder="Select aggregate mode..."
            size="md"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">marker</label>
          <Select
            value={commandDialog.params.marker ?? "braille"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "marker", value)
            }
            options={[
              { label: "braille", value: "braille" },
              { label: "dot", value: "dot" },
              { label: "halfblock", value: "halfblock" },
              { label: "bar", value: "bar" },
              { label: "block", value: "block" },
            ]}
            placeholder="Select marker..."
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">granularity</label>
          <Select
            value={commandDialog.params.granularity ?? ""}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "granularity", value)
            }
            options={[
              { label: "years", value: "years" },
              { label: "months", value: "months" },
              { label: "days", value: "days" },
              { label: "hours", value: "hours" },
              { label: "minutes", value: "minutes" },
              { label: "seconds", value: "seconds" },
            ]}
            placeholder="Select granularity..."
            size="md"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">x-scale</label>
          <Select
            value={commandDialog.params["x-scale"] ?? "lin"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "x-scale", value)
            }
            options={[
              { label: "lin", value: "lin" },
              { label: "pow", value: "pow" },
              { label: "sqrt", value: "sqrt" },
              { label: "log", value: "log" },
              { label: "log2", value: "log2" },
              { label: "log10", value: "log10" },
            ]}
            placeholder="Select x scale..."
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">y-scale</label>
          <Select
            value={commandDialog.params["y-scale"] ?? "lin"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "y-scale", value)
            }
            options={[
              { label: "lin", value: "lin" },
              { label: "pow", value: "pow" },
              { label: "sqrt", value: "sqrt" },
              { label: "log", value: "log" },
              { label: "log2", value: "log2" },
              { label: "log10", value: "log10" },
            ]}
            placeholder="Select y scale..."
            size="md"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {["x-min", "x-max", "y-min", "y-max"].map((n) => (
          <div key={n}>
            <label className="text-sm font-medium">{n}</label>
            <input
              type="number"
              value={commandDialog.params[n] ?? ""}
              onChange={(e) =>
                updateParam(commandDialog, setCommandDialog, n, e.target.value)
              }
              placeholder={getParameterDescription(
                "plot",
                n,
                effectiveLanguage,
              )}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">x-ticks</label>
          <input
            type="number"
            value={commandDialog.params["x-ticks"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "x-ticks",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "x-ticks",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">y-ticks</label>
          <input
            type="number"
            value={commandDialog.params["y-ticks"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "y-ticks",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "y-ticks",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">density-gradient</label>
          <input
            type="text"
            value={commandDialog.params["density-gradient"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "density-gradient",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "density-gradient",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">density-scale</label>
          <Select
            value={commandDialog.params["density-scale"] ?? "log"}
            onChange={(value) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "density-scale",
                value,
              )
            }
            options={[
              { label: "lin", value: "lin" },
              { label: "pow", value: "pow" },
              { label: "sqrt", value: "sqrt" },
              { label: "log", value: "log" },
              { label: "log2", value: "log2" },
              { label: "log10", value: "log10" },
            ]}
            placeholder="Select density scale..."
            size="md"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">small-multiples</label>
          <input
            type="number"
            value={commandDialog.params["small-multiples"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "small-multiples",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "small-multiples",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">timezone</label>
          <input
            type="text"
            value={commandDialog.params.timezone ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "timezone",
                e.target.value,
              )
            }
            placeholder={getParameterDescription(
              "plot",
              "timezone",
              effectiveLanguage,
            )}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {[
          "line",
          "time",
          "count",
          "regression-line",
          "grid",
          "square",
          "ignore",
        ].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
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
      <div className="flex items-center gap-3 flex-wrap">
        {["hide-legend", "hide-x-axis", "hide-y-axis", "hide-all"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap"
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
