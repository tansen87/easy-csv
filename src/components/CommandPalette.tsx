import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  type LucideIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/i18n";

export interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  icon?: LucideIcon;
  group: string;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: PaletteItem[];
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

  const filtered = useMemo(() => {
    const available = items.filter((item) => !item.disabled);
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter((item) => {
      const haystack = [
        item.label,
        item.description,
        item.keywords,
        item.group,
        item.shortcut,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const groups = useMemo(() => {
    const result: Array<{ name: string; items: PaletteItem[] }> = [];
    filtered.forEach((item) => {
      const last = result[result.length - 1];
      if (last && last.name === item.group) {
        last.items.push(item);
      } else {
        result.push({ name: item.group, items: [item] });
      }
    });
    return result;
  }, [filtered]);

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
  }, [activeIndex, filtered.length]);

  const select = useCallback(
    (item: PaletteItem) => {
      item.onSelect();
      onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setKeyboardNav(true);
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        setKeyboardNav(true);
        const item = filtered[activeIndex];
        if (item) select(item);
      }
    },
    [filtered, activeIndex, select, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-foreground/20 backdrop-blur-xs flex items-start justify-center z-50 pt-[20vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        onMouseMove={() => setKeyboardNav(false)}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder={t.commandPalettePlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground/70 flex-shrink-0">
            esc
          </kbd>
        </div>

        <ScrollArea className="h-[min(420px,calc(100vh-300px))]">
          <div className="py-2">
            {groups.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t.paletteNoResults}
              </div>
            )}
            {groups.map((group) => (
              <div key={group.name}>
                <div className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  {group.name}
                </div>
                {group.items.map((item) => {
                  const index = filtered.indexOf(item);
                  const isActive = index === activeIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      ref={isActive ? activeItemRef : undefined}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => {
                        if (!keyboardNav) setActiveIndex(index);
                      }}
                      onClick={() => select(item)}
                      className={`w-full grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {Icon ? (
                        <Icon className="h-4 w-4 text-muted-foreground/70 flex-shrink-0" />
                      ) : (
                        <span className="w-4 flex-shrink-0" />
                      )}
                      <span className="min-w-0 overflow-hidden">
                        <span className="block text-sm font-medium truncate">
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="block text-xs text-muted-foreground/80 truncate">
                            {item.description}
                          </span>
                        )}
                      </span>
                      {item.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground/70 flex-shrink-0">
                          {item.shortcut}
                        </kbd>
                      )}
                      <CornerDownLeft
                        className={`h-3.5 w-3.5 flex-shrink-0 ${
                          isActive ? "text-primary" : "text-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            {t.paletteNavigateHint}
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            {t.paletteSelectHint}
          </span>
          <span className="flex items-center gap-1">{t.paletteCloseHint}</span>
        </div>
      </div>
    </div>
  );
});
