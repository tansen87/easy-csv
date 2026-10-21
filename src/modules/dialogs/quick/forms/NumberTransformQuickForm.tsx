import { useState } from "react";
import type { NumberTransformKind } from "@/types/dialog";
import { useLanguage } from "@/i18n";
import { QuickActionShell } from "@/modules/dialogs/quick/QuickActionShell";
import { buildQuickCommand } from "@/modules/dialogs/quick/lib/buildQuickCommand";
import { useQuickAliasLabels } from "@/modules/dialogs/quick/lib/labels";
import type {
  NumberTransformDraft,
  QuickFormProps,
} from "@/modules/dialogs/quick/types";
import { ColumnPicker, Field } from "./_shared";

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

  return (
    <QuickActionShell
      title={t.numTransformAction}
      anchor={request}
      width={280}
      canApply={!!result}
      onApply={() => result && onApply(result)}
      onAdvanced={() => result && onAdvanced(result)}
      onClose={onClose}
    >
      <ColumnPicker
        columns={request.headers}
        selected={columns}
        onToggle={toggleColumn}
        searchPlaceholder={t.numTransformSearchColumns}
        noMatches={t.numTransformNoMatches}
        countLabel={t.numTransformColumnsSelected.replace(
          "{count}",
          String(columns.length),
        )}
      />

      <Field label={t.numTransformType}>
        <div className="border rounded-md bg-background p-1.5">
          <div className="flex flex-wrap -mx-0.5">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTransform(option.value)}
                className={`w-1/3 text-center px-1 py-1.5 text-xs rounded transition-colors ${
                  transform === option.value
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Field>
    </QuickActionShell>
  );
}
