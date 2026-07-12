import React from "react";
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
  onEnter: () => void;
  searchResults: SearchResult[];
  onResultClick: (step: PipelineStep | null, isTable?: boolean) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
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

  if (!isOpen) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 w-80">
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden">
        {/* 搜索输入框 */}
        <div className="flex items-center gap-2 px-3 py-2 border-b">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              } else if (e.key === "Enter") {
                onEnter();
              }
            }}
            placeholder={t.searchFlow}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground">
            ESC
          </span>
        </div>

        {/* 搜索结果下拉列表 - 仅在有搜索内容时显示 */}
        {searchQuery && searchResults.length > 0 && (
          <ScrollArea className="h-[16vh]">
            <div className="py-1">
              {searchResults.map((result) => {
                const CommandIcon = result.isTableNode
                  ? Table
                  : (commandIconMap[result.step!.command.name] || Terminal);
                return (
                  <button
                    key={result.isTableNode ? "table-node" : result.step!.id}
                    onClick={() => onResultClick(result.step, result.isTableNode)}
                    className="w-full px-3 py-2 text-left hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CommandIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{result.displayName}</span>
                    </div>
                    {result.secondaryName && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                        {result.secondaryName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* 无结果提示 - 仅在有搜索内容但无匹配时显示 */}
        {searchQuery && searchResults.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No matching command found
          </div>
        )}
      </div>
    </div>
  );
}
