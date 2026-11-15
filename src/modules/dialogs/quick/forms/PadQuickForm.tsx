import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  PadDraft,
  PadDraftKind,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { Field, QuickInput } from "./_shared";

export function PadQuickForm({
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
  const [padType, setPadType] = useState<PadDraftKind>(
    request.pad === "lpad" ? "lpad" : "pad",
  );
  const [width, setWidth] = useState("10");
  const [char, setChar] = useState("");

  const padOptions: { label: string; value: PadDraftKind }[] = [
    { label: t.padTypePad, value: "pad" },
    { label: t.padTypeLpad, value: "lpad" },
    { label: t.padTypeRpad, value: "rpad" },
  ];

  const draft: PadDraft = { kind: "pad", column, padType, width, char };
  const result = buildQuickCommand(draft, labels);
  const padLabel =
    padOptions.find((o) => o.value === padType)?.label || padType;

  return (
    <QuickActionShell
      title={t.padAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={288}
      summary={
        result
          ? { command: result.type, detail: `${column} · ${padLabel}` }
          : undefined
      }
      blocked={
        !result
          ? !column
            ? t.filterColumn
            : t.padWidth
          : undefined
      }
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
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

      <Field label={t.padPadType}>
        <Select
          value={padType}
          onChange={(v) => setPadType(v as PadDraftKind)}
          options={padOptions}
          placeholder={t.padSelectType}
          ariaLabel={t.padPadType}
          portal
          height="h-7"
        />
      </Field>

      <Field label={t.padWidth}>
        <QuickInput
          type="number"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          placeholder={t.padWidthPlaceholder}
        />
      </Field>

      <Field label={t.padCharacter}>
        <QuickInput
          value={char}
          onChange={(e) => setChar(e.target.value)}
          placeholder={t.padCharacterPlaceholder}
        />
      </Field>
    </QuickActionShell>
  );
}
