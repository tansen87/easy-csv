import { CommandFormProps } from "@/types/dialog";
import { CommandFormShell } from "@/modules/dialogs/command/CommandFormShell";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";

export function BatchFilterForm(props: CommandFormProps) {
  const { commandDialog, setCommandDialog } = props;
  const { t } = useLanguage();
  return (
    <CommandFormShell {...props} disabled={!commandDialog.params.column}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t.filterColumn}</label>
            <input
              type="text"
              value={commandDialog.params.column || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: { ...commandDialog.params, column: e.target.value },
                })
              }
              placeholder={t.filterColumnToFilterOn}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t.filterType}</label>
            <Select
              value={commandDialog.params["filter-type"] || "text"}
              onChange={(value) => {
                const newParams: Record<string, any> = {
                  ...commandDialog.params,
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
                setCommandDialog({
                  ...commandDialog,
                  params: newParams,
                });
              }}
              options={[
                { label: t.text, value: "text" },
                { label: t.number, value: "number" },
              ]}
              placeholder={t.selectType}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t.filterOperator}</label>
            <Select
              value={
                commandDialog.params["text-operator"] ||
                commandDialog.params["number-operator"] ||
                "equals"
              }
              onChange={(value) => {
                if (commandDialog.params["filter-type"] === "number") {
                  setCommandDialog({
                    ...commandDialog,
                    params: {
                      ...commandDialog.params,
                      "number-operator": value,
                    },
                  });
                } else {
                  setCommandDialog({
                    ...commandDialog,
                    params: { ...commandDialog.params, "text-operator": value },
                  });
                }
              }}
              options={
                commandDialog.params["filter-type"] === "number"
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
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t.valueSource}</label>
            <Select
              value={commandDialog.params["value-mode"] || "manual"}
              onChange={(value) => {
                const newParams: Record<string, any> = {
                  ...commandDialog.params,
                  "value-mode": value,
                };
                // Auto-select extract-column to current column when switching to "column" mode
                if (value === "column" && !newParams["extract-column"]) {
                  newParams["extract-column"] =
                    commandDialog.params.column || "";
                }
                setCommandDialog({
                  ...commandDialog,
                  params: newParams,
                });
              }}
              options={[
                { label: t.manualInput, value: "manual" },
                { label: t.fromColumn, value: "column" },
              ]}
              placeholder={t.selectSource}
            />
          </div>
        </div>
        {commandDialog.params["value-mode"] === "manual" ? (
          <div>
            <label className="text-sm font-medium">{t.valuesOnePerLine}</label>
            <textarea
              value={commandDialog.params["manual-values"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "manual-values": e.target.value,
                  },
                })
              }
              placeholder={"value1\nvalue2\nvalue3"}
              className="w-full h-24 px-3 text-sm border rounded-md bg-background resize-none font-mono focus:outline-none focus:ring-2 focus:ring-ring expr-editor-scrollbar"
            />
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium">{t.extractColumn}</label>
            <input
              type="text"
              value={commandDialog.params["extract-column"] || ""}
              onChange={(e) =>
                setCommandDialog({
                  ...commandDialog,
                  params: {
                    ...commandDialog.params,
                    "extract-column": e.target.value,
                  },
                })
              }
              placeholder={t.extractColumnPlaceholder}
              className="w-full h-8 px-3 text-sm border rounded-md bg-background"
            />
          </div>
        )}
        <div>
          <label className="text-sm font-medium">
            {t.outputDirectoryOptional}
          </label>
          <input
            type="text"
            value={commandDialog.params["output-dir"] || ""}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  "output-dir": e.target.value,
                },
              })
            }
            placeholder={t.sameAsSourceFile}
            className="w-full h-8 px-3 text-sm border rounded-md bg-background"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={commandDialog.params["case-insensitive"] || false}
            onChange={(e) =>
              setCommandDialog({
                ...commandDialog,
                params: {
                  ...commandDialog.params,
                  "case-insensitive": e.target.checked,
                },
              })
            }
            className="h-3.5 w-3.5 accent-foreground"
          />
          {t.ignoreCase}
        </label>
      </div>
    </CommandFormShell>
  );
}
