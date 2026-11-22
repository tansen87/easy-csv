import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { modKeySymbol } from "@/utils/platform";
import {
  CommandPalette,
  type PaletteItem,
} from "@/modules/logs/CommandPalette";

/** Mirrors the `max-width: 959px` rule that hides `.command-field-wide`. */
const NARROW_QUERY = "(max-width: 959px)";

interface CommandBarProps {
  items: PaletteItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ring the field while the first-run guide points at it (design 074). */
  highlight?: boolean;
}

/**
 * Design 073: one field in the middle of the menu bar is the app's single
 * opening - click or type to get a panel anchored right under it. The panel is
 * portalled out of the title bar so its empty areas do not become window drag
 * handles (same reason the execute menu portals).
 *
 * Below 960px the field collapses into an icon button (`MainMenu`), and the
 * panel grows its own query row.
 */
export function CommandBar({
  items,
  isOpen,
  onOpenChange,
  highlight = false,
}: CommandBarProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [narrow, setNarrow] = useState(false);
  const [position, setPosition] = useState({ top: 42, left: 12, width: 620 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  // Open and close both start from a clean query, so `Ctrl F` never resumes an
  // old one and the field never keeps the last search after the panel closes.
  useEffect(() => {
    setQuery("");
  }, [isOpen]);

  const measure = useCallback(() => {
    const width = Math.min(620, window.innerWidth - 24);
    const rect = fieldRef.current?.getBoundingClientRect();
    const hasField = !!rect && rect.width > 0;
    const center = hasField
      ? rect!.left + rect!.width / 2
      : window.innerWidth / 2;
    const left = Math.max(
      12,
      Math.min(center - width / 2, window.innerWidth - width - 12),
    );
    // 11 = field bottom (31) → header bottom (36) → 6px gap. When the field is
    // collapsed the panel hangs just under the 36px bar.
    const top = (hasField ? rect!.bottom : 36) + 11;
    setPosition({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen, measure]);

  useEffect(() => {
    if (isOpen && !narrow) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen, narrow]);

  const close = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    onOpenChange(false);
  }, [onOpenChange]);

  const open = useCallback(() => {
    if (!isOpen) onOpenChange(true);
  }, [isOpen, onOpenChange]);

  return (
    <>
      <div
        ref={fieldRef}
        data-command-anchor
        className="command-field-wide absolute left-1/2 top-[5px] z-10 -translate-x-1/2"
        style={{ width: "clamp(180px, calc(100vw - 760px), 440px)" }}
      >
        <div
          className={cn(
            "flex h-[26px] items-center gap-2 rounded-[7px] border bg-background pl-2.5 pr-1.5 transition-colors",
            isOpen
              ? "border-primary/40 shadow-[0_0_0_2px_var(--brand-soft)]"
              : highlight
                ? "border-primary/50 shadow-[0_0_0_3px_var(--brand-12)]"
                : "border-border hover:border-foreground/20",
          )}
        >
          <span
            aria-hidden
            className="font-mono text-[13px] leading-none text-primary"
          >
            ›
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              open();
            }}
            onFocus={open}
            onMouseDown={open}
            placeholder={t.palettePlaceholder}
            aria-label={t.commandPalette}
            aria-expanded={isOpen}
            aria-controls="command-palette-list"
            role="combobox"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <kbd className="inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded border border-border px-1 font-mono text-[9.5px] leading-none text-muted-foreground/70">
            {modKeySymbol()} F
          </kbd>
        </div>
      </div>

      {isOpen &&
        createPortal(
          <CommandPalette
            isOpen={isOpen}
            onClose={close}
            items={items}
            query={query}
            onQueryChange={setQuery}
            withInput={narrow}
            position={position}
          />,
          document.body,
        )}
    </>
  );
}
