import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";

import type { XanCommand } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { CommandRow } from "./CommandRow";
import { searchCommands } from "./lib/commandSearch";

/** Panel width. Exported because the canvas tool rail slides clear of it. */
export const COMMAND_PANEL_WIDTH = 260;
/** Gap between the window edge and the panel. */
export const COMMAND_PANEL_INSET = 2;
/** Title bar height — the panel starts right below it. */
const CHROME_HEIGHT = 36;
/**
 * Air below the title bar and above the window bottom. These two numbers are
 * the only thing to touch when the panel should hug the edges tighter — the
 * left gap is `COMMAND_PANEL_INSET` above.
 */
const TOP_GAP = 32;
const BOTTOM_GAP = 66;
/** Never collapse to something unusable on a very short window. */
const MIN_HEIGHT = 280;
/** Debounce before the filter runs, in ms. */
const SEARCH_DEBOUNCE_MS = 150;

interface PanelBox {
  x: number;
  y: number;
  height: number;
}

/** Left edge, right under the title bar, down to just above the window bottom. */
function panelBox(): PanelBox {
  const y = CHROME_HEIGHT + TOP_GAP;
  const height = Math.max(
    MIN_HEIGHT,
    (window.innerHeight || 800) - y - BOTTOM_GAP,
  );
  return { x: COMMAND_PANEL_INSET, y, height };
}

interface CommandListProps {
  commands: XanCommand[];
  onCommandClick: (command: XanCommand) => void;
  onHelpClick?: (command: XanCommand) => void;
  selectedCommandId?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isVisible: boolean;
  onClose: () => void;
  /** Show the "your first operation applies straight to the input" line. */
  showFirstStepHint?: boolean;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-border bg-card px-1 font-mono text-[9px] leading-[14px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/**
 * The command catalog: 61 xan operations under 14 categories (design 072).
 *
 * Was a 280×500 draggable stack of cards — 66px per operation, ~8000px of
 * scroll, uppercase English category labels. Now a 520×540 ledger: a 14-row
 * table of contents on the left, one 30px row per operation on the right, a
 * sticky group header and a footer that says how many there are and which keys
 * work. Docked left because the right-hand side belongs to the AI dock and the
 * data profile.
 */
export const CommandList = React.memo(function CommandList({
  commands,
  onCommandClick,
  onHelpClick,
  searchQuery,
  onSearchChange,
  isVisible,
  onClose,
  showFirstStepHint = false,
}: CommandListProps) {
  const { effectiveLanguage, t } = useLanguage();
  const language = effectiveLanguage;

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(searchQuery),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const result = useMemo(
    () => searchCommands(commands, debouncedQuery, language),
    [commands, debouncedQuery, language],
  );
  const groups = result.groups;
  const query = debouncedQuery.trim().toLowerCase();
  const searching = query.length > 0;
  const flat = useMemo(() => groups.flatMap((g) => g.commands), [groups]);
  const indexById = useMemo(
    () => new Map(flat.map((command, index) => [command.id, index])),
    [flat],
  );

  const [box, setBox] = useState<PanelBox>(panelBox);
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fixed box, not draggable: refit to the window when it changes shape.
  useEffect(() => {
    const onResize = () => setBox(panelBox());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
    setKeyboardNav(false);
  }, [isVisible]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flat.length]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // `event.target` can be `window` (a synthetic dispatch in a test), which
      // is not a Node and would blow up `contains`.
      const target = event.target instanceof Node ? event.target : null;
      const host = target instanceof HTMLElement ? target : null;
      const inPanel = target ? Boolean(panelRef.current?.contains(target)) : false;
      const isEditable = Boolean(
        host?.closest('textarea, input, select, [contenteditable="true"]'),
      );
      if (!inPanel && isEditable) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) =>
          Math.min(prev + 1, Math.max(flat.length - 1, 0)),
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const command = flat[activeIndex];
        if (!command) return;
        // Shift+Enter reaches the help that the row's `?` also opens.
        if (event.shiftKey && onHelpClick) onHelpClick(command);
        else onCommandClick(command);
      }
    },
    [flat, activeIndex, onCommandClick, onHelpClick, onClose],
  );

  useEffect(() => {
    if (!isVisible) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, handleKeyDown]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      data-testid="command-list"
      style={{
        left: box.x,
        top: box.y,
        width: COMMAND_PANEL_WIDTH,
        height: box.height,
      }}
      className="fixed z-floating flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22),0_1px_3px_rgba(0,0,0,0.05)] animate-in fade-in-0 slide-in-from-left-2 duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex h-11 flex-none items-center gap-2.5 border-b border-border-soft pl-3.5 pr-2">
        <span className="flex-none text-[13px] font-medium">{t.cmds}</span>
        <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-transparent bg-foreground/[0.04] px-2 focus-within:border-primary/40 focus-within:bg-card">
          <Search className="h-[13px] w-[13px] flex-none text-muted-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.commandSearchPlaceholder}
            autoFocus
            className="h-full w-full min-w-0 border-0 bg-transparent p-0 text-[11.5px] outline-none placeholder:text-muted-foreground/50"
          />
        </div>
        <button
          type="button"
          aria-label={t.close}
          onClick={onClose}
          className="grid h-6 w-6 flex-none place-items-center rounded-[5px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <X className="h-[13px] w-[13px]" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea
          ref={listRef}
          role="listbox"
          aria-label={t.cmds}
          aria-activedescendant={
            flat[activeIndex] ? `cmd-row-${flat[activeIndex].id}` : undefined
          }
          tabIndex={0}
          hideHorizontalScrollbar
          blockContent
          className="min-w-0 flex-1 outline-none"
          viewportClassName="pl-1.5 pr-3 pb-1.5"
          onMouseMove={() => setKeyboardNav(false)}
        >
          {showFirstStepHint && (
            <div
              data-testid="command-list-first-step-hint"
              className="flex items-center gap-2 border-b border-border-soft px-[7px] py-2 pr-2"
            >
              <span className="h-3 w-0.5 flex-none rounded-full bg-primary" />
              <span className="text-[10.5px] leading-relaxed text-muted-foreground">
                {t.onboardingPanelHint}
              </span>
            </div>
          )}

          {groups.map((group) => (
            <div
              key={group.view.key}
              role="group"
              aria-label={group.view.label[language]}
            >
              <div
                role="presentation"
                className="sticky top-0 z-[1] flex h-[26px] items-center gap-1.5 bg-card px-[7px] text-[10.5px] font-medium text-muted-foreground shadow-[inset_0_-1px_0_var(--border-soft)]"
              >
                <span className="font-mono text-[9px] text-muted-foreground/50">
                  {group.view.index}
                </span>
                <span>{group.view.label[language]}</span>
                <span className="ml-auto font-mono text-[9.5px] tabular-nums text-muted-foreground/50">
                  {searching
                    ? `${group.commands.length}/${result.counts[group.view.key] ?? group.commands.length}`
                    : group.commands.length}
                </span>
              </div>
              {group.commands.map((command) => {
                const index = indexById.get(command.id) ?? 0;
                return (
                  <CommandRow
                    key={command.id}
                    rowId={`cmd-row-${command.id}`}
                    command={command}
                    description={
                      language === "zh"
                        ? command.descriptionCn
                        : command.description
                    }
                    query={query}
                    active={index === activeIndex}
                    helpLabel={t.commandHelpFor.replace("{name}", command.name)}
                    onSelect={() => onCommandClick(command)}
                    onHelp={
                      onHelpClick ? () => onHelpClick(command) : undefined
                    }
                    onHover={() => {
                      if (!keyboardNav) setActiveIndex(index);
                    }}
                  />
                );
              })}
            </div>
          ))}

          {groups.length === 0 && (
            <div className="flex flex-col items-start gap-1 px-2 pb-2 pt-5">
              <span className="text-[12px] font-medium">
                {t.commandEmptyTitle}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t.commandEmptyHint.replace("{query}", debouncedQuery)}
              </span>
              <div className="mt-1.5 flex gap-1.5">
                {[
                  t.commandExampleDedup,
                  t.commandExampleAmount,
                  t.commandExamplePivot,
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onSearchChange(example)}
                    className="rounded border border-primary/30 px-1.5 font-mono text-[10px] leading-[15px] text-primary transition-colors hover:bg-primary/[0.08]"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="flex h-[34px] flex-none items-center gap-2 whitespace-nowrap border-t border-border-soft pl-3.5 pr-3 text-[10.5px] text-muted-foreground">
        <span>
          {searching
            ? t.commandHits
                .replace("{n}", String(result.hits))
                .replace("{total}", String(result.total))
            : t.commandCount.replace("{count}", String(result.total))}
        </span>
        <span className="ml-auto flex flex-none items-center gap-1 text-[10px] text-muted-foreground/60">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <Kbd>⏎</Kbd>
          <Kbd>esc</Kbd>
        </span>
      </div>
    </div>
  );
});
