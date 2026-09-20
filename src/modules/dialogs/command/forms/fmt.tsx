import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";

export function FmtForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">out-delimiter</label>
          <Select
            value={commandDialog.params["out-delimiter"] || ","}
            onChange={(value) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "out-delimiter",
                value,
              )
            }
            options={[
              { label: "Comma (,)", value: "," },
              { label: "Tab (\\t)", value: "\t" },
              { label: "Semicolon (;)", value: ";" },
              { label: "Pipe (|)", value: "|" },
              { label: "Caret (^)", value: "^" },
            ]}
            placeholder="Search or select..."
            size="md"
          />
        </div>
        <div>
          <label className="text-sm font-medium">quote</label>
          <input
            type="text"
            value={commandDialog.params.quote || '"'}
            onChange={(e) =>
              updateParam(
                commandDialog,
                setCommandDialog,
                "quote",
                e.target.value,
              )
            }
            placeholder="Quote character"
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
            placeholder="Escape character"
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {[
          "in-place",
          "tabs",
          "crlf",
          "ascii",
          "quote-always",
          "quote-never",
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
    </CommandFormShell>
  );
}
