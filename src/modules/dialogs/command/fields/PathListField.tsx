import { Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface PathListFieldProps {
  value: unknown;
  onChange: (value: string[] | string) => void;
  label: string;
  addLabel: string;
  /** Template with `{n}`, e.g. "{n} 个文件". */
  countLabel: string;
  /** Write back one joined string instead of an array (batch-from: ";"). */
  join?: string;
  /** Show a folder picker too; the picked folder is one entry. */
  folderLabel?: string;
}

/** `cat --inputs` holds either an array (picked) or a typed list. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? "")
    .split(/[|;,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * A list of files (design 080 §9).
 *
 * Same shape as the header chips — a chip per file with an × — plus one
 * add button that opens a multi-select picker. The value is written back as an
 * array, which is what `serializeStepParams` already knows how to pipe-join for
 * the positional argument.
 */
export function PathListField({
  value,
  onChange,
  label,
  addLabel,
  countLabel,
  join,
  folderLabel,
}: PathListFieldProps) {
  const items = toList(value);
  const emit = (next: string[]) => onChange(join ? next.join(join) : next);

  const add = async (directory = false) => {
    try {
      const picked = await open({ multiple: !directory, directory });
      if (!picked) return;
      const list = Array.isArray(picked) ? picked : [picked];
      const next = [...items];
      for (const path of list) if (!next.includes(path)) next.push(path);
      emit(next);
    } catch {
      // Cancelled, or no dialog backend (tests).
    }
  };

  return (
    <div>
      <div
        aria-label={label}
        role="group"
        className="flex min-h-[34px] flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1.5"
      >
        {items.map((path, index) => (
          <span
            key={`${path}-${index}`}
            className="inline-flex h-[22px] max-w-[220px] items-center gap-1.5 rounded-[5px] bg-muted pl-2 pr-1 text-[11px] text-foreground"
          >
            <span className="truncate" title={path}>
              {path.split(/[/\\]/).pop() || path}
            </span>
            <button
              type="button"
              aria-label={`${label} · ${path}`}
              onClick={() => emit(items.filter((_, i) => i !== index))}
              className="px-0.5 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => void add()}
          className="inline-flex h-[22px] items-center gap-1 rounded-[5px] border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
        {folderLabel && (
          <button
            type="button"
            onClick={() => void add(true)}
            className="inline-flex h-[22px] items-center gap-1 rounded-[5px] border border-dashed border-border px-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {folderLabel}
          </button>
        )}
      </div>
      {items.length > 0 && (
        <p className="mt-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {countLabel.replace("{n}", String(items.length))}
        </p>
      )}
    </div>
  );
}
