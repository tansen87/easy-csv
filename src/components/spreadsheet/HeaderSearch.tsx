import { useState, useMemo, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface HeaderSearchProps {
  headers: string[];
  onSelectHeader: (colIndex: number) => void;
}

export function HeaderSearch({ headers, onSelectHeader }: HeaderSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredHeaders = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
    return headers
      .map((header, index) => ({ header, index }))
      .filter(({ header }) => header.toLowerCase().includes(term));
  }, [headers, searchTerm]);

  const handleSelect = (index: number) => {
    onSelectHeader(index);
    setSearchTerm("");
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".header-search-container")) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (headers.length < 10) return null;

  return (
    <div ref={containerRef} className="header-search-container relative">
      <div className="w-[200px] flex items-center gap-2 px-3 py-1.5 text-sm bg-muted hover:bg-accent rounded-lg transition-colors border border-border/50">
        <Search className="h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search columns..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchTerm ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSearchTerm("");
              inputRef.current?.focus();
            }}
            className="p-0.5 hover:bg-accent rounded shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {isOpen && searchTerm && (
        <div className="absolute top-full right-0 mt-2 w-[200px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {filteredHeaders.length > 0 ? (
              filteredHeaders.map(({ header, index }) => (
                <button
                  key={index}
                  onClick={() => handleSelect(index)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground w-6 shrink-0">#{index + 1}</span>
                  <span className="truncate">{header}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No columns found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
