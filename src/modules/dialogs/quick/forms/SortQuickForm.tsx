import { useState } from "react";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type { QuickFormProps, SortDraft } from "@/modules/dialogs/quick/types";
import { ColumnPicker, Field, SegmentedToggle } from "./_shared";

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

  return (
    <QuickActionShell
      title={t.sortAction}
      anchor={request}
      width={280}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        columns={request.headers}
        selected={columns}
        onToggle={toggleColumn}
        searchPlaceholder={t.sortSearchColumns}
        noMatches={t.sortNoMatches}
        countLabel={t.sortColumnsSelected.replace(
          "{count}",
          String(columns.length),
        )}
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

      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={numeric}
          onChange={(e) => setNumeric(e.target.checked)}
          className="h-3.5 w-3.5 accent-foreground"
        />
        {t.sortNumeric}
      </label>
    </QuickActionShell>
  );
}
