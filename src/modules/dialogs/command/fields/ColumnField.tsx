import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ColumnFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The open tab's headers; empty means the chip row is not rendered. */
  headers?: string[];
  placeholder?: string;
  autoFocus?: boolean;
  /** Accessible name for the input (the sheet's field label). */
  ariaLabel: string;
  /** Localized "headers" label in front of the chips. */
  headersLabel: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * A column parameter: type it, or pick it from the tab's headers (design 080).
 *
 * Both paths write the same string, so an expression (`col("金额") * 1.1`) can
 * still be typed by hand while a plain list is a click away. Chips append to a
 * comma-separated list and toggle off on a second click.
 *
 * The list is split on bare commas — good enough for `select`/`columns`, which
 * are plain name lists. An expression containing its own commas is rewritten
 * only if a chip is actually clicked.
 */
export function ColumnField({
  value,
  onChange,
  headers = [],
  placeholder,
  autoFocus,
  ariaLabel,
  headersLabel,
  onKeyDown,
}: ColumnFieldProps) {
  const parts = useMemo(
    () =>
      value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    [value],
  );
  const selected = useMemo(() => new Set(parts), [parts]);

  const toggle = (header: string) => {
    const next = selected.has(header)
      ? parts.filter((part) => part !== header)
      : [...parts, header];
    onChange(next.join(","));
  };

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      {headers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {headersLabel}
          </span>
          {headers.map((header) => {
            const on = selected.has(header);
            return (
              <button
                key={header}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(header)}
                className={cn(
                  "h-[22px] rounded-[5px] border px-1.5 text-[11px] transition-colors",
                  on
                    ? "border-brand-border bg-brand-soft font-medium text-brand"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {header}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
