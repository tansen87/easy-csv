import { useLanguage } from "@/i18n";

/** Small inline hint shown under a free-text input once it contains `{{`
 *  (F3). Used by standalone dialogs that don't use CommandFormWrapper. */
export function VariableHint({ value }: { value: unknown }) {
  const { t } = useLanguage();
  if (typeof value !== "string" || !value.includes("{{")) return null;
  return (
    <p className="mt-1 text-[11px] text-muted-foreground/80 leading-snug">
      {t.variablePlaceholderHint}
    </p>
  );
}
