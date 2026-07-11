import { CommandFormProps } from "@/components/dialog/commands/types";
import { updateParam } from "@/components/dialog/commands/helpers";
import { CommandFormWrapper } from "@/components/dialog/commands/CommandFormWrapper";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export function OutputForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props} disabled={!commandDialog.params.path}>
      <div>
        <label className="text-sm font-medium">Output Path</label>
        <input
          type="text"
          value={commandDialog.params.path || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "path", e.target.value)
          }
          placeholder="Enter output file path"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          autoFocus
        />
      </div>
    </CommandFormWrapper>
  );
}

export function BatchFilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
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
          placeholder="Filter expression"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">glob</label>
        <input
          type="text"
          value={commandDialog.params.glob || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "glob", e.target.value)
          }
          placeholder="Glob pattern to match files"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
      <div>
        <label className="text-sm font-medium">recursive</label>
        <input
          type="checkbox"
          checked={commandDialog.params.recursive || false}
          onChange={(e) =>
            updateParam(
              commandDialog,
              setCommandDialog,
              "recursive",
              e.target.checked,
            )
          }
          className="h-3.5 w-3.5 accent-foreground"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function BatchFromForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div>
        <label className="text-sm font-medium">format</label>
        <SearchableSelect
          value={commandDialog.params.format || ""}
          onChange={(value) =>
            updateParam(commandDialog, setCommandDialog, "format", value)
          }
          options={[
            { label: "XLSX", value: "xlsx" },
            { label: "JSON", value: "json" },
            { label: "JSONL", value: "jsonl" },
          ]}
          placeholder="Select format..."
          size="md"
        />
      </div>
      <div>
        <label className="text-sm font-medium">glob</label>
        <input
          type="text"
          value={commandDialog.params.glob || ""}
          onChange={(e) =>
            updateParam(commandDialog, setCommandDialog, "glob", e.target.value)
          }
          placeholder="Glob pattern to match files"
          className="w-full h-8 px-3 text-sm border rounded-md bg-background"
        />
      </div>
    </CommandFormWrapper>
  );
}

export function BatchToForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormWrapper {...props}>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">format</label>
          <SearchableSelect
            value={commandDialog.params.format || "xlsx"}
            onChange={(value) =>
              updateParam(commandDialog, setCommandDialog, "format", value)
            }
            options={[
              { label: "XLSX", value: "xlsx" },
              { label: "HTML", value: "html" },
              { label: "JSON", value: "json" },
              { label: "JSONL", value: "jsonl" },
              { label: "Markdown", value: "md" },
              { label: "NDJSON", value: "ndjson" },
              { label: "NPY", value: "npy" },
              { label: "Text", value: "txt" },
            ]}
            placeholder="Search or select..."
            size="md"
          />
        </div>
      </div>
    </CommandFormWrapper>
  );
}
