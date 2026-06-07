import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "@/components/ThemeProvider";
import { ThemeAwareInput } from "@/components/theme/ThemeAwareInput";

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
  const { theme } = useTheme();
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

  const isAnimalIsland = theme === "animal-island";

  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  const dropdownClassName = isAnimalIsland
    ? "absolute z-50 w-full border rounded-lg shadow-lg mt-1 bg-[#F7F3EC]"
    : "absolute z-50 w-full border rounded bg-background shadow-lg mt-1";

  const optionClassName = isAnimalIsland
    ? "w-full px-2 py-0.5 text-sm text-left hover:bg-[#D4E5D7] transition-colors truncate rounded-xl"
    : "w-full px-2 py-1.5 text-sm text-left hover:bg-accent transition-colors truncate rounded-xl";

  const buttonClassName = isAnimalIsland
    ? "absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-[#D4E5D7] rounded transition-colors"
    : "absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors";

  return (
    <div className="relative" ref={dropdownRef}>
      {isAnimalIsland ? (
        <div className="relative">
          <ThemeAwareInput
            type="text"
            value={isOpen ? searchValue : (selectedOption?.label || "")}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
          />
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) setSearchValue("");
            }}
            className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-[#D4E5D7] rounded-md transition-colors`}
          >
            <ChevronDown className={`${iconSize} text-[#6B8E6B] transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <ThemeAwareInput
            type="text"
            value={isOpen ? searchValue : (selectedOption?.label || "")}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
          />
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) setSearchValue("");
            }}
            className={buttonClassName}
          >
            <ChevronDown className={`${iconSize} text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
      {isOpen && (
        <div className={dropdownClassName}>
          <ScrollArea className="h-40">
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`${optionClassName} ${opt.value === value ? (isAnimalIsland ? "bg-[#D4E5D7]" : "bg-accent") : ""}`}
                  >
                    {opt.label}
                  </button>
                ))
              ) : (
                <div className={`px-2 py-1.5 text-xs ${isAnimalIsland ? "text-[#6B8E6B]" : "text-muted-foreground"}`}>
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
