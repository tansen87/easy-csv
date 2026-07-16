import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpMarkdown } from "@/components/help/HelpMarkdown";
import { X, Search, ArrowUp, ArrowDown } from "lucide-react";
import { useLanguage } from "@/i18n";

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
  const { t } = useLanguage();

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const matches = useMemo(() => {
    if (!searchQuery.trim() || !content) {
      return [];
    }

    const escapedQuery = escapeRegExp(searchQuery);
    const regex = new RegExp(escapedQuery, "gi");
    const matchPositions: number[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matchPositions.push(match.index);
    }

    return matchPositions;
  }, [searchQuery, content]);

  useEffect(() => {
    setMatchCount(matches.length);
    if (matches.length > 0 && currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches, currentMatchIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "ArrowDown" && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
        }
      }
      if (e.key === "ArrowUp" && document.activeElement === searchInputRef.current) {
        e.preventDefault();
        if (matches.length > 0) {
          setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
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
      dialogRef.current?.focus();
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (matches.length === 0 || !scrollAreaRef.current) return;

    const currentMatchPosition = matches[currentMatchIndex];
    const scrollArea = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");

    if (scrollArea) {
      const totalLength = content.length;
      const scrollRatio = currentMatchPosition / totalLength;
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
      setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/20 backdrop-blur-xs flex items-center justify-center z-50">
      <div
        className="bg-card border rounded-lg shadow-xl p-4 w-full max-w-5xl h-[75vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{ outline: "none" }}
      >
        <div className="flex items-center flex-shrink-0">
          <div className="flex-1 flex justify-start">
            <h3 className="text-lg font-semibold">{commandName}</h3>
          </div>

          <div className="flex-1 flex justify-center items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8"
              />
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground min-w-[60px]">
                  {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0/0"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handlePreviousMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={handleNextMatch}
                  disabled={matchCount === 0}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 h-0">
          <div className="text-sm font-mono pr-2">
            <HelpMarkdown
              content={content}
              searchQuery={searchQuery}
            />
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 pt-2 text-xs text-muted-foreground">
          <span className="mr-4">{t.searchShortcut}</span>
          <span className="mr-4">{t.previousMatch}</span>
          <span className="mr-4">{t.nextMatch}</span>
          <span>{t.close}</span>
        </div>
      </div>
    </div>
  );
};
