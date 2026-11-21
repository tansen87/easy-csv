import { useState } from "react";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  QuickFormProps,
  RenameColumnDraft,
} from "@/modules/dialogs/quick/types";
import { Field, QuickInput } from "./_shared";

export function RenameColumnQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const column =
    request.col !== undefined
      ? request.headers[request.col] || ""
      : request.headers[0] || "";
  const [newName, setNewName] = useState(column);

  const draft: RenameColumnDraft = {
    kind: "rename-column",
    column,
    newName,
    headers: request.headers,
  };
  const result = buildQuickCommand(draft, labels);
  const detail = `${column} → ${newName.trim() || "…"}`;

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.renameColumnAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={280}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={!result ? t.renameNewNameLabel : undefined}
      canApply={!!result}
      onApply={apply}
      onAdvanced={advanced}
      onClose={onClose}
    >
      <Field label={t.renameNewNameLabel}>
        <QuickInput
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={t.renameNewNameLabel}
          autoFocus
        />
      </Field>
    </QuickActionShell>
  );
}
