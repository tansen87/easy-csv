import { HelpCircle } from "lucide-react";

import type { XanCommand } from "@/types/xan";
import { cn } from "@/lib/utils";

interface CommandRowProps {
  command: XanCommand;
  /** Description in the panel's current language. */
  description: string;
  /** Lowercased query, used to highlight the hit. */
  query: string;
  /** Keyboard-selected row (one at a time). */
  active: boolean;
  /** Matches the listbox's `aria-activedescendant`. */
  rowId: string;
  helpLabel: string;
  onSelect: () => void;
  onHelp?: () => void;
  onHover: () => void;
}

/** Wrap the first match so a search shows *why* the row is here. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[2px] bg-primary/20 px-px text-inherit">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

/**
 * One operation, 30px tall.
 *
 * The command name is the thing you are looking for, so it gets the fixed
 * 100px column and the mono face; the description follows on one line and is
 * allowed to truncate. The help button is always visible - a hover-only entry
 * is not an entry - but quiet: 16px hit area, 12px glyph,
 * muted until the row is hovered or selected.
 */
export function CommandRow({
  command,
  description,
  query,
  active,
  rowId,
  helpLabel,
  onSelect,
  onHelp,
  onHover,
}: CommandRowProps) {
  return (
    <div
      id={rowId}
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "group/row grid h-10 cursor-pointer grid-cols-[minmax(0,1fr)_16px] items-center gap-2 rounded-[5px] px-[7px]",
        active ? "bg-primary/[0.09]" : "hover:bg-foreground/[0.04]",
      )}
    >
      <span className="grid min-w-0 gap-px">
        <span
          className={cn(
            "truncate font-mono text-[11.5px] leading-4",
            active ? "text-primary" : "text-foreground",
          )}
        >
          <Highlighted text={command.name} query={query} />
        </span>
        <span className="truncate text-[11px] leading-[15px] text-muted-foreground">
          <Highlighted text={description} query={query} />
        </span>
      </span>
      {onHelp ? (
        <button
          type="button"
          // Roving tabindex lives on the listbox: Tab must not walk 61 rows.
          tabIndex={-1}
          aria-label={helpLabel}
          onClick={(event) => {
            event.stopPropagation();
            onHelp();
          }}
          className="mt-[5px] grid h-4 w-4 self-start place-items-center rounded text-muted-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground group-hover/row:text-muted-foreground/70"
        >
          <HelpCircle className="h-3 w-3" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
