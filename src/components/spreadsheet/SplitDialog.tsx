import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Plus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

interface SplitDialogState {
  col: number;
  x: number;
  y: number;
  sliceType?: string;
}

interface SplitDialogProps {
  splitDialog: SplitDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand, initialParameters?: Record<string, any>) => void;
  onClose: () => void;
}

const SPLIT_SEPARATORS = [
  { label: "Custom", value: "custom" },
  { label: "Space", value: " " },
  { label: "Tab", value: "\\t" },
  { label: "Comma (,)", value: "," },
  { label: "Semicolon (;)", value: ";" },
  { label: "Pipe (|)", value: "|" },
  { label: "Hyphen (-)", value: "-" },
  { label: "Underscore (_)", value: "_" },
  { label: "Colon (:)", value: ":" },
  { label: "Slash (/)", value: "/" },
];

const SLICE_TYPES = [
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
  { label: "Slice", value: "slice" },
  { label: "Split", value: "split" },
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

export function SplitDialog({
  splitDialog,
  headers,
  onAddCommand,
  onClose,
}: SplitDialogProps) {
  const [sliceType, setSliceType] = useState(splitDialog.sliceType || "slice");
  const [separator, setSeparator] = useState("/");
  const [customSeparator, setCustomSeparator] = useState("");
  const [outputColumnName, setOutputColumnName] = useState("new_col");
  const [selectedColumn, setSelectedColumn] = useState(headers[splitDialog.col] || "");
  const [isColumnOpen, setIsColumnOpen] = useState(false);
  const [leftLength, setLeftLength] = useState("4");
  const [rightLength, setRightLength] = useState("4");
  const [sliceStart, setSliceStart] = useState("0");
  const [sliceEnd, setSliceEnd] = useState("4");
  const [indices, setIndices] = useState<string[]>(["0"]);
  const [joinWith, setJoinWith] = useState("-");
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

    const outputName = outputColumnName.trim();
    const isOverwrite = outputName === selectedColumn;

    let expression = "";

    switch (sliceType) {
      case "left":
        expression = `col("${selectedColumn}")[:${leftLength}]`;
        break;
      case "right":
        expression = `col("${selectedColumn}")[-${rightLength}:]`;
        break;
      case "slice":
        expression = `col("${selectedColumn}")[${sliceStart}:${sliceEnd}]`;
        break;
      case "split": {
        const actualSeparator = separator === "custom" ? customSeparator : separator;
        const validIndices = indices.filter(i => i.trim() !== "");
        let splitExpr = `split(col("${selectedColumn}"), "${actualSeparator}")`;
        
        if (validIndices.length > 0) {
          if (validIndices.length === 1) {
            expression = `${splitExpr}[${validIndices[0]}]`;
          } else {
            const joinStr = joinWith || "";
            const indexParts = validIndices.map(i => `${splitExpr}[${i}]`).join(` ++ "${joinStr}" ++ `);
            expression = indexParts;
          }
        } else {
          expression = splitExpr;
        }
        break;
      }
    }

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

  const addIndexField = () => {
    setIndices([...indices, ""]);
  };

  const updateIndex = (index: number, value: string) => {
    const newIndices = [...indices];
    newIndices[index] = value;
    setIndices(newIndices);
  };

  const removeIndexField = (index: number) => {
    if (indices.length > 1) {
      setIndices(indices.filter((_, i) => i !== index));
    }
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[340px]"
      style={{
        left: Math.min(splitDialog.x, window.innerWidth - 360),
        top: Math.min(splitDialog.y, window.innerHeight - 520),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs font-medium">Text Operations</span>
        <button
          onClick={onClose} className="p-0.5 hover:bg-accent rounded transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ScrollArea className="h-[360px]">
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
            <div className="absolute z-50 w-[308px] border rounded bg-background shadow-lg">
              <ScrollArea className="h-24">
                <div className="p-1">
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
              </ScrollArea>
            </div>
          )}
        </div>

        <SearchableSelect
          label="Operation Type"
          value={sliceType}
          onChange={setSliceType}
          options={SLICE_TYPES}
          placeholder="Select operation..."
        />

        {sliceType === "left" && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
              Length
            </label>
            <input
              type="number"
              value={leftLength}
              onChange={(e) => setLeftLength(e.target.value)}
              placeholder="4"
              className="w-full h-8 px-2 text-xs border rounded bg-background"
            />
          </div>
        )}

        {sliceType === "right" && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
              Length
            </label>
            <input
              type="number"
              value={rightLength}
              onChange={(e) => setRightLength(e.target.value)}
              placeholder="4"
              className="w-full h-8 px-2 text-xs border rounded bg-background"
            />
          </div>
        )}

        {sliceType === "slice" && (
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Start Index
              </label>
              <input
                type="number"
                value={sliceStart}
                onChange={(e) => setSliceStart(e.target.value)}
                placeholder="0"
                className="w-full h-8 px-2 text-xs border rounded bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                End Index
              </label>
              <input
                type="number"
                value={sliceEnd}
                onChange={(e) => setSliceEnd(e.target.value)}
                placeholder="4"
                className="w-full h-8 px-2 text-xs border rounded bg-background"
              />
            </div>
          </div>
        )}

        {sliceType === "split" && (
          <>
            <SearchableSelect
              label="Separator"
              value={separator}
              onChange={setSeparator}
              options={SPLIT_SEPARATORS}
              placeholder="Select separator..."
            />

            {separator === "custom" && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                  Custom Separator
                </label>
                <input
                  type="text"
                  value={customSeparator}
                  onChange={(e) => setCustomSeparator(e.target.value)}
                  placeholder="Enter custom separator"
                  className="w-full h-8 px-2 text-xs border rounded bg-background"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Array Indices (0-based)
              </label>
              <div className="space-y-1">
                {indices.map((index, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={index}
                      onChange={(e) => updateIndex(idx, e.target.value)}
                      placeholder="0"
                      className="flex-1 h-8 px-2 text-xs border rounded bg-background"
                    />
                    {indices.length > 1 && (
                      <button
                        onClick={() => removeIndexField(idx)}
                        className="p-1 hover:bg-accent rounded transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addIndexField}
                  className="w-full h-8 px-2 text-xs border border-dashed rounded hover:border-accent transition-colors flex items-center justify-center gap-1"
                >
                  <Plus className="h-3 w-3 text-muted-foreground" />
                  Add Index
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
                Join With (for multiple indices)
              </label>
              <input
                type="text"
                value={joinWith}
                onChange={(e) => setJoinWith(e.target.value)}
                placeholder="e.g., -, _, /, etc."
                className="w-full h-8 px-2 text-xs border rounded bg-background"
              />
            </div>
          </>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Output Column Name
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
          disabled={!selectedColumn || (sliceType === "split" && separator === "custom" && !customSeparator)}
          className="w-full px-3 py-2 rounded text-xs bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          Apply
        </button>
        </div>
      </ScrollArea>
    </div>
  );
}
