import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";

export function SplitForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">out-dir</label>
        <input
          type="text"
          value={commandDialog.params["out-dir"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "out-dir",
              e.target.value,
            )
          }
          placeholder="Where to write the chunks"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">size</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.size || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "size",
                e.target.value,
              )
            }
            placeholder="Records per chunk"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <div>
          <label className="text-sm font-medium">chunks</label>
          <input
            type="number"
            min={1}
            value={commandDialog.params.chunks || ""}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "chunks",
                e.target.value,
              )
            }
            placeholder="Max number of chunks"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">filename</label>
        <input
          type="text"
          value={commandDialog.params.filename || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "filename",
              e.target.value,
            )
          }
          placeholder="Filename template"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={commandDialog.params.segments}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "segments",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
        segments
      </label>
    </CommandFormWrapper>
  );
}

export function PartitionForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
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
          placeholder="Column to partition by"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">out-dir</label>
        <input
          type="text"
          value={commandDialog.params["out-dir"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "out-dir",
              e.target.value,
            )
          }
          placeholder="Where to write the chunks"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">filename</label>
        <input
          type="text"
          value={commandDialog.params.filename || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "filename",
              e.target.value,
            )
          }
          placeholder="Filename template"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">prefix-length</label>
        <input
          type="number"
          value={commandDialog.params["prefix-length"] || ""}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "prefix-length",
              e.target.value,
            )
          }
          placeholder="Truncate partition column after n bytes"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div className="flex items-center gap-4">
        {["sorted", "drop", "case-sensitive"].map((n) => (
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
