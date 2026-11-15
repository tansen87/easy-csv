import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { MultiValueInput } from "@/components/ui/MultiValueInput";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  FilterDraft,
  NumberFilterOperator,
  QuickFormProps,
  TextFilterOperator,
} from "@/modules/dialogs/quick/types";
import {
  CheckRow,
  Field,
  QuickInput,
  SegmentedTabs,
} from "./_shared";

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

  const operatorSymbol =
    mode === "number"
      ? numberOperators.find((o) => o.value === numberOperator)?.label || ""
      : textOperator === "equals"
        ? "="
        : textOperator === "not_equals"
          ? "≠"
          : textOperators.find((o) => o.value === textOperator)?.label || "";
  const valueText = values.filter((v) => v.trim()).join(", ");
  const detail =
    mode === "text" && !needsValue
      ? `${column} ${operatorSymbol}`
      : `${column} ${operatorSymbol} ${mode === "number" ? numberValue.trim() : valueText}`;

  const apply = () => result && onApply(result);
  const advanced = () => result && onAdvanced(result);

  return (
    <QuickActionShell
      title={t.filterAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={288}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={!result ? (column ? t.value : t.filterColumn) : undefined}
      canApply={!!result}
      onApply={apply}
      onAdvanced={advanced}
      onClose={onClose}
    >
      <SegmentedTabs
        value={mode}
        onChange={setMode}
        options={[
          { label: t.text, value: "text" },
          { label: t.number, value: "number" },
        ]}
      />

      <div className="flex flex-col gap-2">
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

        {mode === "text" ? (
          <>
            <Field label={t.filterOperator}>
              <Select
                value={textOperator}
                onChange={(v) => setTextOperator(v as TextFilterOperator)}
                options={textOperators}
                placeholder={t.selectOperator}
                ariaLabel={t.filterOperator}
                portal
            height="h-7"
              />
            </Field>

            {needsValue && (
              <Field
                label={textOperator === "regex" ? t.regexPatterns : t.value}
                stack
              >
                <MultiValueInput
                  values={values}
                  onChange={setValues}
                  placeholder={
                    textOperator === "regex" ? t.regexPatterns : t.addValuesEnter
                  }
                  dense
                />
                <VariableHint value={values.join(" ")} />
              </Field>
            )}

            <CheckRow
              checked={ignoreCase}
              onChange={setIgnoreCase}
              label={t.ignoreCase}
            />
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
                portal
            height="h-7"
              />
            </Field>
            <Field label={t.value}>
              <QuickInput
                type="number"
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                placeholder={t.searchNumber}
              />
            </Field>
          </>
        )}
      </div>
    </QuickActionShell>
  );
}
