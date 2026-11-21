import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  QuickFormProps,
  TopRowsDraft,
} from "@/modules/dialogs/quick/types";
import { CheckRow, Field, QuickInput } from "./_shared";

export function TopRowsQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const [column, setColumn] = useState(
    request.col !== undefined
      ? request.headers[request.col] || ""
      : request.headers[0] || "",
  );
  const [limit, setLimit] = useState("10");
  const [reverse, setReverse] = useState(false);

  const draft: TopRowsDraft = { kind: "top", column, limit, reverse };
  const result = buildQuickCommand(draft, labels);
  const detail = `${column} · ${t.topLimitLabel} ${limit}${
    reverse ? ` · ${t.topReverseLabel}` : ""
  }`;

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.topRowsAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={280}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={
        !result
          ? column
            ? t.topLimitLabel
            : t.filterColumn
          : undefined
      }
      canApply={!!result}
      onApply={apply}
      onAdvanced={advanced}
      onClose={onClose}
    >
      <Field label={t.filterColumn}>
        <Select
          value={column}
          onChange={setColumn}
          options={request.headers.map((h) => ({ label: h, value: h }))}
          placeholder={t.selectColumn}
          ariaLabel={t.filterColumn}
          portal
          height="h-7"
        />
      </Field>

      <Field label={t.topLimitLabel}>
        <QuickInput
          type="number"
          min={1}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </Field>

      <CheckRow
        checked={reverse}
        onChange={setReverse}
        label={t.topReverseLabel}
      />
    </QuickActionShell>
  );
}
