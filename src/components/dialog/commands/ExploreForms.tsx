import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function CountForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="flex gap-16">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["human-readable"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "human-readable",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          human-readable
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.approx}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "approx",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          approx
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["check-alignment"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "check-alignment",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          check-alignment
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
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
      </div>
      <input
          type="number"
          min={0}
          value={commandDialog.params.threads}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "threads",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("count", "threads", language)}
          className="h-8 px-3 w-full text-sm border rounded-md bg-background"
        />
    </CommandFormWrapper>
  );
}

export function HeadersForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["just-names"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "just-names",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          just-names
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.csv}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "csv",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          csv
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function ViewForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">theme</label>
        <SearchableSelect
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
          placeholder={getParameterDescription("view", "limit", language)}
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
          placeholder={getParameterDescription("view", "select", language)}
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
    </CommandFormWrapper>
  );
}

export function FlattenForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
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
          placeholder={getParameterDescription("flatten", "select", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">limit</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.limit ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "limit",
                parseInt(e.target.value) || undefined,
              )
            }
            placeholder={getParameterDescription("flatten", "limit", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">row-separator</label>
          <input
            type="text"
            value={commandDialog.params["row-separator"] ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "row-separator",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("flatten", "row-separator", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">split</label>
          <input
            type="text"
            value={commandDialog.params.split ?? ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "split",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("flatten", "split", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">sep</label>
          <input
            type="text"
            value={commandDialog.params.sep ?? "|"}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sep",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("flatten", "sep", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {[
          "condense",
          "wrap",
          "flatter",
          "csv",
          "rainbow",
          "non-empty",
          "ignore-case",
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
    </CommandFormWrapper>
  );
}

export function HistForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">bar-size</label>
        <SearchableSelect
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
            placeholder={getParameterDescription("hist", "name", language)}
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
            placeholder={getParameterDescription("hist", "field", language)}
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
            placeholder={getParameterDescription("hist", "label", language)}
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
            placeholder={getParameterDescription("hist", "value", language)}
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
    </CommandFormWrapper>
  );
}

export function PlotForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props} scrollHeight="30vh">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">x column</label>
          <input
            type="text"
            value={commandDialog.params.x ?? ""}
            onChange={(e) =>
              updateParam(commandDialog, setCommandDialog, "x", e.target.value)
            }
            placeholder={getParameterDescription("plot", "x", language)}
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
            placeholder={getParameterDescription("plot", "y", language)}
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
            placeholder={getParameterDescription("plot", "category", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">aggregate</label>
          <SearchableSelect
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
          <SearchableSelect
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
          <SearchableSelect
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
          <SearchableSelect
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
          <SearchableSelect
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
              placeholder={getParameterDescription("plot", n, language)}
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
            placeholder={getParameterDescription("plot", "x-ticks", language)}
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
            placeholder={getParameterDescription("plot", "y-ticks", language)}
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
            placeholder={getParameterDescription("plot", "density-gradient", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">density-scale</label>
          <SearchableSelect
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
            placeholder={getParameterDescription("plot", "small-multiples", language)}
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
            placeholder={getParameterDescription("plot", "timezone", language)}
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
    </CommandFormWrapper>
  );
}
