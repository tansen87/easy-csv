import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  GroupAggregateDraft,
  GroupAggregateKind,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

export function GroupAggregateQuickForm({
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
  const [aggregate, setAggregate] = useState<GroupAggregateKind>("count");
  const [target, setTarget] = useState(request.headers[0] || "");

  const aggregations: { label: string; value: GroupAggregateKind }[] = [
    { label: t.pivotAggCount, value: "count" },
    { label: t.pivotAggSum, value: "sum" },
    { label: t.pivotAggAvg, value: "avg" },
    { label: t.pivotAggMin, value: "min" },
    { label: t.pivotAggMax, value: "max" },
  ];
  const aggregateLabel =
    aggregations.find((option) => option.value === aggregate)?.label ??
    aggregate;

  const draft: GroupAggregateDraft = {
    kind: "groupby",
    column,
    aggregate,
    target,
  };
  const result = buildQuickCommand(draft, labels);
  const detail =
    aggregate === "count"
      ? `${column} · ${aggregateLabel}`
      : `${column} · ${aggregateLabel} ${target}`;

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.groupAggregateAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={320}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={
        !result
          ? column
            ? t.groupTargetLabel
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

      <Field label={t.groupAggregateLabel}>
        <Select
          value={aggregate}
          onChange={(value) => setAggregate(value as GroupAggregateKind)}
          options={aggregations}
          placeholder={t.groupAggregateLabel}
          ariaLabel={t.groupAggregateLabel}
          portal
          height="h-7"
        />
      </Field>

      {aggregate !== "count" && (
        <Field label={t.groupTargetLabel}>
          <Select
            value={target}
            onChange={setTarget}
            options={request.headers.map((h) => ({ label: h, value: h }))}
            placeholder={t.selectColumn}
            ariaLabel={t.groupTargetLabel}
            portal
            height="h-7"
          />
        </Field>
      )}
    </QuickActionShell>
  );
}
