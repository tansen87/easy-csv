import { useState } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface PadDialogState {
  col: number;
  x: number;
  y: number;
  padType: string;
}

interface PadDialogProps {
  padDialog: PadDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onClose: () => void;
}

const PAD_TYPES = [
  { label: "Pad", value: "pad" },
  { label: "Left Pad", value: "lpad" },
  { label: "Right Pad", value: "rpad" },
];

export function PadDialog({
  padDialog,
  headers,
  onAddCommand,
  onClose,
}: PadDialogProps) {
  const [selectedColumn, setSelectedColumn] = useState(headers[padDialog.col] || "");
  const [padType, setPadType] = useState(padDialog.padType || "pad");
  const [width, setWidth] = useState("10");
  const [char, setChar] = useState("");

  const handleApply = () => {
    if (!selectedColumn || !width) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (mapCommand) {
      const columnName = selectedColumn;
      let expression: string;

      const widthNum = parseInt(width, 10);
      if (char.trim()) {
        expression = `${padType}(col("${columnName}"), ${widthNum}, "${char}") as "${columnName}"`;
      } else {
        expression = `${padType}(col("${columnName}"), ${widthNum}) as "${columnName}"`;
      }

      onAddCommand(mapCommand, {
        expression,
        overwrite: true,
        output: "",
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[280px]"
      style={{
        left: Math.min(padDialog.x, window.innerWidth - 360),
        top: Math.min(padDialog.y, window.innerHeight - 320),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <span className="text-xs font-medium">Pad</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <SearchableSelect
            value={selectedColumn}
            onChange={setSelectedColumn}
            options={headers.map((header) => ({ value: header, label: header }))}
            placeholder="Search or select column..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Pad Type
          </label>
          <SearchableSelect
            value={padType}
            onChange={setPadType}
            options={PAD_TYPES}
            placeholder="Select pad type..."
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Width
          </label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            placeholder="Target width"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
            min="1"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Character (optional)
          </label>
          <input
            type="text"
            value={char}
            onChange={(e) => setChar(e.target.value)}
            placeholder="Space if blank"
            className="w-full h-8 px-2 text-xs border rounded bg-background"
            maxLength={1}
          />
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