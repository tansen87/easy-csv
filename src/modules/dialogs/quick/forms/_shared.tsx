import { ReactNode, useState } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/ScrollArea";

/**
 * Shared controls for the right-click quick-action panels (design 055).
 *
 * Everything sits on a 4px grid: controls are 28px tall, list rows 26px, and a
 * labelled setting is one row (`72px` label + control) instead of three stacked
 * lines. One checkbox, one input and one section header are reused everywhere.
 */

export function Field({
  label,
  children,
  stack = false,
}: {
  label: ReactNode;
  children: ReactNode;
  stack?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[72px_minmax(0,1fr)] gap-2",
        stack ? "items-start" : "items-center",
      )}
    >
      <span
        className={cn(
          "text-[11.5px] leading-snug text-muted-foreground",
          stack && "pt-1.5",
        )}
      >
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Text / number input at the shared 28px control height. */
export function QuickInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={cn(
        "h-7 w-full rounded-md border bg-background px-2 text-xs outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    />
  );
}

/** Section title with an optional mono count and a trailing action. */
export function SectionHeader({
  label,
  meta,
  action,
}: {
  label: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-1.5 flex h-[18px] items-center gap-2">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      {meta !== undefined && (
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {meta}
        </span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

export function AddButton({
  label,
  onClick,
}: {
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded text-[11.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Plus className="h-3 w-3" />
      {label}
    </button>
  );
}

export function DeleteButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[4px] text-muted-foreground/70 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** One checkbox style for the whole panel; the native input stays for a11y. */
export function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-[7px] text-xs">
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
      <span>{label}</span>
    </label>
  );
}

interface ColumnPickerProps {
  label: string;
  /** Right-aligned mono count, e.g. `已选 2` or `2 个值`. */
  meta?: string;
  columns: string[];
  selected: string[];
  onToggle: (column: string) => void;
  searchPlaceholder: string;
  noMatches: string;
  height?: number;
}

/** Searchable checkbox list used by sort / text / number / pivot forms. */
export function ColumnPicker({
  label,
  meta,
  columns,
  selected,
  onToggle,
  searchPlaceholder,
  noMatches,
  height = 136,
}: ColumnPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = columns.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <SectionHeader label={label} meta={meta} />
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex h-7 items-center gap-1.5 border-b px-2">
          <Search className="h-3 w-3 shrink-0 text-muted-foreground/60" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-full w-full bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <ScrollArea
          style={{ height }}
          hideHorizontalScrollbar
          blockContent
        >
          <div className="p-[3px]">
            {filtered.length === 0 ? (
              <span className="block px-1.5 py-1 text-[11.5px] text-muted-foreground/70">
                {noMatches}
              </span>
            ) : (
              filtered.map((header) => {
                const isSelected = selected.includes(header);
                return (
                  <button
                    key={header}
                    type="button"
                    onClick={() => onToggle(header)}
                    className={cn(
                      "relative flex h-[26px] w-full items-center gap-2 rounded-[4px] px-1.5 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                      isSelected ? "bg-primary/10" : "hover:bg-accent",
                    )}
                  >
                    {isSelected && (
                      <span className="absolute inset-y-[5px] left-0 w-0.5 rounded-full bg-primary" />
                    )}
                    <span
                      className={cn(
                        "grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[3px] border",
                        isSelected
                          ? "border-primary bg-primary"
                          : "border-foreground/25 bg-background",
                      )}
                    >
                      {isSelected && (
                        <Check
                          className="h-2.5 w-2.5 text-primary-foreground"
                          strokeWidth={2.5}
                        />
                      )}
                    </span>
                    <span className="truncate">{header}</span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

/** Underline tabs, for switches that change which fields the form shows. */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div className="flex gap-4 border-b">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "relative -mb-px flex h-7 items-center rounded text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
            value === option.value
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
          {value === option.value && (
            <span className="absolute inset-x-0 -bottom-px h-[1.5px] bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

/** Segmented choice for a two-value setting, e.g. ascending / descending. */
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-md border bg-background">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            "flex flex-1 items-center justify-center border-r px-3 text-[11.5px] outline-none transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:ring-ring/40",
            value === option.value
              ? "bg-primary/10 font-medium text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
