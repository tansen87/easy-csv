import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";

export function RunForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper
      {...props}
      disabled={
        ((commandDialog.params.mode === "pipeline" ||
          !commandDialog.params.mode) &&
          !commandDialog.params.pipeline) ||
        (commandDialog.params.mode === "script" &&
          !commandDialog.params.file) ||
        (commandDialog.params.mode === "both" &&
          (!commandDialog.params.pipeline || !commandDialog.params.file))
      }
    >
      <div>
        <label className="text-sm font-medium">Mode</label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="run-mode"
              value="pipeline"
              checked={
                commandDialog.params.mode === "pipeline" ||
                !commandDialog.params.mode
              }
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "mode",
                  e.target.value,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            Pipeline
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="run-mode"
              value="script"
              checked={commandDialog.params.mode === "script"}
              onChange={(e) =>
                updateParam(
                  commandDialog,
                  setCommandDialog,
                  "mode",
                  e.target.value,
                )
              }
              className="h-3.5 w-3.5 accent-foreground"
            />
            Script
          </label>
        </div>
      </div>
      {commandDialog.params.mode !== "script" && (
        <div>
          <label className="text-sm font-medium">Pipeline</label>
          <input
            type="text"
            value={commandDialog.params.pipeline || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "pipeline",
                e.target.value,
              )
            }
            placeholder="Pipeline to run"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      )}
      {(commandDialog.params.mode || "pipeline") !== "pipeline" && (
        <div>
          <label className="text-sm font-medium">Script File</label>
          <input
            type="text"
            value={commandDialog.params.file || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "file",
                e.target.value,
              )
            }
            placeholder="Script file path"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.tee}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "tee",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        tee
      </label>
    </CommandFormWrapper>
  );
}

export function EvalForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">expr</label>
        <input
          type="text"
          value={commandDialog.params.expr || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "expr", e.target.value)
          }
          placeholder="Expression to evaluate (required)"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">headers</label>
        <input
          type="text"
          value={commandDialog.params.headers || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "headers",
              e.target.value,
            )
          }
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">row</label>
        <input
          type="text"
          value={commandDialog.params.row || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "row", e.target.value)
          }
          placeholder="Pretend row with comma-separated cells"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.explain}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "explain",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        explain
      </label>
    </CommandFormWrapper>
  );
}
