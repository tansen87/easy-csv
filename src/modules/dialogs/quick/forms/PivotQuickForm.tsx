import { useState } from "react";
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
import {
  AddButton,
  ColumnPicker,
  DeleteButton,
  Field,
  QuickInput,
  SectionHeader,
} from "./_shared";

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
  const valueCount = t.quickCountValues.replace(
    "{count}",
    String(values.length),
  );

  return (
    <QuickActionShell
      title={t.pivotAction}
      anchor={request}
      width={360}
      summary={result ? { command: result.type, detail: valueCount } : undefined}
      blocked={!result ? t.pivotValues : undefined}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        label={t.pivotColumns}
        meta={String(columns.length)}
        columns={request.headers}
        selected={columns}
        onToggle={(column) => toggle(setColumns, column)}
        searchPlaceholder={t.pivotSearchColumns}
        noMatches={t.pivotNoMatches}
        height={84}
      />

      <ColumnPicker
        label={t.pivotRows}
        meta={String(groupBy.length)}
        columns={request.headers}
        selected={groupBy}
        onToggle={(column) => toggle(setGroupBy, column)}
        searchPlaceholder={t.pivotSearchColumns}
        noMatches={t.pivotNoMatches}
        height={84}
      />

      <div>
        <SectionHeader
          label={t.pivotValues}
          meta={valueCount}
          action={<AddButton label={t.pivotAdd} onClick={addValue} />}
        />

        {values.length === 0 ? (
          <div className="rounded-md border border-dashed py-1.5 text-center text-[11.5px] text-muted-foreground/70">
            {t.pivotClickToAdd}
          </div>
        ) : (
          <div className="border-t">
            {values.map((value, index) => (
              <div
                key={index}
                className="grid grid-cols-[18px_minmax(0,1fr)_22px] items-center gap-2 border-b py-1.5 last:border-b-0"
              >
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex min-w-0 items-center gap-1.5">
                  <Select
                    value={value.column}
                    onChange={(v) => updateValue(index, "column", v)}
                    options={request.headers.map((h) => ({
                      label: h,
                      value: h,
                    }))}
                    placeholder={t.selectColumn}
                    ariaLabel={t.selectColumn}
                    portal
                    height="h-7"
                  />
                  <div className="w-[88px] shrink-0">
                    <Select
                      value={value.aggregation}
                      onChange={(v) => updateValue(index, "aggregation", v)}
                      options={aggregations}
                      placeholder={t.pivotAggPlaceholder}
                      ariaLabel={t.pivotAggPlaceholder}
                      portal
                    height="h-7"
                    />
                  </div>
                </div>
                <DeleteButton
                  label={t.cancel}
                  onClick={() =>
                    setValues((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Field label={t.pivotColumnSeparator}>
        <QuickInput
          value={columnSep}
          onChange={(e) => setColumnSep(e.target.value)}
          placeholder={t.pivotColumnSeparatorPlaceholder}
          maxLength={1}
          className="font-mono w-[72px]"
        />
      </Field>
    </QuickActionShell>
  );
}
