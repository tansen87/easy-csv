import { useState } from "react";
import type { SliceKind } from "@/types/dialog";
import { Select } from "@/components/ui/Select";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type { QuickFormProps, SliceDraft } from "@/modules/dialogs/quick/types";
import {
  AddButton,
  DeleteButton,
  Field,
  QuickInput,
  SectionHeader,
} from "./_shared";

export function SliceQuickForm({
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
  const [sliceType, setSliceType] = useState<SliceKind>(request.slice || "split");
  const [separator, setSeparator] = useState("/");
  const [customSeparator, setCustomSeparator] = useState("");
  const [outputColumn, setOutputColumn] = useState("new_col");
  const [leftLength, setLeftLength] = useState("4");
  const [rightLength, setRightLength] = useState("4");
  const [sliceStart, setSliceStart] = useState("0");
  const [sliceEnd, setSliceEnd] = useState("4");
  const [indices, setIndices] = useState<string[]>(["0"]);
  const [joinWith, setJoinWith] = useState("-");

  const separators = [
    { label: t.splitCustom, value: "custom" },
    { label: t.splitSpace, value: " " },
    { label: t.splitTab, value: "\\t" },
    { label: t.splitComma, value: "," },
    { label: t.splitSemicolon, value: ";" },
    { label: t.splitPipe, value: "|" },
    { label: t.splitHyphen, value: "-" },
    { label: t.splitUnderscore, value: "_" },
    { label: t.splitColon, value: ":" },
    { label: t.splitSlash, value: "/" },
  ];

  const sliceOptions: { label: string; value: SliceKind }[] = [
    { label: t.sliceLeft, value: "left" },
    { label: t.sliceRight, value: "right" },
    { label: t.sliceSlice, value: "slice" },
    { label: t.sliceSplit, value: "split" },
  ];

  const draft: SliceDraft = {
    kind: "slice",
    column,
    sliceType,
    leftLength,
    rightLength,
    sliceStart,
    sliceEnd,
    separator,
    customSeparator,
    indices,
    joinWith,
    outputColumn,
  };
  const result = buildQuickCommand(draft, labels);
  const sliceLabel =
    sliceOptions.find((o) => o.value === sliceType)?.label || sliceType;

  const updateIndex = (index: number, value: string) => {
    setIndices((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  return (
    <QuickActionShell
      title={t.splitAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={288}
      summary={
        result
          ? { command: result.type, detail: `${column} · ${sliceLabel}` }
          : undefined
      }
      blocked={
        !result
          ? !column
            ? t.filterColumn
            : t.splitCustomSeparator
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
          placeholder={t.splitSearchColumn}
          ariaLabel={t.filterColumn}
          portal
          height="h-7"
        />
      </Field>

      <Field label={t.splitOperationType}>
        <Select
          value={sliceType}
          onChange={(v) => setSliceType(v as SliceKind)}
          options={sliceOptions}
          placeholder={t.splitSelectOperation}
          ariaLabel={t.splitOperationType}
          portal
          height="h-7"
        />
      </Field>

      {sliceType === "left" && (
        <Field label={t.splitLength}>
          <QuickInput
            type="number"
            value={leftLength}
            onChange={(e) => setLeftLength(e.target.value)}
          />
        </Field>
      )}

      {sliceType === "right" && (
        <Field label={t.splitLength}>
          <QuickInput
            type="number"
            value={rightLength}
            onChange={(e) => setRightLength(e.target.value)}
          />
        </Field>
      )}

      {sliceType === "slice" && (
        <>
          <Field label={t.splitStartIndex}>
            <QuickInput
              type="number"
              value={sliceStart}
              onChange={(e) => setSliceStart(e.target.value)}
            />
          </Field>
          <Field label={t.splitEndIndex}>
            <QuickInput
              type="number"
              value={sliceEnd}
              onChange={(e) => setSliceEnd(e.target.value)}
            />
          </Field>
        </>
      )}

      {sliceType === "split" && (
        <>
          <Field label={t.splitSeparator}>
            <Select
              value={separator}
              onChange={setSeparator}
              options={separators}
              placeholder={t.splitSelectSeparator}
              ariaLabel={t.splitSeparator}
              portal
          height="h-7"
            />
          </Field>

          {separator === "custom" && (
            <Field label={t.splitCustomSeparator}>
              <QuickInput
                value={customSeparator}
                onChange={(e) => setCustomSeparator(e.target.value)}
                placeholder={t.splitCustomSeparatorPlaceholder}
              />
              <VariableHint value={customSeparator} />
            </Field>
          )}

          <div>
            <SectionHeader
              label={t.splitArrayIndices}
              action={
                <AddButton
                  label={t.pivotAdd}
                  onClick={() => setIndices((prev) => [...prev, ""])}
                />
              }
            />
            <div className="flex flex-col gap-1.5">
              {indices.map((index, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_22px] items-center gap-1.5"
                >
                  <QuickInput
                    value={index}
                    onChange={(e) => updateIndex(i, e.target.value)}
                    placeholder="0"
                    className="font-mono"
                  />
                  {indices.length > 1 && (
                    <DeleteButton
                      label={t.cancel}
                      onClick={() =>
                        setIndices((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Field label={t.splitJoinWith}>
            <QuickInput
              value={joinWith}
              onChange={(e) => setJoinWith(e.target.value)}
              placeholder={t.splitJoinWithPlaceholder}
            />
            <VariableHint value={joinWith} />
          </Field>
        </>
      )}

      <Field label={t.splitAlias}>
        <QuickInput
          value={outputColumn}
          onChange={(e) => setOutputColumn(e.target.value)}
          placeholder={t.splitAliasPlaceholder}
        />
      </Field>
    </QuickActionShell>
  );
}
