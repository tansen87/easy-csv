import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";
import { useLanguage } from "@/i18n";

export function FrequencyForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
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
            placeholder={getParameterDescription("frequency", "select", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">sep</label>
          <input
            type="text"
            value={commandDialog.params.sep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sep",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("frequency", "sep", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">groupby</label>
          <input
            type="text"
            value={commandDialog.params.groupby || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("frequency", "groupby", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
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
            placeholder={getParameterDescription("frequency", "limit", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-5 gap-0">
        {["all", "approx", "no-extra", "parallel"].map((n) => (
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
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("frequency", "threads", language)}
            className="w-32 h-8 px-2 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function GroupbyForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props} scrollHeight="24vh">
      <div>
        <label className="text-sm font-medium">columns</label>
        <input
          type="text"
          value={commandDialog.params.columns || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "columns",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("groupby", "columns", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("groupby", "expression", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">keep</label>
          <input
            type="text"
            value={commandDialog.params.keep || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "keep",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("groupby", "keep", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">total</label>
          <input
            type="text"
            value={commandDialog.params.total || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "total",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("groupby", "total", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">along-cols</label>
          <input
            type="text"
            value={commandDialog.params["along-cols"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-cols",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("groupby", "along-cols", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">along-matrix</label>
          <input
            type="text"
            value={commandDialog.params["along-matrix"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-matrix",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("groupby", "along-matrix", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={commandDialog.params.sorted}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "sorted",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          sorted
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
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
        <div>
          <input
            type="number"
            min={0}
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("groupby", "threads", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function StatsForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
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
            placeholder={getParameterDescription("stats", "select", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">groupby</label>
          <input
            type="text"
            value={commandDialog.params.groupby || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "groupby",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("stats", "groupby", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-0">
        {["all", "cardinality", "quartiles", "approx", "nulls", "parallel"].map(
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
      <div className="flex items-center gap-4">
        <input
          type="number"
          min={0}
          value={commandDialog.params.threads || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "threads",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("stats", "threads", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function AggForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("agg", "expression", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">along-rows</label>
          <input
            type="text"
            value={commandDialog.params["along-rows"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-rows",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("agg", "along-rows", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">along-cols</label>
          <input
            type="text"
            value={commandDialog.params["along-cols"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "along-cols",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("agg", "along-cols", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">along-matrix</label>
        <input
          type="text"
          value={commandDialog.params["along-matrix"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "along-matrix",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("agg", "along-matrix", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
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
        <div className="flex-1">
          <input
            type="number"
            min={0}
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder={getParameterDescription("agg", "threads", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function BinsForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props}>
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
            placeholder={getParameterDescription("bins", "column", language)}
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
            placeholder={getParameterDescription("bins", "select", language)}
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
            placeholder={getParameterDescription("bins", "bins", language)}
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
            placeholder={getParameterDescription("bins", "max-bins", language)}
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
            placeholder={getParameterDescription("bins", "min", language)}
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
            placeholder={getParameterDescription("bins", "max", language)}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function WindowForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { language } = useLanguage();
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.expression}>
      <div>
        <label className="text-sm font-medium">groupby (optional)</label>
        <input
          type="text"
          value={commandDialog.params.groupby || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "groupby",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("window", "groupby", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">expression</label>
        <input
          type="text"
          value={commandDialog.params.expression || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "expression",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("window", "expression", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm font-medium">along-columns (optional)</label>
        <input
          type="text"
          value={commandDialog.params["along-columns"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "along-columns",
              e.target.value,
            )
          }
          placeholder={getParameterDescription("window", "along-columns", language)}
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {["sorted", "overwrite"].map((n) => (
          <label
            key={n}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={commandDialog.params[n] || false}
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
