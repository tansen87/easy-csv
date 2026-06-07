import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { ThemeAwareInput } from "@/components/theme/ThemeAwareInput";
import { ThemeAwareCheckbox } from "@/components/theme/ThemeAwareCheckbox";
import { ThemeAwareButton } from "@/components/theme/ThemeAwareButton";

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
  const [position, setPosition] = useState({ x: replaceDialog.x, y: replaceDialog.y });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;

    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
  }, [position.x, position.y]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    setPosition({
      x: Math.max(0, Math.min(dragRef.current.startPosX + deltaX, window.innerWidth - 300)),
      y: Math.max(0, Math.min(dragRef.current.startPosY + deltaY, window.innerHeight - 360)),
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleApply = () => {
    if (!pattern.trim() || !selectedColumn) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (mapCommand) {
      let patternExpr: string;
      if (regex) {
        // Regex mode: wrap pattern in slashes with optional case-insensitive flag
        const flags = ignoreCase ? "i" : "";
        patternExpr = `/${pattern}/${flags}`;
      } else {
        // Substring mode: wrap pattern in quotes
        patternExpr = `"${pattern}"`;
      }

      const expression = `replace(col("${selectedColumn}"), ${patternExpr}, "${replace}") as "${selectedColumn}"`;

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
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[240px] select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base font-medium">Replace</span>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">
            Column
          </label>
          <SearchableSelect
            value={selectedColumn}
            onChange={setSelectedColumn}
            options={headers.map((header) => ({ label: header, value: header }))}
            placeholder="Search or select column..."
          />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">
            Pattern
          </label>
          <ThemeAwareInput
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Pattern to search"
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">
            Replace With
          </label>
          <ThemeAwareInput
            type="text"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replacement string"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ThemeAwareCheckbox
            checked={ignoreCase}
            onChange={(e) => setIgnoreCase(e)}
          >
            Ignore Case
          </ThemeAwareCheckbox>
          <ThemeAwareCheckbox
            checked={regex}
            onChange={(e) => setRegex(e)}
          >
            Regex
          </ThemeAwareCheckbox>
        </div>
      </div>

      <div className="px-3 pb-2 flex gap-2">
        <ThemeAwareButton
          className="flex-1"
          onClick={onClose}
        >
          Cancel
        </ThemeAwareButton>
        <ThemeAwareButton
          className="flex-1"
          onClick={handleApply}
        >
          Apply
        </ThemeAwareButton>
      </div>
    </div>
  );
}