import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  PadDraft,
  PadDraftKind,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

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

  const draft: PadDraft = { kind: "pad", column, padType, width, char };
  const result = buildQuickCommand(draft, labels);

  return (
    <QuickActionShell
      title={t.padAction}
      anchor={request}
      width={240}
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
        />
      </Field>

      <Field label={t.padPadType}>
        <Select
          value={padType}
          onChange={(v) => setPadType(v as PadDraftKind)}
          options={[
            { label: t.padTypePad, value: "pad" },
            { label: t.padTypeLpad, value: "lpad" },
            { label: t.padTypeRpad, value: "rpad" },
          ]}
          placeholder={t.padSelectType}
          ariaLabel={t.padPadType}
        />
      </Field>

      <Field label={t.padWidth}>
        <input
          type="number"
          value={width}
          onChange={(e) => setWidth(e.target.value)}
          placeholder={t.padWidthPlaceholder}
          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
        />
      </Field>

      <Field label={t.padCharacter}>
        <input
          type="text"
          value={char}
          onChange={(e) => setChar(e.target.value)}
          placeholder={t.padCharacterPlaceholder}
          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
        />
      </Field>
    </QuickActionShell>
  );
}
