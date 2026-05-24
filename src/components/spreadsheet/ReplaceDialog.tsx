import { useState } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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
        >
          Apply
        </button>
      </div>
    </div>
  );
}