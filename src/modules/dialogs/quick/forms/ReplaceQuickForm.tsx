import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { VariableHint } from "@/components/ui/VariableHint";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  QuickFormProps,
  ReplaceDraft,
  ReplacePairDraft,
} from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

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

  return (
    <QuickActionShell
      title={t.replaceAction}
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
          placeholder={t.replaceSearchColumn}
          ariaLabel={t.filterColumn}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.replacePairs}
          </span>
          <button
            type="button"
            onClick={() =>
              setPairs((prev) => [
                ...prev,
                { pattern: "", replace: "", regex: false, ignoreCase: false },
              ])
            }
            className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.replaceAdd}
          </button>
        </div>

        <div className="space-y-2">
          {pairs.map((pair, index) => (
            <div
              key={index}
              className="p-2 border rounded-md bg-muted/30 space-y-2"
            >
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-medium">
                  #{index + 1}
                </span>
                {pairs.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setPairs((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="ml-auto p-0.5 hover:bg-accent rounded transition-colors"
                    aria-label={t.cancel}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>

              <div className="flex gap-1 items-center">
                <input
                  type="text"
                  value={pair.pattern}
                  onChange={(e) => updatePair(index, "pattern", e.target.value)}
                  placeholder={t.replacePattern}
                  className="flex-1 w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={pair.replace}
                  onChange={(e) => updatePair(index, "replace", e.target.value)}
                  placeholder={t.replaceReplacement}
                  className="flex-1 w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
              <VariableHint value={pair.replace} />

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pair.regex}
                    onChange={(e) =>
                      updatePair(index, "regex", e.target.checked)
                    }
                    className="h-3 w-3 accent-foreground"
                  />
                  {t.replaceRegex}
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pair.ignoreCase}
                    onChange={(e) =>
                      updatePair(index, "ignoreCase", e.target.checked)
                    }
                    className="h-3 w-3 accent-foreground"
                  />
                  {t.replaceIgnoreCase}
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </QuickActionShell>
  );
}
