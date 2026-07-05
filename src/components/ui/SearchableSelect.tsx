import { useState, useRef, useEffect } from "react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = searchValue
    ? options.filter(opt => opt.label.toLowerCase().includes(searchValue.toLowerCase()))
    : options;

  const selectedOption = options.find(opt => opt.value === value);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setIsOpen(true);
  };

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchValue("");
  };

  const inputClassName = size === "md"
    ? "w-full h-8 px-3 pr-8 text-sm border rounded-md bg-background"
    : "w-full h-8 px-3 pr-8 text-xs border rounded-md bg-background";

  const iconSize = size === "md" ? "h-3 w-3" : "h-3 w-3";

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={isOpen ? searchValue : (selectedOption?.label || "")}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={inputClassName}
      />
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchValue("");
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
      >
        <ChevronDown className={`${iconSize} text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full border rounded-md bg-background shadow-lg mt-1">
          <ScrollArea className="h-40 pr-2">
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors truncate rounded-md"
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