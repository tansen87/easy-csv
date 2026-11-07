import React, { useRef } from "react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

/**
 * The settings directory: one entry per group, no per-row
 * mirroring - item-level lookup is the search box's job, and 18 entries squeezed
 * into a narrow column would drop below a comfortable hit size and start
 * scrolling on short windows.
 *
 * While searching, groups with no match are **dimmed rather than removed** so
 * the user keeps their bearings; clicking one clears the search and jumps there.
 *
 * 040 (design 040 §3): the entry carries the group's ordinal - as a
 * `data-index` attribute, not as text, so the directory's `textContent` is still
 * just the group name. The current entry is a raised surface (a card on the
 * muted canvas) instead of an accent-coloured row plus a 2px stripe: on a grey
 * window, "you are here" reads better as a step than as a bar.
 */
interface SettingsNavProps {
  groups: { id: string; name: string; index?: number }[];
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
    <nav aria-label={t.settings} className="flex w-52 shrink-0 flex-col p-3">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {groups.map((group, position) => {
          const active = activeId === group.id;
          const dimmed = dimmedIds.has(group.id);
          return (
            <button
              key={group.id}
              ref={(node) => {
                buttonsRef.current[position] = node;
              }}
              type="button"
              aria-current={active ? "true" : undefined}
              data-index={String(group.index ?? position + 1).padStart(2, "0")}
              onClick={() => onNavigate(group.id)}
              onKeyDown={(event) => handleKeyDown(event, position)}
              className={cn(
                "settings-index flex h-8 items-center gap-2 rounded-lg border border-transparent px-2 text-left text-[12.5px]",
                "transition-colors",
                active
                  ? "border-border bg-card font-medium text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5",
                dimmed && "text-muted-foreground/40 [&::before]:opacity-50",
              )}
            >
              <span className="truncate">{group.name}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
