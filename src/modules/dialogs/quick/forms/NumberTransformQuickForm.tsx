import { useState } from "react";
import type { NumberTransformKind } from "@/types/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import { quickScope } from "@/modules/dialogs/quick/lib/scope";
import type {
  NumberTransformDraft,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { ColumnPicker, SectionHeader } from "./_shared";

export function NumberTransformQuickForm({
  request,
  onApply,
  onAdvanced,
  onClose,
}: QuickFormProps) {
  const { t } = useLanguage();
  const labels = useQuickAliasLabels();
  const clicked =
    request.col !== undefined ? request.headers[request.col] : undefined;
  const [columns, setColumns] = useState<string[]>(clicked ? [clicked] : []);
  const [transform, setTransform] = useState<NumberTransformKind>(
    request.numberTransform || "abs",
  );

  const options: { label: string; value: NumberTransformKind }[] = [
    { label: t.numTransformAbs, value: "abs" },
    { label: t.numTransformNeg, value: "neg" },
    { label: t.numTransformFloor, value: "floor" },
    { label: t.numTransformCeil, value: "ceil" },
    { label: t.numTransformInt, value: "int" },
    { label: t.numTransformFloat, value: "float" },
    { label: t.numTransformRound, value: "round" },
  ];

  const toggleColumn = (column: string) => {
    setColumns((prev) =>
      prev.includes(column)
        ? prev.filter((c) => c !== column)
        : [...prev, column],
    );
  };

  const draft: NumberTransformDraft = {
    kind: "number-transform",
    columns,
    transform,
  };
  const result = buildQuickCommand(draft, labels);
  const transformLabel =
    options.find((o) => o.value === transform)?.label || transform;
  const detail = `${t.quickCountColumns.replace("{count}", String(columns.length))} · ${transformLabel}`;

  return (
    <QuickActionShell
      title={t.numTransformAction}
      scope={quickScope(request, clicked)}
      anchor={request}
      width={288}
      summary={result ? { command: result.type, detail } : undefined}
      blocked={!result ? t.filterColumn : undefined}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        label={t.filterColumn}
        meta={`${t.quickSelected} ${columns.length}`}
        columns={request.headers}
        selected={columns}
        onToggle={toggleColumn}
        searchPlaceholder={t.numTransformSearchColumns}
        noMatches={t.numTransformNoMatches}
      />

      <div>
        <SectionHeader label={t.numTransformType} />
        <div className="grid grid-cols-3 gap-1 rounded-md border bg-background p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTransform(option.value)}
              className={cn(
                "h-6 rounded-[4px] text-[11.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                transform === option.value
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </QuickActionShell>
  );
}
