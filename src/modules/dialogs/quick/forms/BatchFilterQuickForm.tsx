import { useState } from "react";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  BatchFilterDraft,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { BatchFilterFields } from "@/modules/dialogs/command/forms/batch-filter";

export function BatchFilterQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const [params, setParams] = useState<Record<string, any>>({
    "filter-type": "text",
    "text-operator": "equals",
    "value-mode": "manual",
    column: "",
  });

  const draft: BatchFilterDraft = { kind: "batch-filter", params };
  const result = params.column ? buildQuickCommand(draft, labels) : null;

  return (
    <QuickActionShell
      title={t.batchFilter}
      anchor={request}
      width={360}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <BatchFilterFields params={params} onChange={setParams} />
    </QuickActionShell>
  );
}
