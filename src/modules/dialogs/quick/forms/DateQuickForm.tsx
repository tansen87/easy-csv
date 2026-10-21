import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import {
  DATE_FORMATS,
  DATE_INPUT_DEFAULT,
  DATE_OUTPUT_COLUMN_DEFAULT,
  DATE_OUTPUT_DEFAULT,
} from "@/modules/dialogs/quick/lib/dateFormats";
import type { DateDraft, QuickFormProps } from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

export function DateQuickForm({
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
  const [inputFormat, setInputFormat] = useState(DATE_INPUT_DEFAULT);
  const [outputFormat, setOutputFormat] = useState(DATE_OUTPUT_DEFAULT);
  const [outputColumn, setOutputColumn] = useState(DATE_OUTPUT_COLUMN_DEFAULT);

  const draft: DateDraft = {
    kind: "date",
    column,
    inputFormat,
    outputFormat,
    outputColumn,
  };
  const result = buildQuickCommand(draft, labels);

  return (
    <QuickActionShell
      title={t.dateAction}
      anchor={request}
      width={280}
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
          placeholder={t.dateTransformSearchColumn}
          ariaLabel={t.filterColumn}
        />
      </Field>

      <Field label={t.inputFormat}>
        <Select
          value={inputFormat}
          onChange={setInputFormat}
          options={DATE_FORMATS}
          placeholder={t.dateTransformSearchInputFormat}
          ariaLabel={t.inputFormat}
        />
      </Field>

      <Field label={t.outputFormat}>
        <Select
          value={outputFormat}
          onChange={setOutputFormat}
          options={DATE_FORMATS}
          placeholder={t.dateTransformSearchOutputFormat}
          ariaLabel={t.outputFormat}
        />
      </Field>

      <Field label={t.dateTransformAlias}>
        <input
          type="text"
          value={outputColumn}
          onChange={(e) => setOutputColumn(e.target.value)}
          placeholder={t.dateTransformAliasPlaceholder}
          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
        />
      </Field>
    </QuickActionShell>
  );
}
