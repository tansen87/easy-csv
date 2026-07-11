import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { open } from "@tauri-apps/plugin-dialog";

export function CatForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} scrollHeight="28vh">
      <div>
        <label className="text-sm font-medium">Mode</label>
        <SearchableSelect
          value={commandDialog.params.mode || "rows"}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "mode", value)
          }
          options={[
            { label: "rows", value: "rows" },
            { label: "columns", value: "columns" },
          ]}
          placeholder="Select mode..."
          size="md"
        />
      </div>
      {commandDialog.params.mode === "rows" && (
        <>
          <div className="flex items-center gap-4">
            {["intersection", "union", "raw"].map((n) => (
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
          <div>
            <label className="text-sm font-medium">Input File(s)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={
                  Array.isArray(commandDialog.params.inputs)
                    ? commandDialog.params.inputs.join(", ")
                    : commandDialog.params.inputs || ""
                }
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "inputs",
                    e.target.value,
                  )
                }
                placeholder="Select CSV files to concatenate"
                className="flex-1 h-8 px-3 text-sm border rounded-md bg-background"
              />
              <button
                type="button"
                onClick={async () => {
                  const file = await open({
                    multiple: true,
                    filters: [
                      { name: "Csv", extensions: ["csv", "txt", "tsv"] },
                      { name: "All", extensions: ["*"] },
                    ],
                  });
                  if (file) {
                    updateParam(commandDialog, setCommandDialog, "inputs", file);
                  }
                }}
                className="h-8 px-2 text-sm border rounded-md bg-background hover:bg-muted"
              >
                ...
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">paths</label>
            <input
              type="text"
              value={commandDialog.params.paths || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "paths",
                  e.target.value,
                )
              }
              placeholder="Text file containing paths to CSV files (one per line)"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">path-column</label>
            <input
              type="text"
              value={commandDialog.params["path-column"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "path-column",
                  e.target.value,
                )
              }
              placeholder="Extract paths from this column"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">glob</label>
            <input
              type="text"
              value={commandDialog.params.glob || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "glob",
                  e.target.value,
                )
              }
              placeholder="Glob pattern to collect files"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">source-column</label>
            <input
              type="text"
              value={commandDialog.params["source-column"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "source-column",
                  e.target.value,
                )
              }
              placeholder="Name of source file column"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">preprocess</label>
            <input
              type="text"
              value={commandDialog.params.preprocess || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "preprocess",
                  e.target.value,
                )
              }
              placeholder="Xan subcommands for preprocessing"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">run</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={commandDialog.params.run || ""}
                onChange={(e) =>
                  updateParam(
                    commandDialog,
                    setCommandDialog,
                    "run",
                    e.target.value,
                  )
                }
                placeholder="Path to xan script for preprocessing"
                className="flex-1 h-8 px-3 text-sm border rounded-md bg-background"
              />
              <button
                type="button"
                onClick={async () => {
                  const file = await open({
                    multiple: false,
                    filters: [
                      { name: "Xan Script", extensions: ["xanscript"] },
                      { name: "All", extensions: ["*"] },
                    ],
                  });
                  if (file) {
                    updateParam(commandDialog, setCommandDialog, "run", file);
                  }
                }}
                className="h-8 px-2 text-sm border rounded-md bg-background hover:bg-muted"
              >
                ...
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">shell-preprocess</label>
            <input
              type="text"
              value={commandDialog.params["shell-preprocess"] || ""}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "shell-preprocess",
                  e.target.value,
                )
              }
              placeholder="Shell commands for preprocessing"
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        </>
      )}
      {commandDialog.params.mode === "columns" && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={commandDialog.params.pad}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "pad",
                  e.target.checked,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            pad
          </label>
        </div>
      )}
    </CommandFormWrapper>
  );
}

export function JoinForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} scrollHeight="30vh">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
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
            placeholder="Columns 1"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>
        <div className="col-span-3">
          <label className="text-sm font-medium">input 1</label>
          <input
            type="text"
            value={commandDialog.params.input1 || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "input1",
                e.target.value,
              )
            }
            placeholder="First input file path"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          <label className="text-sm font-medium">columns 2</label>
          <input
            type="text"
            value={commandDialog.params.columns2 || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "columns2",
                e.target.value,
              )
            }
            placeholder="Columns 2"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div className="col-span-3">
          <label className="text-sm font-medium">input 2</label>
          <input
            type="text"
            value={commandDialog.params.input2 || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "input2",
                e.target.value,
              )
            }
            placeholder="Second input file path"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">join-type</label>
          <SearchableSelect
            value={commandDialog.params["join-type"] || "inner"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "join-type", value)
            }
            options={[
              { label: "Inner", value: "inner" },
              { label: "Left", value: "left" },
              { label: "Right", value: "right" },
              { label: "Full", value: "full" },
              { label: "Semi", value: "semi" },
              { label: "Anti", value: "anti" },
              { label: "Cross", value: "cross" },
              { label: "Fuzzy", value: "fuzzy" },
            ]}
            placeholder="Select join type..."
          />
        </div>
        <div>
          <label className="text-sm font-medium">drop-key</label>
          <SearchableSelect
            value={commandDialog.params["drop-key"] || "none"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "drop-key", value)
            }
            options={[
              { label: "Left", value: "left" },
              { label: "Right", value: "right" },
              { label: "None", value: "none" },
              { label: "Both", value: "both" },
            ]}
            placeholder="Select drop key..."
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">prefix-left</label>
          <input
            type="text"
            value={commandDialog.params["prefix-left"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix-left",
                e.target.value,
              )
            }
            placeholder="Prefix for left columns"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">prefix-right</label>
          <input
            type="text"
            value={commandDialog.params["prefix-right"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "prefix-right",
                e.target.value,
              )
            }
            placeholder="Prefix for right columns"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {["ignore-case", "nulls", "sorted", "reverse", "numeric"].map((n) => (
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
      {commandDialog.params["join-type"] === "fuzzy" && (
        <>
          <div className="flex items-center gap-4">
            {["contains", "regex", "url-prefix", "simplified-urls"].map((n) => (
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
          <div className="flex items-center gap-4">
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
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">threads</label>
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
                className="w-20 h-8 px-2 text-sm border rounded-md bg-background"
              />
            </div>
          </div>
        </>
      )}
    </CommandFormWrapper>
  );
}

export function MergeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} scrollHeight="30vh">
      <div>
        <label className="text-sm font-medium">inputs</label>
        <input
          type="text"
          value={commandDialog.params.inputs || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "inputs",
              e.target.value,
            )
          }
          placeholder="Input files to merge"
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
          placeholder="Select a subset of columns to sort"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">paths</label>
        <input
          type="text"
          value={commandDialog.params.paths || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "paths",
              e.target.value,
            )
          }
          placeholder="Text file containing paths"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">path-column</label>
        <input
          type="text"
          value={commandDialog.params["path-column"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "path-column",
              e.target.value,
            )
          }
          placeholder="Extract paths from this column"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">source-column</label>
        <input
          type="text"
          value={commandDialog.params["source-column"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "source-column",
              e.target.value,
            )
          }
          placeholder="Name of source file column"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        {["numeric", "reverse", "uniq"].map((n) => (
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
    </CommandFormWrapper>
  );
}
