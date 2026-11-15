import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  QuickFormProps,
  ReplaceDraft,
  ReplacePairDraft,
} from "@/modules/dialogs/quick/types";
import {
  AddButton,
  CheckRow,
  DeleteButton,
  Field,
  QuickInput,
  SectionHeader,
} from "./_shared";

export function ReplaceQuickForm({
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
  const [pairs, setPairs] = useState<ReplacePairDraft[]>([
    { pattern: "", replace: "", regex: false, ignoreCase: false },
  ]);

  const updatePair = (
    index: number,
    field: keyof ReplacePairDraft,
    value: string | boolean,
  ) => {
    setPairs((prev) =>
      prev.map((pair, i) =>
        i === index ? { ...pair, [field]: value } : pair,
      ),
    );
  };

  const draft: ReplaceDraft = { kind: "replace", column, pairs };
  const result = buildQuickCommand(draft, labels);
  const pairCount = t.quickCountPairs.replace("{count}", String(pairs.length));

  return (
    <QuickActionShell
      title={t.replaceAction}
      scope={quickScope(request, column)}
      anchor={request}
      width={320}
      summary={
        result ? { command: result.type, detail: `${column} · ${pairCount}` } : undefined
      }
      blocked={!result ? (column ? t.replacePattern : t.filterColumn) : undefined}
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
          placeholder={t.replaceSearchColumn}
          ariaLabel={t.filterColumn}
          portal
          height="h-7"
        />
      </Field>

      <div>
        <SectionHeader
          label={t.replacePairs}
          meta={pairCount}
          action={
            <AddButton
              label={t.replaceAdd}
              onClick={() =>
                setPairs((prev) => [
                  ...prev,
                  { pattern: "", replace: "", regex: false, ignoreCase: false },
                ])
              }
            />
          }
        />

        <div className="border-t">
          {pairs.map((pair, index) => (
            <div
              key={index}
              className="grid grid-cols-[18px_minmax(0,1fr)_22px] items-start gap-2 border-b py-2 last:border-b-0"
            >
              <span className="pt-2 font-mono text-[10px] text-muted-foreground/60">
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <QuickInput
                    value={pair.pattern}
                    onChange={(e) =>
                      updatePair(index, "pattern", e.target.value)
                    }
                    placeholder={t.replacePattern}
                  />
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                  <QuickInput
                    value={pair.replace}
                    onChange={(e) =>
                      updatePair(index, "replace", e.target.value)
                    }
                    placeholder={t.replaceReplacement}
                  />
                </div>
                <VariableHint value={pair.replace} />

                <div className="flex items-center gap-3">
                  <CheckRow
                    checked={pair.regex}
                    onChange={(v) => updatePair(index, "regex", v)}
                    label={t.replaceRegex}
                  />
                  <CheckRow
                    checked={pair.ignoreCase}
                    onChange={(v) => updatePair(index, "ignoreCase", v)}
                    label={t.replaceIgnoreCase}
                  />
                </div>
              </div>

              {pairs.length > 1 ? (
                <DeleteButton
                  label={t.cancel}
                  onClick={() =>
                    setPairs((prev) => prev.filter((_, i) => i !== index))
                  }
                />
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
      </div>
    </QuickActionShell>
  );
}
