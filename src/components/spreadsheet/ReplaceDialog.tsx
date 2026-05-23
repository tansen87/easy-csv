import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

interface ReplaceDialogState {
  col: number;
  x: number;
  y: number;
}

interface ReplaceDialogProps {
  replaceDialog: ReplaceDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onClose: () => void;
}

function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search or select...",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
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

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={isOpen ? searchValue : (selectedOption?.label || "")}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full h-8 px-2 pr-8 text-xs border rounded bg-background"
      />
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearchValue("");
        }}
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors"
      >
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full border rounded bg-background shadow-lg mt-1">
          <ScrollArea className="h-36">
            <div className="p-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors truncate"
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

export function ReplaceDialog({
  replaceDialog,
  headers,
  onAddCommand,
  onClose,
}: ReplaceDialogProps) {
  const [selectedColumn, setSelectedColumn] = useState(headers[replaceDialog.col] || "");
  const [pattern, setPattern] = useState("");
  const [replace, setReplace] = useState("");
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [regex, setRegex] = useState(false);

  const handleApply = () => {
    if (!pattern.trim() || !selectedColumn) return;

    const searchCommand = xanCommands.find((cmd) => cmd.id === "search");
    if (searchCommand) {
      onAddCommand(searchCommand, {
        select: selectedColumn,
        pattern: pattern,
        replace: replace,
        "ignore-case": ignoreCase,
        regex: regex,
        output: "",
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[280px]"
      style={{
        left: Math.min(replaceDialog.x, window.innerWidth - 360),
        top: Math.min(replaceDialog.y, window.innerHeight - 320),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs font-medium">Replace</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <SearchableSelect
            value={selectedColumn}
            onChange={setSelectedColumn}
            options={headers.map((header) => ({ label: header, value: header }))}
            placeholder="Search or select column..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Pattern
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Pattern to search"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Replace With
          </label>
          <input
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replacement string"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={ignoreCase}
              onChange={(e) => setIgnoreCase(e.target.checked)}
              className="h-4 w-4"
            />
            Ignore Case
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={regex}
              onChange={(e) => setRegex(e.target.checked)}
              className="h-4 w-4"
            />
            Regex
          </label>
        </div>
      </div>

      <div className="px-3 pb-2 flex gap-2">
          <button
            className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex-1 px-2 py-1.5 rounded text-xs bg-muted transition-colors"
            onClick={handleApply}
            disabled={!pattern.trim() || !selectedColumn}
          >
            Apply
          </button>
        </div>
    </div>
  );
}