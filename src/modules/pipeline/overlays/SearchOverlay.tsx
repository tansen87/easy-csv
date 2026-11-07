import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Command, Table } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { PipelineStep } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface SearchResult {
  step: PipelineStep | null;
  displayName: string;
  secondaryName: string | null;
  isTableNode?: boolean;
  resultId?: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  onEnter: (index: number) => void;
  onOpenCommandPalette: () => void;
  searchResults: SearchResult[];
  onResultClick: (
    step: PipelineStep | null,
    isTable?: boolean,
    resultId?: string,
  ) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(q, i);
    if (idx === -1) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-sm bg-[color-mix(in_oklab,var(--canvas-ink)_22%,transparent)] px-0.5"
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    i = idx + q.length;
  }
  return parts;
}

export function SearchOverlay({
  isOpen,
  searchQuery,
  onSearchQueryChange,
  onClose,
  onEnter,
  searchResults,
  onResultClick,
  searchInputRef,
}: SearchOverlayProps) {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) setActiveIndex(0);
  }, [isOpen]);

  // Keep the keyboard-active row visible when results exceed the 5-row window.
  useEffect(() => {
    if (!isOpen) return;
    resultRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const highlightSecondary = useMemo(
    () => (text: string) => highlightText(text, searchQuery),
    [searchQuery],
  );

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) =>
        searchResults.length > 0 ? (i + 1) % searchResults.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        searchResults.length > 0
          ? (i - 1 + searchResults.length) % searchResults.length
          : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) onEnter(activeIndex);
    }
  };

  return (
    <div className="absolute left-1/2 top-3 z-50 w-[360px] -translate-x-1/2">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_4px_12px_rgba(0,0,0,0.07)] transition-colors focus-within:border-canvas-line-strong dark:shadow-none">
        {/* Search input box */}
        <div className="flex h-9 items-center gap-2 border-b border-border px-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.searchFlow}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded border border-border bg-muted px-[5px] font-mono text-[10.5px] font-normal text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Search results dropdown list - only displayed when there is search content */}
        {searchQuery && searchResults.length > 0 && (
          <ScrollArea
            hideHorizontalScrollbar
            blockContent
            viewportClassName="max-h-40 overflow-y-auto"
          >
            {searchResults.map((result, index) => {
              const CommandIcon =
                result.isTableNode || result.resultId ? Table : Command;
              const isActive = index === activeIndex;
              return (
                <button
                  key={
                    result.resultId ||
                    (result.isTableNode ? "table-node" : result.step!.id)
                  }
                  ref={(node) => {
                    resultRefs.current[index] = node;
                  }}
                  onClick={() =>
                    onResultClick(
                      result.step,
                      result.isTableNode,
                      result.resultId,
                    )
                  }
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex h-8 w-full items-center gap-2 px-2.5 text-left transition-colors ${
                    isActive
                      ? "bg-canvas-ink-soft text-foreground"
                      : "text-muted-foreground hover:bg-canvas-ink-soft"
                  }`}
                >
                  <CommandIcon className="h-[13px] w-[13px] shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {highlightSecondary(result.displayName)}
                  </span>
                  {result.secondaryName && (
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                      {highlightSecondary(result.secondaryName)}
                    </span>
                  )}
                </button>
              );
            })}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
