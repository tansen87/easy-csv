import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandDialogState } from "@/types/dialog";
import { useLanguage } from "@/i18n";
import { MultiValueInput } from "@/components/ui/MultiValueInput";

export function Checkbox({
  name,
  commandDialog,
  setCommandDialog,
}: {
  name: string;
  commandDialog: CommandDialogState;
  setCommandDialog: (d: CommandDialogState | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={commandDialog.params[name]}
        onChange={(e) =>
          updateParam(commandDialog, setCommandDialog, name, e.target.checked)
        }
        className="h-3.5 w-3.5 accent-foreground"
      />
      {name}
    </label>
  );
}

export function TextField({
  name,
  placeholder,
  type = "text",
  commandDialog,
  setCommandDialog,
}: {
  name: string;
  placeholder?: string;
  type?: string;
  commandDialog: CommandDialogState;
  setCommandDialog: (d: CommandDialogState | null) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{name}</label>
      <input
        type={type}
        value={commandDialog.params[name] || ""}
        onChange={(e) =>
          updateParam(commandDialog, setCommandDialog, name, e.target.value)
        }
        placeholder={placeholder}
        className="w-full h-8 px-3 text-sm border rounded-md bg-background"
      />
    </div>
  );
}

/**
 * Multi-value tag input backing the search `add-pattern` parameter.
 * Each value becomes a repeated `-P` flag (OR) at serialization time.
 */
export function PatternListInput({
  commandDialog,
  setCommandDialog,
}: {
  commandDialog: CommandDialogState;
  setCommandDialog: (d: CommandDialogState | null) => void;
}) {
  const { t } = useLanguage();
  const raw = commandDialog.params["add-pattern"];
  const values = Array.isArray(raw)
    ? raw.filter((v) => v !== undefined && v !== null)
    : raw
      ? [raw]
      : [];

  return (
    <div>
      <label className="text-sm font-medium">add-pattern</label>
      <MultiValueInput
        values={values}
        onChange={(v) =>
          updateParam(commandDialog, setCommandDialog, "add-pattern", v)
        }
        placeholder={t.searchMultiPatternPlaceholder}
      />
    </div>
  );
}
