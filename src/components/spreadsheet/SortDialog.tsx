import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";

interface SortDialogState {
  col: number;
  x: number;
  y: number;
}

interface SortDialogProps {
  sortDialog: SortDialogState;
  headers: string[];
  onAddCommand: (
    command: XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onClose: () => void;
}

export function SortDialog({
  sortDialog,
  headers,
  onAddCommand,
  onClose,
}: SortDialogProps) {
  const columnName = headers[sortDialog.col] || "";

  const handleSort = (order: "asc" | "desc", numeric: boolean) => {
    const sortCommand = xanCommands.find((cmd) => cmd.id === "sort");
    if (sortCommand) {
      onAddCommand(sortCommand, {
        reverse: order === "desc",
        select: columnName,
        numeric: numeric,
        output: "",
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-xl z-50 w-[140px]"
      style={{
        left: Math.min(sortDialog.x, window.innerWidth - 160),
        top: Math.min(sortDialog.y, window.innerHeight - 200),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <span className="text-xs font-medium">Sort</span>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2 space-y-1">
        <div className="text-[10px] font-medium text-muted-foreground px-1 mb-1">Text</div>
        <button
          className="w-full px-2 py-1.5 rounded text-xs bg-muted hover:bg-accent transition-colors border text-left"
          onClick={() => handleSort("asc", false)}
        >
          A → Z
        </button>
        <button
          className="w-full px-2 py-1.5 rounded text-xs bg-muted hover:bg-accent transition-colors border text-left"
          onClick={() => handleSort("desc", false)}
        >
          Z → A
        </button>
        <div className="text-[10px] font-medium text-muted-foreground px-1 mb-1 mt-2">Number</div>
        <button
          className="w-full px-2 py-1.5 rounded text-xs bg-muted hover:bg-accent transition-colors border text-left"
          onClick={() => handleSort("asc", true)}
        >
          0 → 9
        </button>
        <button
          className="w-full px-2 py-1.5 rounded text-xs bg-muted hover:bg-accent transition-colors border text-left"
          onClick={() => handleSort("desc", true)}
        >
          9 → 0
        </button>
      </div>
    </div>
  );
}
