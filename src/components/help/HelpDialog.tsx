import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { HelpMarkdown, getSearchMatches } from "@/components/help/HelpMarkdown";
import { X, Search, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/i18n";

/** Keycap used for the search shortcut and the footer hint row. */
const KEYCAP_CLASS =
  "rounded-[3px] border border-border bg-background px-1 font-mono text-[9.5px] leading-[14px] text-muted-foreground";

interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  commandName: string;
  content: string;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  isOpen,
  onClose,
  commandName,
  content,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const hasFocusedRef = useRef(false);
  const { t } = useLanguage();

  const matches = useMemo(() => {
    return getSearchMatches(content, searchQuery);
  }, [searchQuery, content]);

  useEffect(() => {
    setMatchCount(matches.length);
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches, currentMatchIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (
        e.key === "ArrowDown" &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
        }
      }
      if (
        e.key === "ArrowUp" &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex(
            (prev) => (prev - 1 + matches.length) % matches.length,
          );
        }
      }
      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else {
          onClose();
        }
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [matches, searchQuery, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      // Only focus the dialog container on initial open, not on every re-render
      if (!hasFocusedRef.current) {
        dialogRef.current?.focus();
        hasFocusedRef.current = true;
      }
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    } else {
      // Reset focus state when dialog closes
      hasFocusedRef.current = false;
    }
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (matches.length === 0 || !scrollAreaRef.current) return;

    const scrollArea = scrollAreaRef.current.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (!scrollArea) return;

    const activeMatch = scrollArea.querySelector('[data-active-match="true"]');
    if (activeMatch instanceof HTMLElement) {
      activeMatch.scrollIntoView({ block: "center" });
    } else {
      const totalLength = content.length;
      const scrollRatio = matches[currentMatchIndex] / totalLength;
      const maxScroll = scrollArea.scrollHeight - scrollArea.clientHeight;
      scrollArea.scrollTop = scrollRatio * maxScroll;
    }
  }, [currentMatchIndex, matches, content]);

  const handleNextMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
    }
  };

  const handlePreviousMatch = () => {
    if (matches.length > 0) {
      setCurrentMatchIndex(
        (prev) => (prev - 1 + matches.length) % matches.length,
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="flex h-[min(700px,88vh)] w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-[10px] border border-border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{ outline: "none" }}
      >
        <div className="flex h-14 flex-none items-center gap-4 border-b border-border/60 px-5">
          <h3 className="min-w-0 truncate text-sm font-medium">{commandName}</h3>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative w-[260px]">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[30px] pl-8 pr-16 text-xs"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={t.helpClearSearch}
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <span
                  className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1 font-mono text-[9.5px] leading-[14px] text-muted-foreground"
                >
                  Ctrl F
                </span>
              )}
            </div>

            {searchQuery && (
              <div className="flex items-center gap-1">
                <span className="min-w-[42px] text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {matchCount > 0
                    ? `${currentMatchIndex + 1}/${matchCount}`
                    : t.helpNoMatches}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={t.helpPrevMatch}
                  className="h-[26px] w-[26px] p-0"
                  onClick={handlePreviousMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label={t.helpNextMatch}
                  className="h-[26px] w-[26px] p-0"
                  onClick={handleNextMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              aria-label={t.close}
              className="h-7 w-7 text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
          <div className="mx-auto max-w-[660px] px-4 py-6">
            <HelpMarkdown
              content={content}
              searchQuery={searchQuery}
              currentMatchIndex={currentMatchIndex}
            />
          </div>
        </ScrollArea>

        <div className="flex h-11 flex-none items-center gap-5 border-t border-border/60 px-5 text-[10.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={KEYCAP_CLASS}>Ctrl F</span>
            {t.helpSearchLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={KEYCAP_CLASS}>↑</span>
            <span className={KEYCAP_CLASS}>↓</span>
            {t.helpPrevMatch} / {t.helpNextMatch}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={KEYCAP_CLASS}>Esc</span>
            {t.close}
          </span>
        </div>
      </div>
    </div>
  );
};
