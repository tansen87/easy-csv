import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";

export function ScrapeForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props} scrollHeight="30vh">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">evaluate</label>
          <input
            type="text"
            value={commandDialog.params.evaluate || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "evaluate",
                e.target.value,
              )
            }
            placeholder="Scraping expression"
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
            placeholder="Path to expression file"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
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
            placeholder="Input file with document paths"
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
            placeholder="Column name containing paths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">docs</label>
          <input
            type="text"
            value={commandDialog.params.docs || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "docs",
                e.target.value,
              )
            }
            placeholder="CSV file with inline documents"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">doc-column</label>
          <input
            type="text"
            value={commandDialog.params["doc-column"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "doc-column",
                e.target.value,
              )
            }
            placeholder="Column name containing documents"
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
            placeholder="Glob pattern"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">input-dir</label>
          <input
            type="text"
            value={commandDialog.params["input-dir"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "input-dir",
                e.target.value,
              )
            }
            placeholder="Base path for document paths"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {["stdin-doc", "parallel"].map((n) => (
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
          <label className="text-sm font-medium">encoding</label>
          <input
            type="text"
            value={commandDialog.params.encoding || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "encoding",
                e.target.value,
              )
            }
            placeholder="File encoding"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">threads</label>
          <input
            type="number"
            value={commandDialog.params.threads || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "threads",
                e.target.value,
              )
            }
            placeholder="Number of threads"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
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
            placeholder="Columns to keep in output"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">url-column</label>
          <input
            type="text"
            value={commandDialog.params["url-column"] || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "url-column",
                e.target.value,
              )
            }
            placeholder="Column containing base URL"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">foreach</label>
        <input
          type="text"
          value={commandDialog.params.foreach || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "foreach",
              e.target.value,
            )
          }
          placeholder="CSS selector for iteration"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormShell>
  );
}
