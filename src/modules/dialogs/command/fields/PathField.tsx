import { File, Folder } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";

interface PathFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the input and the two pickers. */
  label: string;
  placeholder?: string;
  pickFileLabel: string;
  pickFolderLabel: string;
}

const ICON_BUTTON =
  "grid h-6 w-6 flex-none place-items-center rounded-[5px] text-muted-foreground " +
  "transition-colors hover:bg-muted hover:text-foreground";

/**
 * A filesystem path (design 080 §9).
 *
 * Typing stays first-class — the field is a normal input, so a path can be
 * pasted or edited by hand — and the two icon buttons open the system picker
 * for a file or a directory. Both write the same string, so there is no second
 * source of truth to reconcile.
 */
export function PathField({
  value,
  onChange,
  label,
  placeholder,
  pickFileLabel,
  pickFolderLabel,
}: PathFieldProps) {
  const pick = async (directory: boolean) => {
    try {
      const picked = await open({ multiple: false, directory });
      if (typeof picked === "string" && picked) onChange(picked);
    } catch {
      // Cancelled, or no dialog backend (tests): keep the typed value.
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-background pr-1 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="h-8 min-w-0 flex-1 bg-transparent px-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/60"
      />
      <button
        type="button"
        aria-label={pickFileLabel}
        title={pickFileLabel}
        onClick={() => void pick(false)}
        className={ICON_BUTTON}
      >
        <File className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        aria-label={pickFolderLabel}
        title={pickFolderLabel}
        onClick={() => void pick(true)}
        className={ICON_BUTTON}
      >
        <Folder className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}
