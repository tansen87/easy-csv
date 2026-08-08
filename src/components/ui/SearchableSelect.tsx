import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  size?: "sm" | "md";
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search or select...",
  size = "sm",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchValue
    ? options.filter(opt => opt.label.toLowerCase().includes(searchValue.toLowerCase()))
    : options;

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchValue, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchValue("");
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = useCallback((optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchValue("");
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        setSearchValue("");
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          handleSelect(filteredOptions[activeIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearchValue("");
        break;
      case "Tab":
        setIsOpen(false);
        setSearchValue("");
        break;
    }
  }, [isOpen, activeIndex, filteredOptions, handleSelect]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[activeIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const inputClassName = size === "md"
    ? "w-full h-8 px-3 pr-8 text-sm border rounded-md bg-background"
    : "w-full h-8 px-3 pr-8 text-xs border rounded-md bg-background";

  const iconSize = size === "md" ? "h-3 w-3" : "h-3 w-3";

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `ss-option-${activeIndex}` : undefined}
        value={isOpen ? searchValue : (selectedOption?.label || "")}
        onChange={(e) => {
          setSearchValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchValue("");
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
      >
        <ChevronDown className={`${iconSize} text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 w-full border rounded-md bg-background shadow-lg mt-1"
        >
          <ScrollArea className="h-40 px-2">
            <div className="p-1" ref={listRef}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, index) => (
                  <button
                    key={opt.value}
                    id={`ss-option-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full px-2 py-1.5 text-xs text-left transition-colors truncate rounded-md ${
                      activeIndex === index
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No options found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
