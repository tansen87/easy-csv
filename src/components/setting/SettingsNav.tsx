import React, { useRef } from "react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

/**
 * The settings directory: one entry per group, no per-row
 * mirroring — item-level lookup is the search box's job, and 18 entries squeezed
 * into a 184px-wide column would drop below a comfortable hit size and start
 * scrolling on short windows.
 *
 * While searching, groups with no match are **dimmed rather than removed** so
 * the user keeps their bearings; clicking one clears the search and jumps there.
 */
interface SettingsNavProps {
  groups: { id: string; name: string }[];
  activeId: string | null;
  /** Groups the current query left empty. */
  dimmedIds: Set<string>;
  onNavigate: (id: string) => void;
}

export function SettingsNav({
  groups,
  activeId,
  dimmedIds,
  onNavigate,
}: SettingsNavProps) {
  const { t } = useLanguage();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const moveFocus = (to: number) => {
    const count = groups.length;
    if (count === 0) return;
    const next = ((to % count) + count) % count;
    buttonsRef.current[next]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(groups.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <nav
      aria-label={t.settings}
      className="flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/20 p-2"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto">
        {groups.map((group, index) => {
          const active = activeId === group.id;
          const dimmed = dimmedIds.has(group.id);
          return (
            <button
              key={group.id}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => onNavigate(group.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                "relative flex h-[30px] items-center rounded-md px-2.5 text-left text-xs transition-colors",
                active
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/60",
                dimmed && "text-muted-foreground/40",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
              )}
              <span className="truncate">{group.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
