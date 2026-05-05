import { useState, useRef, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

interface DateTransformDialogState {
  col: number;
  x: number;
  y: number;
}

interface DateTransformDialogProps {
  dateTransformDialog: DateTransformDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand, initialParameters?: Record<string, any>) => void;
  onClose: () => void;
}

const DATE_FORMATS = [
  { label: "YYYYMMDD", value: "%Y%m%d" },
  { label: "YYYYMMDDHHMMSS", value: "%Y%m%d%H%M%S" },
  { label: "YYYYMMDDHHMM", value: "%Y%m%d%H%M" },
  { label: "DDMMYYYY", value: "%d%m%Y" },
  { label: "DDMMYYYYHHMMSS", value: "%d%m%Y%H%M%S" },
  { label: "MMDDYYYY", value: "%m%d%Y" },
  { label: "MMDDYYYYHHMMSS", value: "%m%d%Y%H%M%S" },

  // YMD
  { label: "YYYY-MM-DD", value: "%Y-%m-%d" },
  { label: "YYYY/MM/DD", value: "%Y/%m/%d" },
  { label: "YYYY-MM-DD HH:mm:ss", value: "%Y-%m-%d %H:%M:%S" },
  { label: "YYYY/MM/DD HH:mm:ss", value: "%Y/%m/%d %H:%M:%S" },

  // YDM
  { label: "YYYY-DD-MM", value: "%Y-%d-%m" },
  { label: "YYYY/DD/MM", value: "%Y/%d/%m" },
  { label: "YYYY-DD-MM HH:mm:ss", value: "%Y-%d-%m %H:%M:%S" },
  { label: "YYYY/DD/MM HH:mm:ss", value: "%Y/%d/%m %H:%M:%S" },

  // MDY
  { label: "MM-DD-YYYY", value: "%m-%d-%Y" },
  { label: "MM/DD/YYYY", value: "%m/%d/%Y" },
  { label: "MM-DD-YYYY HH:mm:ss", value: "%m-%d-%Y %H:%M:%S" },
  { label: "MM/DD/YYYY HH:mm:ss", value: "%m/%d/%Y %H:%M:%S" },

  // MYD
  { label: "MM-YYYY-DD", value: "%m-%Y-%d" },
  { label: "MM/YYYY/DD", value: "%m/%Y/%d" },
  { label: "MM-YYYY-DD HH:mm:ss", value: "%m-%Y-%d %H:%M:%S" },
  { label: "MM/YYYY/DD HH:mm:ss", value: "%m/%Y/%d %H:%M:%S" },

  // DMY
  { label: "DD-MM-YYYY", value: "%d-%m-%Y" },
  { label: "DD/MM/YYYY", value: "%d/%m/%Y" },
  { label: "DD-MM-YYYY HH:mm:ss", value: "%d-%m-%Y %H:%M:%S" },
  { label: "DD/MM/YYYY HH:mm:ss", value: "%d/%m/%Y %H:%M:%S" },

  // DYM
  { label: "DD-YYYY-MM", value: "%d-%Y-%m" },
  { label: "DD/YYYY/MM", value: "%d/%Y/%m" },
  { label: "DD-YYYY-MM HH:mm:ss", value: "%d-%Y-%m %H:%M:%S" },
  { label: "DD/YYYY/MM HH:mm:ss", value: "%d/%Y/%m %H:%M:%S" },
];

function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Search or select...",
}: {
  label: string;
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
    <div className="space-y-1" ref={dropdownRef}>
      <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
        {label}
      </label>
      <div className="relative">
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
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors">
          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-[308px] border rounded bg-background shadow-lg">
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
                  No formats found
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

export function DateTransformDialog({
  dateTransformDialog,
  headers,
  onAddCommand,
  onClose,
}: DateTransformDialogProps) {
  const [inputFormat, setInputFormat] = useState("%Y%m%d");
  const [outputFormat, setOutputFormat] = useState("%d/%m/%Y");
  const [outputColumnName, setOutputColumnName] = useState("new_date");
  const [selectedColumn, setSelectedColumn] = useState(headers[dateTransformDialog.col] || "");
  const [isColumnOpen, setIsColumnOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  const filteredHeaders = selectedColumn
    ? headers.filter(header => header.toLowerCase().includes(selectedColumn.toLowerCase()))
    : headers;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setIsColumnOpen(false);
      }
    };
    if (isColumnOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isColumnOpen]);

  const handleColumnInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedColumn(e.target.value);
    setIsColumnOpen(true);
  };

  const handleColumnSelect = (header: string) => {
    setSelectedColumn(header);
    setIsColumnOpen(false);
  };

  const handleApply = () => {
    if (!selectedColumn) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (!mapCommand) return;

    const wrapColumn = (col: string) => {
      if (/[\s,"'`()\\]/.test(col)) {
        return "`" + col + "`";
      }
      return col;
    };

    const outputName = outputColumnName.trim();
    const isOverwrite = outputName === selectedColumn;

    const expression = `strftime(datetime(col(${wrapColumn(selectedColumn)}), "${inputFormat}"), "${outputFormat}")`;
    const expressionWithAlias = outputName !== ""
      ? `${expression} as "${outputName}"`
      : expression;

    onAddCommand(mapCommand, {
      expression: expressionWithAlias,
      output: "",
      overwrite: isOverwrite,
    });
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[340px]"
      style={{
        left: Math.min(dateTransformDialog.x, window.innerWidth - 360),
        top: Math.min(dateTransformDialog.y, window.innerHeight - 480),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs font-medium">Date Transform</span>
        <button
          onClick={onClose} className="p-0.5 hover:bg-accent rounded transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="space-y-1" ref={columnRef}>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <div className="relative">
            <input
              type="text"
              value={selectedColumn}
              onChange={handleColumnInputChange}
              onFocus={() => setIsColumnOpen(true)}
              placeholder="Search or select column..."
              className="w-full h-8 px-2 pr-8 text-xs border rounded bg-background"
            />
            <button
              onClick={() => setIsColumnOpen(!isColumnOpen)}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded transition-colors">
              <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isColumnOpen ? "rotate-180" : ""}`} />
            </button>
          </div>
          {isColumnOpen && (
            <div className="absolute z-50 w-[308px] max-h-24 overflow-y-auto border rounded bg-background shadow-lg">
              {filteredHeaders.length > 0 ? (
                filteredHeaders.map((header) => (
                  <button
                    key={header}
                    onClick={() => handleColumnSelect(header)}
                    className="w-full px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors truncate"
                  >
                    {header}
                  </button>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No columns found
                </div>
              )}
            </div>
          )}
        </div>

        <SearchableSelect
          label="Input Format"
          value={inputFormat}
          onChange={setInputFormat}
          options={DATE_FORMATS}
          placeholder="Search input format..."
        />

        <SearchableSelect
          label="Output Format"
          value={outputFormat}
          onChange={setOutputFormat}
          options={DATE_FORMATS}
          placeholder="Search output format..."
        />

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Output Column Name (optional)
          </label>
          <input
            type="text"
            value={outputColumnName}
            onChange={(e) => setOutputColumnName(e.target.value)}
            placeholder="Leave blank to keep original"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
          />
        </div>

        <button
          onClick={handleApply}
          disabled={!selectedColumn}
          className="w-full px-3 py-2 rounded text-xs bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Apply
        </button>
      </div>
    </div>
  );
}
