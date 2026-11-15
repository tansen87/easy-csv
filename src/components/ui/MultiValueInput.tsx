import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MultiValueInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** 28px control + 20px tags, used by the quick-action panels (design 055). */
  dense?: boolean;
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
  dense = false,
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
        dense && "min-h-7 gap-1 px-1.5 py-0.5",
        className,
      )}
    >
      {normalizedValues.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className={cn(
            "inline-flex items-center gap-1 max-w-full min-w-0 text-xs bg-accent/60 border border-border rounded px-1.5 py-0.5 break-all",
            dense &&
              "h-5 rounded-[4px] border-transparent bg-muted px-1.5 py-0 text-[11px]",
          )}
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-muted-foreground hover:text-foreground"
          >
            {dense ? <X className="h-2.5 w-2.5" /> : "x"}
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
        className={cn(
          "flex-1 bg-transparent outline-none",
          dense ? "min-w-[5.5rem] text-xs" : "min-w-[10rem] text-sm",
        )}
      />
    </div>
  );
}
