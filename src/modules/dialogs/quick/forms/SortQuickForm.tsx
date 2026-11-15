import { useState } from "react";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type { QuickFormProps, SortDraft } from "@/modules/dialogs/quick/types";
import {
  CheckRow,
  ColumnPicker,
  Field,
  SegmentedToggle,
} from "./_shared";

export function SortQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const clicked =
    request.col !== undefined ? request.headers[request.col] : undefined;
  const [columns, setColumns] = useState<string[]>(clicked ? [clicked] : []);
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [numeric, setNumeric] = useState(false);

  const toggleColumn = (column: string) => {
    setColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column],
    );
  };

  const draft: SortDraft = { kind: "sort", columns, order, numeric };
  const result = buildQuickCommand(draft, labels);
  const orderLabel = order === "asc" ? t.chartSortAsc : t.chartSortDesc;
  const detail = `${columns.join(", ")} · ${orderLabel}${
    numeric ? ` · ${t.sortNumeric}` : ""
  }`;

  return (
    <QuickActionShell
      title={t.sortAction}
      scope={quickScope(request, clicked)}
      anchor={request}
      width={320}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={!result ? t.filterColumn : undefined}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        label={t.filterColumn}
        meta={`${t.quickSelected} ${columns.length}`}
        columns={request.headers}
        selected={columns}
        onToggle={toggleColumn}
        searchPlaceholder={t.sortSearchColumns}
        noMatches={t.sortNoMatches}
      />

      <Field label={t.sortOrder}>
        <SegmentedToggle
          value={order}
          onChange={setOrder}
          options={[
            { label: t.chartSortAsc, value: "asc" },
            { label: t.chartSortDesc, value: "desc" },
          ]}
        />
      </Field>

      <CheckRow
        checked={numeric}
        onChange={setNumeric}
        label={t.sortNumeric}
      />
    </QuickActionShell>
  );
}
