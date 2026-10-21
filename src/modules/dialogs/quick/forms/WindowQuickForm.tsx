import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import {
  DEFAULT_WINDOW_SIZE,
  WINDOW_EXPRS,
} from "@/modules/dialogs/quick/lib/windowFunctions";
import type {
  QuickFormProps,
  WindowDraft,
  WindowEntryDraft,
} from "@/modules/dialogs/quick/types";
import { Field } from "./_shared";

export function WindowQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const clicked =
    request.col !== undefined ? request.headers[request.col] || "" : "";
  const [groupBy, setGroupBy] = useState("");
  const [entries, setEntries] = useState<WindowEntryDraft[]>([
    {
      column: clicked,
      func: WINDOW_EXPRS[0].value,
      alias: "",
      windowSize: DEFAULT_WINDOW_SIZE,
    },
  ]);

  const updateEntry = (
    index: number,
    field: keyof WindowEntryDraft,
    value: string,
  ) => {
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    );
  };

  const draft: WindowDraft = { kind: "window", groupBy, entries };
  const result = buildQuickCommand(draft, labels);

  return (
    <QuickActionShell
      title={t.windowAction}
      anchor={request}
      width={300}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <Field label={t.windowGroupBy}>
        <input
          type="text"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          placeholder={t.windowGroupByPlaceholder}
          className="w-full h-8 px-2 text-xs border rounded-md bg-background"
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t.windowExpressions}
          </span>
          <button
            type="button"
            onClick={() =>
              setEntries((prev) => [
                ...prev,
                {
                  column: "",
                  func: WINDOW_EXPRS[0].value,
                  alias: "",
                  windowSize: DEFAULT_WINDOW_SIZE,
                },
              ])
            }
            className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            {t.windowAdd}
          </button>
        </div>

        <div className="space-y-2">
          {entries.map((entry, index) => {
            const func =
              WINDOW_EXPRS.find((f) => f.value === entry.func) ||
              WINDOW_EXPRS[0];
            return (
              <div
                key={index}
                className="p-2 border rounded-md bg-muted/30 space-y-1.5"
              >
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-medium">
                    #{index + 1}
                  </span>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEntries((prev) =>
                          prev.filter((_, i) => i !== index),
                        )
                      }
                      className="ml-auto p-0.5 hover:bg-accent rounded transition-colors"
                      aria-label={t.cancel}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>

                <Select
                  value={entry.func}
                  onChange={(v) => updateEntry(index, "func", v)}
                  options={WINDOW_EXPRS.map((f) => ({
                    label: f.value,
                    value: f.value,
                  }))}
                  placeholder={t.windowSelectExpression}
                  ariaLabel={t.windowExpression}
                />

                <Select
                  value={entry.column}
                  onChange={(v) => updateEntry(index, "column", v)}
                  options={request.headers.map((h) => ({
                    label: h,
                    value: h,
                  }))}
                  placeholder={t.windowColumnPlaceholder}
                  ariaLabel={t.windowColumn}
                />

                {func.hasWindowSize && (
                  <input
                    type="number"
                    value={entry.windowSize}
                    onChange={(e) =>
                      updateEntry(index, "windowSize", e.target.value)
                    }
                    placeholder={DEFAULT_WINDOW_SIZE}
                    className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                  />
                )}

                <input
                  type="text"
                  value={entry.alias}
                  onChange={(e) => updateEntry(index, "alias", e.target.value)}
                  placeholder={t.windowAliasPlaceholder}
                  className="w-full h-8 px-2 text-xs border rounded-md bg-background"
                />
              </div>
            );
          })}
        </div>
      </div>
    </QuickActionShell>
  );
}
