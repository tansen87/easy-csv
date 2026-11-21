import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type { FillDraft, QuickFormProps } from "@/modules/dialogs/quick/types";
import { Field, QuickInput, SegmentedToggle } from "./_shared";

export function FillQuickForm({
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
  const [mode, setMode] = useState<"previous" | "value">("previous");
  const [value, setValue] = useState("");

  const draft: FillDraft = { kind: "fill", column, mode, value };
  const result = buildQuickCommand(draft, labels);
  const detail =
    mode === "value" && value
      ? `${column} · ${t.fillFixedValue} ${value}`
      : `${column} · ${t.fillPreviousValue}`;

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.fillAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={280}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={
        !result
          ? column
            ? t.fillValueLabel
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

      <Field label={t.fillModeLabel}>
        <SegmentedToggle
          value={mode}
          onChange={setMode}
          options={[
            { label: t.fillPreviousValue, value: "previous" },
            { label: t.fillFixedValue, value: "value" },
          ]}
        />
      </Field>

      {mode === "value" && (
        <Field label={t.fillValueLabel}>
          <QuickInput
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t.fillValueLabel}
            autoFocus
          />
        </Field>
      )}
    </QuickActionShell>
  );
}
