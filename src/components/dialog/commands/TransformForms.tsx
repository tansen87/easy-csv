import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { ExpressionEditor } from "@/components/expression/ExpressionEditor";

export function SelectForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.selection}>
      <div>
        <label className="text-sm font-medium">selection</label>
        <input
          type="text"
          value={commandDialog.params.selection}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "selection",
              e.target.value,
            )
          }
          placeholder="e.g. column1,column2 or 0:4"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.evaluate}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          evaluate
        </label>
      </div>
      <div>
        <label className="text-sm font-medium">evaluate-file</label>
        <input
          type="text"
          value={commandDialog.params["evaluate-file"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "evaluate-file",
              e.target.value,
            )
          }
          placeholder="Read evaluation expression from a file instead"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function DropForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">selection</label>
        <input
          type="text"
          value={commandDialog.params.selection || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "selection",
              e.target.value,
            )
          }
          placeholder="Columns to drop (comma-separated)"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function MapForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog, headers = [] } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">expression</label>
        <ExpressionEditor
          value={commandDialog.params.expression || ""}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "expression", value)
          }
          columns={headers}
          placeholder="Expression to evaluate (e.g., split(name, '.') | first | upper)"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-4">
        {["overwrite", "filter", "parallel"].map((n) => (
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
        <input
          type="number"
          min={0}
          value={commandDialog.params.threads || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "threads",
              parseInt(e.target.value) || undefined,
            )
          }
          placeholder="Number of threads"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function TransformForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
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
            placeholder="Column to transform"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium">rename</label>
          <input
            type="text"
            value={commandDialog.params.rename || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "rename",
                e.target.value,
              )
            }
            placeholder="New name for the column"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
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
          placeholder="Expression to evaluate"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">evaluate-file</label>
        <input
          type="text"
          value={commandDialog.params["evaluate-file"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "evaluate-file",
              e.target.value,
            )
          }
          placeholder="Read expression from file"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-4 flex-wrap">
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
            placeholder="Threads"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function EnumForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">column-name</label>
          <input
            type="text"
            value={commandDialog.params["column-name"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "column-name",
                e.target.value,
              )
            }
            placeholder="Name of the column to prepend"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">start</label>
          <input
            type="number"
            value={commandDialog.params.start || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "start",
                e.target.value,
              )
            }
            placeholder="Number to count from"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["byte-offset"]}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "byte-offset",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          Byte Offset
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params.accumulate}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "accumulate",
                e.target.checked,
              )
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          accumulate
        </label>
      </div>
    </CommandFormWrapper>
  );
}

export function FillForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
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
          placeholder="Selection of columns to fill"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">value</label>
        <input
          type="text"
          value={commandDialog.params.value || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "value",
              e.target.value,
            )
          }
          placeholder="Fill empty cells using provided value"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function CompleteForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
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
            placeholder="Column to complete"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
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
            placeholder="Columns to group by"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["check", "dates", "sorted", "reverse"].map((n) => (
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">min</label>
          <input
            type="text"
            value={commandDialog.params.min || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "min",
                e.target.value,
              )
            }
            placeholder="Minimum value of range"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">max</label>
          <input
            type="text"
            value={commandDialog.params.max || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "max",
                e.target.value,
              )
            }
            placeholder="Maximum value of range"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}

export function BlankForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.select}>
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
          placeholder="Selection of columns to blank down"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
      <div>
        <label className="text-sm font-medium">redact</label>
        <input
          type="text"
          value={commandDialog.params.redact || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "redact",
              e.target.value,
            )
          }
          placeholder="Replacement string for blanked values (default: empty)"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function SeparateForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
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
            placeholder="Column to split"
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
            placeholder="Separator to use"
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
    </CommandFormWrapper>
  );
}
