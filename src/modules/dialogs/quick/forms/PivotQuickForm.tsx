import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  PivotDraft,
  PivotValueDraft,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { ColumnPicker, Field } from "./_shared";

export function PivotQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const [columns, setColumns] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [values, setValues] = useState<PivotValueDraft[]>([]);
  const [columnSep, setColumnSep] = useState("_");

  const aggregations = [
    { label: t.pivotAggCount, value: "count" },
    { label: t.pivotAggSum, value: "sum" },
    { label: t.pivotAggAvg, value: "avg" },
    { label: t.pivotAggMin, value: "min" },
    { label: t.pivotAggMax, value: "max" },
    { label: t.pivotAggFirst, value: "first" },
    { label: t.pivotAggLast, value: "last" },
  ];

  const toggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    column: string,
  ) =>
    setter((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column],
    );

  const availableForValues = request.headers.filter(
    (h) => !columns.includes(h) && !values.some((v) => v.column === h),
  );

  const addValue = () => {
    if (availableForValues.length === 0) return;
    setValues((prev) => [
      ...prev,
      { column: availableForValues[0], aggregation: "count" },
    ]);
  };

  const updateValue = (
    index: number,
    field: keyof PivotValueDraft,
    value: string,
  ) => {
    setValues((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)),
    );
  };

  const draft: PivotDraft = {
    kind: "pivot",
    columns,
    groupBy,
    values,
    columnSep,
  };
  const result = buildQuickCommand(draft, labels);

  return (
    <QuickActionShell
      title={t.pivotAction}
      anchor={request}
      width={360}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        columns={request.headers}
        selected={columns}
        onToggle={(column) => toggle(setColumns, column)}
        searchPlaceholder={t.pivotSearchColumns}
        noMatches={t.pivotNoMatches}
        countLabel={t.pivotColumns}
        height={80}
      />

      <ColumnPicker
        columns={request.headers}
        selected={groupBy}
        onToggle={(column) => toggle(setGroupBy, column)}
        searchPlaceholder={t.pivotSearchColumns}
        noMatches={t.pivotNoMatches}
        countLabel={t.pivotRows}
        height={80}
      />

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.pivotValues}
          </span>
          <button
            type="button"
            onClick={addValue}
            className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.pivotAdd}
          </button>
        </div>

        {values.length === 0 ? (
          <div className="p-2 border rounded-md bg-muted/30 text-xs text-muted-foreground text-center">
            {t.pivotClickToAdd}
          </div>
        ) : (
          <div className="space-y-1.5">
            {values.map((value, index) => (
              <div key={index} className="flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <Select
                    value={value.column}
                    onChange={(v) => updateValue(index, "column", v)}
                    options={request.headers.map((h) => ({
                      label: h,
                      value: h,
                    }))}
                    placeholder={t.selectColumn}
                    ariaLabel={t.selectColumn}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Select
                    value={value.aggregation}
                    onChange={(v) => updateValue(index, "aggregation", v)}
                    options={aggregations}
                    placeholder={t.pivotAggPlaceholder}
                    ariaLabel={t.pivotAggPlaceholder}
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setValues((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
                  aria-label={t.cancel}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label={t.pivotColumnSeparator}>
        <input
          type="text"
          value={columnSep}
          onChange={(e) => setColumnSep(e.target.value)}
          placeholder={t.pivotColumnSeparatorPlaceholder}
          maxLength={1}
          className="w-full h-7 px-2 text-xs border rounded-md bg-background"
        />
      </Field>
    </QuickActionShell>
  );
}
