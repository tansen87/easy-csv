import { CommandFormProps } from "@/types/dialog";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

interface BatchFilterFieldsProps {
  params: Record<string, any>;
  onChange: (params: Record<string, any>) => void;
  /** Compact type and 28px controls for the right-click panel (design 055). */
  dense?: boolean;
}

/** Field body shared by the unified command form and the quick-action form. */
export function BatchFilterFields({
  params,
  onChange,
  dense = false,
}: BatchFilterFieldsProps) {
  const { t } = useLanguage();
  const update = (patch: Record<string, any>) =>
    onChange({ ...params, ...patch });

  const labelClass = dense
    ? "mb-1 block text-[11.5px] text-muted-foreground"
    : "text-sm font-medium";
  const inputClass = dense
    ? "h-7 w-full rounded-md border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40"
    : "w-full h-8 px-3 text-sm border rounded-md bg-background";
  const gridClass = dense ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-4";

  return (
    <div className={dense ? "flex flex-col gap-2" : "space-y-3"}>
      <div className={gridClass}>
        <div>
          <label className={labelClass}>{t.filterColumn}</label>
          <input
            type="text"
            value={params.column || ""}
            onChange={(e) => update({ column: e.target.value })}
            placeholder={t.filterColumnToFilterOn}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t.filterType}</label>
          <Select
            value={params["filter-type"] || "text"}
            onChange={(value) => {
              const newParams: Record<string, any> = {
                ...params,
                "filter-type": value,
              };
              // Clear the opposite operator when switching types
              if (value === "text") {
                delete newParams["number-operator"];
                if (!newParams["text-operator"]) {
                  newParams["text-operator"] = "equals";
                }
              } else {
                delete newParams["text-operator"];
                if (!newParams["number-operator"]) {
                  newParams["number-operator"] = "equals";
                }
              }
              onChange(newParams);
            }}
            options={[
              { label: t.text, value: "text" },
              { label: t.number, value: "number" },
            ]}
            placeholder={t.selectType}
            portal={dense}
            height={dense ? "h-7" : undefined}
          />
        </div>
      </div>
      <div className={gridClass}>
        <div>
          <label className={labelClass}>{t.filterOperator}</label>
          <Select
            value={
              params["text-operator"] || params["number-operator"] || "equals"
            }
            onChange={(value) => {
              if (params["filter-type"] === "number") {
                update({ "number-operator": value });
              } else {
                update({ "text-operator": value });
              }
            }}
            options={
              params["filter-type"] === "number"
                ? [
                    { label: "==", value: "equals" },
                    { label: "!=", value: "not_equals" },
                    { label: ">", value: "greater_than" },
                    { label: ">=", value: "greater_or_equal" },
                    { label: "<", value: "less_than" },
                    { label: "<=", value: "less_or_equal" },
                  ]
                : [
                    { label: t.opEquals, value: "equals" },
                    { label: t.opNotEquals, value: "not_equals" },
                    { label: t.opStartsWith, value: "starts_with" },
                    { label: t.opNotStartsWith, value: "not_starts_with" },
                    { label: t.opEndsWith, value: "ends_with" },
                    { label: t.opNotEndsWith, value: "not_ends_with" },
                    { label: t.opContains, value: "contains" },
                    { label: t.opNotContains, value: "not_contains" },
                    { label: t.opRegex, value: "regex" },
                    { label: t.opIsNull, value: "is_null" },
                    { label: t.opIsNotNull, value: "is_not_null" },
                  ]
            }
            placeholder={t.selectOperator}
            portal={dense}
            height={dense ? "h-7" : undefined}
          />
        </div>
        <div>
          <label className={labelClass}>{t.valueSource}</label>
          <Select
            value={params["value-mode"] || "manual"}
            onChange={(value) => {
              const newParams: Record<string, any> = {
                ...params,
                "value-mode": value,
              };
              // Auto-select extract-column to current column when switching to "column" mode
              if (value === "column" && !newParams["extract-column"]) {
                newParams["extract-column"] = params.column || "";
              }
              onChange(newParams);
            }}
            options={[
              { label: t.manualInput, value: "manual" },
              { label: t.fromColumn, value: "column" },
            ]}
            placeholder={t.selectSource}
            portal={dense}
            height={dense ? "h-7" : undefined}
          />
        </div>
      </div>
      {params["value-mode"] === "manual" ? (
        <div>
          <label className={labelClass}>{t.valuesOnePerLine}</label>
          <textarea
            value={params["manual-values"] || ""}
            onChange={(e) => update({ "manual-values": e.target.value })}
            placeholder={"value1\nvalue2\nvalue3"}
            className={cn(
              "w-full resize-none rounded-md border bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring expr-editor-scrollbar",
              dense ? "h-20 px-2 py-1 text-xs" : "h-24 px-3 text-sm",
            )}
          />
        </div>
      ) : (
        <div>
          <label className={labelClass}>{t.extractColumn}</label>
          <input
            type="text"
            value={params["extract-column"] || ""}
            onChange={(e) => update({ "extract-column": e.target.value })}
            placeholder={t.extractColumnPlaceholder}
            className={inputClass}
          />
        </div>
      )}
      <div>
        <label className={labelClass}>{t.outputDirectoryOptional}</label>
        <input
          type="text"
          value={params["output-dir"] || ""}
          onChange={(e) => update({ "output-dir": e.target.value })}
          placeholder={t.sameAsSourceFile}
          className={inputClass}
        />
      </div>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-2",
          dense ? "text-xs" : "text-sm",
        )}
      >
        <input
          type="checkbox"
          checked={params["case-insensitive"] || false}
          onChange={(e) => update({ "case-insensitive": e.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        {t.ignoreCase}
      </label>
    </div>
  );
}

export function BatchFilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.column}>
      <BatchFilterFields
        params={commandDialog.params}
        onChange={(params) => setCommandDialog({ ...commandDialog, params })}
      />
    </CommandFormShell>
  );
}
