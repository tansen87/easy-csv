import React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

/**
 * Search box at the top of the content pane.
 *
 * Two deliberate calls:
 * - **no visible result count** — the filtered list is the count;
 * - the clear affordance is an ✕ **icon, not the word 「清除」**, because the
 *   same screen already carries four destructive 「清除」 buttons.
 *
 * The count still exists for assistive tech: a `sr-only` live region announces
 * it so a screen-reader user learns that the search narrowed the list.
 */
interface SettingsSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Rows the current query leaves visible (panels count as one). */
  resultCount: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SettingsSearch({
  value,
  onChange,
  resultCount,
  inputRef,
}: SettingsSearchProps) {
  const { t } = useLanguage();
  const searching = value.length > 0;

  return (
    <div className="flex flex-none items-center gap-3 px-4 py-2.5">
      <div
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-background px-2.5",
          searching ? "border-input" : "border-border/70",
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label={t.settingsSearchPlaceholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t.settingsSearchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {searching && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={t.settingsNavHintClear}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <span aria-live="polite" className="sr-only">
        {searching
          ? t.settingsSearchResults.replace("{count}", String(resultCount))
          : ""}
      </span>
    </div>
  );
}
