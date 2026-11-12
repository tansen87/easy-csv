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

import { searchItems, type ScoredItem } from "./lib/scoreItem";
import type { PaletteItem, PaletteSource } from "./lib/paletteTypes";

export type { PaletteItem, PaletteSource } from "./lib/paletteTypes";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: PaletteItem[];
}

/**
 * The chord as one string with the platform modifier: `Ctrl+O` → `⌘+O` on macOS.
 * Same shape as the menu bar (`MainMenu.tsx` prints `Ctrl+O` inside one `kbd`),
 * so the palette and the menus teach the same notation.
 */
function displayShortcut(shortcut: string): string {
  return shortcut.replace(/^Ctrl/, modKeySymbol());
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
 * background, no underline, no colour on the whole row — the query is the one
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

interface PaletteGroup {
  name: string;
  /** Flat index of the first row, so keyboard navigation stays global. */
  offset: number;
  items: ScoredItem[];
}

export const CommandPalette = React.memo(function CommandPalette({
  isOpen,
  onClose,
  items,
}: CommandPaletteProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardNav, setKeyboardNav] = useState(false);
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

  /** Empty query keeps the browsing groups; a query collapses them into one list. */
  const groups = useMemo<PaletteGroup[]>(() => {
    if (searching) return [];
    const out: PaletteGroup[] = [];
    results.forEach((row) => {
      const last = out[out.length - 1];
      if (last && last.name === row.item.group) {
        last.items.push(row);
      } else {
        out.push({
          name: row.item.group,
          offset: last ? last.offset + last.items.length : 0,
          items: [row],
        });
      }
    });
    return out;
  }, [results, searching]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setKeyboardNav(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results.length]);

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
      const last = results.length - 1;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => (prev >= last ? 0 : prev + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => (prev <= 0 ? last : prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        setKeyboardNav(true);
        const row = results[activeIndex];
        if (row) select(row);
      }
    },
    [results, activeIndex, select, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const countLabel = searching
    ? t.paletteCount
        .replace("{shown}", String(results.length))
        .replace("{total}", String(availableCount))
    : t.paletteTotal.replace("{count}", String(availableCount));

  const sourceLabel = (source?: PaletteSource): string => {
    switch (source) {
      case "action":
        return t.paletteSourceAction;
      case "command":
        return t.paletteCommands;
      case "tab":
        return t.paletteTabs;
      case "file":
        return t.recentFiles;
      case "template":
        return t.paletteTemplates;
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
        // Keep the caret in the input: rows are click targets, not focus stops.
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => {
          // A still pointer must not steal the selection — `scrollIntoView`
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
          "relative grid h-[34px] w-full items-center gap-x-3 rounded-md px-2.5 text-left",
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
            item.source === "command" && "font-mono text-[12.5px]",
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
            "max-w-[196px] truncate text-[11.5px] text-muted-foreground",
            isPath && "font-mono text-[10.5px] text-muted-foreground/70",
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-12 dark:bg-black/55"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="w-[560px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_48px_-20px_rgba(0,0,0,0.24),0_2px_6px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
        role="dialog"
        aria-modal="true"
      >
        <div className="grid h-[52px] grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-x-2.5 pl-4 pr-3.5 shadow-[inset_0_-1px_0_var(--border-soft)]">
          <span
            aria-hidden
            className="relative -top-px select-none text-center font-mono text-sm leading-none text-primary"
          >
            ›
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder={t.palettePlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-full min-w-0 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
          />
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/60">
            {countLabel}
          </span>
        </div>

        <ScrollArea
          className="max-h-[min(480px,calc(100vh_-_220px))]"
          viewportClassName="max-h-[min(480px,calc(100vh_-_220px))] overflow-y-auto"
          hideHorizontalScrollbar
        >
          <div className="px-1.5 py-1.5">
            {results.length === 0 ? (
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
              groups.map((group) => (
                <div key={group.name}>
                  <div className="flex items-baseline gap-1.5 px-2.5 pb-1 pt-2.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {group.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {group.items.length}
                    </span>
                  </div>
                  {group.items.map((row, i) =>
                    renderRow(row, group.offset + i),
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex h-10 items-center gap-3.5 pl-4 pr-3.5 shadow-[inset_0_1px_0_var(--border-soft)]">
          {results.length > 0 && (
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
            </>
          )}
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Key>esc</Key>
            {t.paletteCloseHint}
          </span>
        </div>
      </div>
    </div>
  );
});
