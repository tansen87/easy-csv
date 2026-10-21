import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { SliceKind } from "@/types/dialog";
import { Select } from "@/components/ui/Select";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type { QuickFormProps, SliceDraft } from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

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

  const updateIndex = (index: number, value: string) => {
    setIndices((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  return (
    <QuickActionShell
      title={t.splitAction}
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
          placeholder={t.splitSearchColumn}
          ariaLabel={t.filterColumn}
        />
      </Field>

      <Field label={t.splitOperationType}>
        <Select
          value={sliceType}
          onChange={(v) => setSliceType(v as SliceKind)}
          options={[
            { label: t.sliceLeft, value: "left" },
            { label: t.sliceRight, value: "right" },
            { label: t.sliceSlice, value: "slice" },
            { label: t.sliceSplit, value: "split" },
          ]}
          placeholder={t.splitSelectOperation}
          ariaLabel={t.splitOperationType}
        />
      </Field>

      {sliceType === "left" && (
        <Field label={t.splitLength}>
          <input
            type="number"
            value={leftLength}
            onChange={(e) => setLeftLength(e.target.value)}
            className="w-full h-8 px-2 text-xs border rounded-md bg-background"
          />
        </Field>
      )}

      {sliceType === "right" && (
        <Field label={t.splitLength}>
          <input
            type="number"
            value={rightLength}
            onChange={(e) => setRightLength(e.target.value)}
            className="w-full h-8 px-2 text-xs border rounded-md bg-background"
          />
        </Field>
      )}

      {sliceType === "slice" && (
        <>
          <Field label={t.splitStartIndex}>
            <input
              type="number"
              value={sliceStart}
              onChange={(e) => setSliceStart(e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded-md bg-background"
            />
          </Field>
          <Field label={t.splitEndIndex}>
            <input
              type="number"
              value={sliceEnd}
              onChange={(e) => setSliceEnd(e.target.value)}
              className="w-full h-8 px-2 text-xs border rounded-md bg-background"
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
            />
          </Field>

          {separator === "custom" && (
            <Field label={t.splitCustomSeparator}>
              <input
                type="text"
                value={customSeparator}
                onChange={(e) => setCustomSeparator(e.target.value)}
                placeholder={t.splitCustomSeparatorPlaceholder}
                className="w-full h-8 px-2 text-xs border rounded-md bg-background"
              />
              <VariableHint value={customSeparator} />
            </Field>
          )}

          <Field label={t.splitArrayIndices}>
            <div className="space-y-1">
              {indices.map((index, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={index}
                    onChange={(e) => updateIndex(i, e.target.value)}
                    placeholder="0"
                    className="flex-1 h-8 px-2 text-xs border rounded-md bg-background"
                  />
                  {indices.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setIndices((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="p-1 hover:bg-accent rounded transition-colors"
                      aria-label={t.cancel}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setIndices((prev) => [...prev, ""])}
                className="w-full h-8 px-2 text-xs border border-dashed rounded-md hover:border-accent transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3 text-muted-foreground" />
                {t.splitAddIndex}
              </button>
            </div>
          </Field>

          <Field label={t.splitJoinWith}>
            <input
              type="text"
              value={joinWith}
              onChange={(e) => setJoinWith(e.target.value)}
              placeholder={t.splitJoinWithPlaceholder}
              className="w-full h-8 px-2 text-xs border rounded-md bg-background"
            />
            <VariableHint value={joinWith} />
          </Field>
        </>
      )}

      <Field label={t.splitAlias}>
        <input
          type="text"
          value={outputColumn}
          onChange={(e) => setOutputColumn(e.target.value)}
          placeholder={t.splitAliasPlaceholder}
          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
        />
      </Field>
    </QuickActionShell>
  );
}
