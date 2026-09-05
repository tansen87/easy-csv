import { useState } from "react";
import { cn } from "@/lib/utils";

interface MultiValueInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Tag-style multi-value input. Enter confirms the current value; newlines
 * split pasted text into multiple values; commas / semicolons are kept as
 * literal characters so they can be part of a single value; Backspace with an
 * empty field removes the last tag.
 */
export function MultiValueInput({
  values,
  onChange,
  placeholder,
  disabled,
  className,
}: MultiValueInputProps) {
  const [draft, setDraft] = useState("");
  const normalizedValues = Array.isArray(values)
    ? values.filter((v) => v !== undefined && v !== null)
    : values
      ? [values]
      : [];

  const commit = () => {
    const parts = draft
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange(Array.from(new Set([...normalizedValues, ...parts])));
    setDraft("");
  };

  const remove = (index: number) => {
    onChange(normalizedValues.filter((_, i) => i !== index));
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 border rounded-md bg-background px-2 py-1 min-h-[2rem]",
        className,
      )}
    >
      {normalizedValues.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 text-xs bg-accent/60 border border-border rounded px-1.5 py-0.5"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove"
            className="text-muted-foreground hover:text-foreground"
          >
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (
            e.key === "Backspace" &&
            draft === "" &&
            normalizedValues.length
          ) {
            remove(normalizedValues.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="flex-1 min-w-[10rem] text-sm bg-transparent outline-none"
      />
    </div>
  );
}
