import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import {
  DEFAULT_WINDOW_SIZE,
  WINDOW_EXPRS,
} from "@/modules/dialogs/quick/lib/windowFunctions";
import type {
  QuickFormProps,
  WindowDraft,
  WindowEntryDraft,
} from "@/modules/dialogs/quick/types";
import {
  AddButton,
  DeleteButton,
  Field,
  QuickInput,
  SectionHeader,
} from "./_shared";

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
  const expressionCount = t.quickCountExpressions.replace(
    "{count}",
    String(entries.length),
  );

  return (
    <QuickActionShell
      title={t.windowAction}
      scope={quickScope(request, clicked)}
      anchor={request}
      width={360}
      summary={
        result
          ? { command: result.type, detail: expressionCount }
          : undefined
      }
      blocked={!result ? t.windowColumn : undefined}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <Field label={t.windowGroupBy}>
        <QuickInput
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          placeholder={t.windowGroupByPlaceholder}
        />
      </Field>

      <div>
        <SectionHeader
          label={t.windowExpressions}
          meta={expressionCount}
          action={
            <AddButton
              label={t.pivotAdd}
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
            />
          }
        />

        <div className="border-t">
          {entries.map((entry, index) => {
            const func =
              WINDOW_EXPRS.find((f) => f.value === entry.func) ||
              WINDOW_EXPRS[0];
            return (
              <div
                key={index}
                className="grid grid-cols-[18px_minmax(0,1fr)_22px] items-start gap-2 border-b py-2 last:border-b-0"
              >
                <span className="pt-2 font-mono text-[10px] text-muted-foreground/60">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Select
                      value={entry.func}
                      onChange={(v) => updateEntry(index, "func", v)}
                      options={WINDOW_EXPRS.map((f) => ({
                        label: f.value,
                        value: f.value,
                      }))}
                      placeholder={t.windowSelectExpression}
                      ariaLabel={t.windowExpression}
                      portal
                      height="h-7"
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
                      portal
                      height="h-7"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {func.hasWindowSize && (
                      <QuickInput
                        type="number"
                        value={entry.windowSize}
                        onChange={(e) =>
                          updateEntry(index, "windowSize", e.target.value)
                        }
                        placeholder={DEFAULT_WINDOW_SIZE}
                        className="font-mono max-w-[88px]"
                      />
                    )}
                    <QuickInput
                      value={entry.alias}
                      onChange={(e) =>
                        updateEntry(index, "alias", e.target.value)
                      }
                      placeholder={t.windowAliasPlaceholder}
                    />
                  </div>
                </div>

                {entries.length > 1 ? (
                  <DeleteButton
                    label={t.cancel}
                    onClick={() =>
                      setEntries((prev) =>
                        prev.filter((_, i) => i !== index),
                      )
                    }
                  />
                ) : (
                  <span />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </QuickActionShell>
  );
}
