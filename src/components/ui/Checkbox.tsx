import { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  className?: string;
}

/**
 * 13px brand checkbox used by the dialog forms. The native input stays for
 * accessibility; the visible box is drawn so it reads the same in both themes
 * (a native checkbox turns into a bright white square on dark surfaces).
 */
export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer select-none items-center gap-2",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          "grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[3px] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring/40",
          checked
            ? "border-primary bg-primary"
            : "border-foreground/25 bg-background",
        )}
      >
        {checked && (
          <Check
            className="h-2.5 w-2.5 text-primary-foreground"
            strokeWidth={2.5}
          />
        )}
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );
}
