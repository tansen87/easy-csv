import { ReactNode, useState } from "react";
import { Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";

export function Field({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

interface ColumnPickerProps {
  columns: string[];
  selected: string[];
  onToggle: (column: string) => void;
  searchPlaceholder: string;
  noMatches: string;
  countLabel: ReactNode;
  height?: number;
}

/** Searchable checkbox list used by sort / text / number / pivot forms. */
export function ColumnPicker({
  columns,
  selected,
  onToggle,
  searchPlaceholder,
  noMatches,
  countLabel,
  height = 120,
}: ColumnPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = columns.filter((c) =>
    c.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground mb-1 block">
        {countLabel}
      </span>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full h-7 px-2 text-xs border rounded-md bg-background mb-1"
      />
      <ScrollArea
        className="border rounded-md bg-background"
        style={{ height }}
        hideHorizontalScrollbar
        blockContent
      >
        <div className="p-1.5 space-y-0.5">
          {filtered.length === 0 ? (
            <span className="text-xs text-muted-foreground px-2 py-0.5 block">
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
                  className={`w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-primary border-primary"
                          : "border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 text-primary-foreground" />
                      )}
                    </span>
                    <span className="truncate">{header}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

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
    <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
            value === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
