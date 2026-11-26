interface LinesFieldProps {
  value: unknown;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Template with `{n}`, e.g. "{n} 行". */
  countLabel: string;
}

/**
 * One value per line (design 080 §9).
 *
 * Used by `batch-search --manual-values`, which takes a list of values to look
 * for. The count in the corner is the only feedback that matters here: it tells
 * the user how many values will be searched without making them count blank
 * lines themselves.
 */
export function LinesField({
  value,
  onChange,
  label,
  placeholder,
  countLabel,
}: LinesFieldProps) {
  const text = String(value ?? "");
  const lineCount = text.split("\n").filter((line) => line.trim() !== "").length;

  return (
    <div className="relative">
      <textarea
        aria-label={label}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={4}
        className="min-h-[96px] w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[11.5px] leading-[20px] text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <span className="pointer-events-none absolute bottom-1.5 right-2.5 font-mono text-[9.5px] tabular-nums text-muted-foreground/60">
        {countLabel.replace("{n}", String(lineCount))}
      </span>
    </div>
  );
}
