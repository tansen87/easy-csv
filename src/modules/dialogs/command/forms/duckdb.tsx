import { CommandFormProps } from "@/types/dialog";
import { updateParam } from "@/modules/dialogs/command/lib/helpers";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { DuckdbEditor } from "@/components/expression/DuckdbEditor";
import { useLanguage } from "@/i18n";

export function DuckDBForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog, headers } = props;
  const { effectiveLanguage } = useLanguage();
  const isZh = effectiveLanguage === "zh";
  const sql = (commandDialog.params.sql as string) || "";

  return (
    <CommandFormShell {...props} disabled={!sql.trim()}>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">
            {isZh ? "SQL 查询" : "SQL Query"}
          </label>
          <DuckdbEditor
            value={sql}
            onChange={(v) =>
              updateParam(commandDialog, setCommandDialog, "sql", v)
            }
            columns={headers ?? []}
            autoFocus
          />
        </div>
      </div>
    </CommandFormShell>
  );
}
