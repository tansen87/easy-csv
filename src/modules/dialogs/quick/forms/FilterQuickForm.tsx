import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { MultiValueInput } from "@/components/ui/MultiValueInput";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  FilterDraft,
  NumberFilterOperator,
  QuickFormProps,
  TextFilterOperator,
} from "@/modules/dialogs/quick/types";
import { Field, SegmentedToggle } from "./_shared";

export function FilterQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const [mode, setMode] = useState<"text" | "number">("text");
  const [column, setColumn] = useState(
    request.col !== undefined
      ? request.headers[request.col] || ""
      : request.headers[0] || "",
  );
  const [textOperator, setTextOperator] = useState<TextFilterOperator>("equals");
  const [numberOperator, setNumberOperator] =
    useState<NumberFilterOperator>("equals");
  const [values, setValues] = useState<string[]>([]);
  const [numberValue, setNumberValue] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);

  const textOperators: { label: string; value: TextFilterOperator }[] = [
    { label: t.opEquals, value: "equals" },
    { label: t.opNotEquals, value: "not_equals" },
    { label: t.opStartsWith, value: "starts_with" },
    { label: t.opNotStartsWith, value: "not_starts_with" },
    { label: t.opEndsWith, value: "ends_with" },
    { label: t.opNotEndsWith, value: "not_ends_with" },
    { label: t.opContains, value: "contains" },
    { label: t.opNotContains, value: "not_contains" },
    { label: t.opRegex, value: "regex" },
    { label: t.opIsNull, value: "is_null" },
    { label: t.opIsNotNull, value: "is_not_null" },
  ];

  const numberOperators: { label: string; value: NumberFilterOperator }[] = [
    { label: "==", value: "equals" },
    { label: "!=", value: "not_equals" },
    { label: ">", value: "greater_than" },
    { label: ">=", value: "greater_or_equal" },
    { label: "<", value: "less_than" },
    { label: "<=", value: "less_or_equal" },
  ];

  const needsValue =
    mode === "number" ||
    (textOperator !== "is_null" && textOperator !== "is_not_null");

  const draft: FilterDraft = {
    kind: "filter",
    mode,
    column,
    textOperator,
    numberOperator,
    values,
    numberValue,
    ignoreCase,
  };
  const result = buildQuickCommand(draft, labels);

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.filterAction}
      anchor={request}
      width={240}
      maxHeight="min(56vh, 560px)"
      bodyMinHeight="min(33vh, 560px)"
      canApply={!!result}
      onApply={apply}
      onAdvanced={advanced}
      onClose={onClose}
    >
      <SegmentedToggle
        value={mode}
        onChange={setMode}
        options={[
          { label: t.text, value: "text" },
          { label: t.number, value: "number" },
        ]}
      />

      <Field label={t.filterColumn}>
        <Select
          value={column}
          onChange={setColumn}
          options={request.headers.map((h) => ({ label: h, value: h }))}
          placeholder={t.selectColumn}
          ariaLabel={t.filterColumn}
        />
      </Field>

      {mode === "text" ? (
        <>
          <Field label={t.filterOperator}>
            <Select
              value={textOperator}
              onChange={(v) => setTextOperator(v as TextFilterOperator)}
              options={textOperators}
              placeholder={t.selectOperator}
              ariaLabel={t.filterOperator}
            />
          </Field>

          {needsValue && (
            <>
              <Field
                label={textOperator === "regex" ? t.regexPatterns : t.value}
              >
                <MultiValueInput
                  values={values}
                  onChange={setValues}
                  placeholder={
                    textOperator === "regex" ? t.regexPatterns : t.addValuesEnter
                  }
                />
                <VariableHint value={values.join(" ")} />
              </Field>

              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignoreCase}
                  onChange={(e) => setIgnoreCase(e.target.checked)}
                  className="h-3.5 w-3.5 accent-foreground"
                />
                {t.ignoreCase}
              </label>
            </>
          )}
        </>
      ) : (
        <>
          <Field label={t.filterOperator}>
            <Select
              value={numberOperator}
              onChange={(v) => setNumberOperator(v as NumberFilterOperator)}
              options={numberOperators}
              placeholder={t.selectOperator}
              ariaLabel={t.filterOperator}
            />
          </Field>
          <Field label={t.value}>
            <input
              type="number"
              value={numberValue}
              onChange={(e) => setNumberValue(e.target.value)}
              placeholder={t.searchNumber}
              className="w-full h-7 px-3 text-sm border rounded-md bg-background"
            />
          </Field>
        </>
      )}
    </QuickActionShell>
  );
}
