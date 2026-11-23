import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { modKeySymbol } from "@/utils/platform";
import { COMMAND_CATEGORY_VIEW } from "@/data/commands/categoryView";

import { searchItems, type ScoredItem } from "./lib/scoreItem";
import type { PaletteItem, PaletteSource } from "./lib/paletteTypes";

export type { PaletteItem, PaletteSource } from "./lib/paletteTypes";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: PaletteItem[];
  /** Live query, owned by the menu-bar field (design 073). */
  query: string;
  onQueryChange: (query: string) => void;
  /**
   * Render a query row inside the panel. Used below 960px, where the menu-bar
   * field is collapsed into an icon button.
   */
  withInput?: boolean;
  /** Fixed panel box, measured from the menu-bar field by `CommandBar`. */
  position: { top: number; left: number; width: number };
}

interface DirectoryGroup {
  key: string;
  /** Ledger index `01`–`14` for command categories; `null` elsewhere. */
  index: string | null;
  name: string;
  rows: ScoredItem[];
}

/**
 * The chord as one string with the platform modifier and no plus sign:
 * `Ctrl+O` → `Ctrl O`, and `⌘ O` on macOS. Same shape as the menu bar
 * (`MainMenu.tsx` prints `Ctrl O` inside one `kbd`) and the empty state's
 * `Ctrl O` hint, so the app teaches one notation everywhere.
 */
function displayShortcut(shortcut: string): string {
  return shortcut.replace(/^Ctrl/, modKeySymbol()).replace(/\+/g, " ");
}

/** One keycap. Matches the menu bar's shortcut chip: 18px tall, hairline, no fill. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border px-1 font-mono text-[10px] leading-none text-muted-foreground/70">
      {children}
    </kbd>
  );
}

/**
 * Highlight the matched runs of a string. Only colour and weight change: no
 * background, no underline, no colour on the whole row - the query is the one
 * coloured thing in the palette (design 053 §4).
 */
function Highlighted({
  text,
  ranges,
  className,
}: {
  text: string;
  ranges: { start: number; end: number }[];
  className?: string;
}) {
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, i) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(
      <b key={i} className={className}>
        {text.slice(range.start, range.end)}
      </b>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * The empty-query directory (design 073): the 14 command categories in their
 * ledger order, then current-pipeline steps, files and tabs. Commands carry
 * `category`; every other source carries its group name, so those groups keep
 * their own labels. App actions and templates live in the menu bar and its
 * shortcuts, not here - they would fill the whole first screen with a second
 * copy of the menus.
 */
function buildDirectory(
  rows: ScoredItem[],
  t: ReturnType<typeof useLanguage>["t"],
  language: "zh" | "en",
): DirectoryGroup[] {
  const groups: DirectoryGroup[] = [];
  const pick = (predicate: (item: PaletteItem) => boolean) =>
    rows.filter((row) => predicate(row.item));
  const push = (
    key: string,
    index: string | null,
    name: string,
    list: ScoredItem[],
  ) => {
    if (list.length > 0) groups.push({ key, index, name, rows: list });
  };

  const commands = pick((i) => i.source === "command");
  const known = new Set<string>();
  COMMAND_CATEGORY_VIEW.forEach((view) => {
    known.add(view.key);
    push(
      `cmd-${view.index}`,
      view.index,
      view.label[language],
      commands.filter((row) => row.item.category === view.key),
    );
  });
  push(
    "cmd-other",
    null,
    t.paletteCommands,
    commands.filter((row) => !known.has(row.item.category ?? "")),
  );

  push(
    "steps",
    null,
    t.paletteSteps,
    pick((i) => i.source === "step"),
  );
  push(
    "files",
    null,
    t.recentFiles,
    pick((i) => i.source === "file"),
  );
  push(
    "tabs",
    null,
    t.paletteTabs,
    pick((i) => i.source === "tab"),
  );

  return groups;
}

export const CommandPalette = React.memo(function CommandPalette({
  isOpen,
  onClose,
  items,
  query,
  onQueryChange,
  withInput = false,
  position,
}: CommandPaletteProps) {
  const { t, effectiveLanguage } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  const trimmed = query.trim();
  const searching = trimmed.length > 0;

  const results = useMemo(() => searchItems(items, query), [items, query]);
  // Available = what the count divides by; disabled entries are never offered.
  const availableCount = useMemo(
    () => items.filter((item) => !item.disabled).length,
    [items],
  );

  /** Empty query keeps the directory; a query collapses it into one ranked list. */
  const directory = useMemo<DirectoryGroup[]>(
    () => (searching ? [] : buildDirectory(results, t, effectiveLanguage)),
    [results, searching, t, effectiveLanguage],
  );

  /** One flat list across groups, so ↑↓ stays global. */
  const flat = useMemo<ScoredItem[]>(
    () => (searching ? results : directory.flatMap((group) => group.rows)),
    [searching, results, directory],
  );

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      setKeyboardNav(false);
      if (withInput) {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  }, [isOpen, withInput]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, flat.length]);

  // A popover has no overlay: clicks outside the panel - and outside the
  // menu-bar field - dismiss it. Clicking the field keeps it open.
  useEffect(() => {
    if (!isOpen) return;
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-command-anchor]")) return;
      onClose();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isOpen, onClose]);

  const select = useCallback(
    (row: ScoredItem) => {
      row.item.onSelect();
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // An IME composition ends with Enter; that Enter belongs to the input
      // method, not to "run the selected row".
      if (e.isComposing || e.keyCode === 229) return;
      const last = flat.length - 1;
      if (e.key === "Escape") {
        e.preventDefault();
        // First Esc clears the query, the next one closes (design 073 §6).
        if (query.trim()) onQueryChange("");
        else onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => (prev >= last ? 0 : prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => (prev <= 0 ? last : prev - 1));
      } else if (e.key === "Enter" && e.shiftKey) {
        // Design 074: Shift+Enter opens the row's docs without adding it.
        const row = flat[activeIndex];
        if (row?.item.onHelp) {
          e.preventDefault();
          setKeyboardNav(true);
          row.item.onHelp();
          onClose();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        setKeyboardNav(true);
        const row = flat[activeIndex];
        if (row) select(row);
      }
    },
    [flat, activeIndex, select, onClose, query, onQueryChange],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  // Search mode counts matches against what can be run; the directory shows
  // each group's own count instead.
  const countLabel = searching
    ? t.paletteCount
        .replace("{shown}", String(results.length))
        .replace("{total}", String(availableCount))
    : null;
  const activeRow = flat[activeIndex];

  const sourceLabel = (source?: PaletteSource): string => {
    switch (source) {
      case "command":
        return t.paletteCommands;
      case "step":
        return t.paletteSteps;
      case "tab":
        return t.paletteTabs;
      case "file":
        return t.recentFiles;
      default:
        return "";
    }
  };

  const renderRow = (row: ScoredItem, index: number) => {
    const { item, match } = row;
    const isActive = index === activeIndex;
    const isPath = item.source === "file" || item.source === "tab";

    return (
      <button
        key={item.id}
        ref={isActive ? activeItemRef : undefined}
        type="button"
        // Keep the caret in the field: rows are click targets, not focus stops.
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => {
          // A still pointer must not steal the selection - `scrollIntoView`
          // drags rows under it while the user is arrowing.
          if (!keyboardNav) setActiveIndex(index);
        }}
        onMouseMove={() => {
          // …but the moment the pointer really moves, it takes over.
          if (keyboardNav) {
            setKeyboardNav(false);
            setActiveIndex(index);
          }
        }}
        onClick={() => select(row)}
        className={cn(
          "relative grid h-[34px] w-full items-center gap-x-3 rounded-md px-2.5 text-left transition-colors",
          searching
            ? "grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            : "grid-cols-[minmax(0,1fr)_auto_auto]",
          isActive && "bg-[var(--brand-soft)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute bottom-2 left-0 top-2 w-0.5 rounded-full",
            isActive ? "bg-primary" : "bg-transparent",
          )}
        />
        <span
          className={cn(
            "min-w-0 truncate text-[13px] font-medium text-foreground",
            item.source === "command" && "font-mono text-[12.5px] font-normal",
            item.source === "step" && "font-mono text-[12.5px] font-normal",
          )}
        >
          <Highlighted
            text={item.label}
            ranges={match.labelRanges}
            className="font-semibold text-primary"
          />
        </span>
        <span
          className={cn(
            "max-w-[220px] truncate text-[11.5px] text-muted-foreground",
            isPath && "font-mono text-[10.5px] text-muted-foreground/70",
            item.source === "step" && "font-mono text-[10.5px]",
          )}
        >
          {item.description ? (
            <Highlighted
              text={item.description}
              ranges={match.descRanges}
              className="font-medium text-foreground"
            />
          ) : null}
        </span>
        {searching && (
          <span className="min-w-[26px] text-right font-mono text-[10px] text-muted-foreground/80">
            {sourceLabel(item.source)}
          </span>
        )}
        <span className="flex shrink-0 gap-[3px]">
          {item.shortcut ? <Key>{displayShortcut(item.shortcut)}</Key> : null}
        </span>
      </button>
    );
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t.commandPalette}
      data-command-palette
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: position.width,
      }}
      className="z-50 overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_48px_-20px_rgba(0,0,0,0.24),0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
    >
      {withInput && (
        <div className="grid h-11 grid-cols-[12px_minmax(0,1fr)] items-center gap-x-2.5 border-b border-[var(--border-soft)] pl-4 pr-3">
          <span
            aria-hidden
            className="relative -top-px select-none text-center font-mono text-sm leading-none text-primary"
          >
            ›
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t.palettePlaceholder}
            aria-label={t.commandPalette}
            className="h-full min-w-0 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
          />
        </div>
      )}

      <div className="flex h-[34px] items-center justify-between gap-3 border-b border-[var(--border-soft)] px-3 pt-0.5">
        <span className="min-w-0 truncate text-[10.5px] text-muted-foreground">
          <b className="font-medium text-foreground">
            {searching ? t.paletteSearchScope : t.paletteDirectory}
          </b>
          {" · "}
          {searching ? trimmed : t.paletteDirectoryHint}
        </span>
        {countLabel ? (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
            {countLabel}
          </span>
        ) : null}
      </div>

      <ScrollArea
        className="max-h-[min(352px,calc(100vh_-_180px))]"
        viewportClassName="max-h-[min(352px,calc(100vh_-_180px))] overflow-y-auto"
        hideHorizontalScrollbar
      >
        <div className="px-1.5 py-1.5" id="command-palette-list">
          {flat.length === 0 ? (
            <div className="px-2.5 pb-7 pt-6">
              <p className="m-0 text-[13px] text-foreground">
                {t.paletteEmptyTitle.replace("{query}", trimmed)}
              </p>
              <p className="m-0 mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                {t.paletteEmptyHint}
              </p>
            </div>
          ) : searching ? (
            results.map((row, index) => renderRow(row, index))
          ) : (
            directory.map((group) => (
              <div key={group.key}>
                <div className="sticky top-0 z-[1] flex items-baseline gap-1.5 bg-card px-2.5 pb-1 pt-2.5">
                  {group.index ? (
                    <span className="w-5 shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground/50">
                      {group.index}
                    </span>
                  ) : null}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {group.name}
                  </span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {group.rows.length}
                  </span>
                </div>
                {group.rows.map((row) => renderRow(row, flat.indexOf(row)))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="flex h-[34px] items-center gap-3.5 border-t border-[var(--border-soft)] pl-3 pr-3">
        {flat.length > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="flex gap-[2px]">
                <Key>↑</Key>
                <Key>↓</Key>
              </span>
              {t.paletteNavigateHint}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Key>↵</Key>
              {t.paletteSelectHint}
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 text-[11px]",
                activeRow?.item.onHelp
                  ? "text-muted-foreground"
                  : "text-muted-foreground/35",
              )}
            >
              <Key>⇧↵</Key>
              {t.commandDocs}
            </span>
          </>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Key>esc</Key>
          {t.paletteCloseHint}
        </span>
      </div>
    </div>
  );
});
