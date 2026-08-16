import React, { useEffect, useMemo, useState } from "react";
import { Search, Terminal, Table } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { commandIconMap } from "@/components/CommandList";
import { PipelineStep } from "@/types/xan";
import { useLanguage } from "@/i18n";

interface SearchResult {
  step: PipelineStep | null;
  displayName: string;
  secondaryName: string | null;
  isTableNode?: boolean;
}

interface SearchOverlayProps {
  isOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onClose: () => void;
  onEnter: (index: number) => void;
  onOpenCommandPalette: () => void;
  searchResults: SearchResult[];
  onResultClick: (step: PipelineStep | null, isTable?: boolean) => void;
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
      <mark key={idx} className="bg-foreground/20 rounded-sm px-0.5">
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

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (isOpen) setActiveIndex(0);
  }, [isOpen]);

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
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 w-80">
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
        {/* Search input box */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.searchFlow}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground">ESC</span>
        </div>

        {/* Search results dropdown list - only displayed when there is search content */}
        {searchQuery && searchResults.length > 0 && (
          <ScrollArea className="h-[16vh]">
            <div className="py-1">
              {searchResults.map((result, index) => {
                const CommandIcon = result.isTableNode
                  ? Table
                  : commandIconMap[result.step!.command.name] || Terminal;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={result.isTableNode ? "table-node" : result.step!.id}
                    onClick={() =>
                      onResultClick(result.step, result.isTableNode)
                    }
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between gap-2 ${
                      isActive ? "bg-accent/60" : "hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CommandIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">
                        {highlightSecondary(result.displayName)}
                      </span>
                    </div>
                    {result.secondaryName && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {highlightSecondary(result.secondaryName)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
