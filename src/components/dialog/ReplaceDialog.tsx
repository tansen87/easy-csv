import { useState } from "react";
import { X, Plus, Trash2, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { xanCommands } from "@/data/commands";
import { XanCommand } from "@/types/xan";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useDraggable } from "@/hooks/useDraggable";

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
    alias?: string,
  ) => void;
  onClose: () => void;
}

interface ReplacePair {
  pattern: string;
  replace: string;
  regex: boolean;
  ignoreCase: boolean;
}

export function ReplaceDialog({
  replaceDialog,
  headers,
  onAddCommand,
  onClose,
}: ReplaceDialogProps) {
  const [selectedColumn, setSelectedColumn] = useState(headers[replaceDialog.col] || "");
  const [replacePairs, setReplacePairs] = useState<ReplacePair[]>([
    { pattern: "", replace: "", regex: false, ignoreCase: false },
  ]);
  const { position, isDragging, handleMouseDown } = useDraggable({
    initialX: replaceDialog.x,
    initialY: replaceDialog.y,
    maxWidth: 300,
    maxHeight: 400,
  });

  const handleApply = () => {
    if (!selectedColumn) return;

    const validPairs = replacePairs.filter((p) => p.pattern.trim());
    if (validPairs.length === 0) return;

    const mapCommand = xanCommands.find((cmd) => cmd.id === "map");
    if (mapCommand) {
      // Nest the replace calls: replace(replace(col, p1, r1), p2, r2)
      const expression = validPairs.reduce((acc, pair) => {
        let patternExpr: string;
        if (pair.regex) {
          const flags = pair.ignoreCase ? "i" : "";
          patternExpr = `/${pair.pattern}/${flags}`;
        } else {
          patternExpr = `"${pair.pattern}"`;
        }
        return `replace(${acc}, ${patternExpr}, "${pair.replace}")`;
      }, `col("${selectedColumn}")`) + ` as "${selectedColumn}"`;

      onAddCommand(mapCommand, {
        expression,
        overwrite: true,
        output: "",
      }, "Replace");
    }
    onClose();
  };

  const addReplacePair = () => {
    setReplacePairs((prev) => [
      ...prev,
      { pattern: "", replace: "", regex: false, ignoreCase: false },
    ]);
  };

  const removeReplacePair = (index: number) => {
    setReplacePairs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateReplacePair = (
    index: number,
    field: keyof ReplacePair,
    value: string | boolean,
  ) => {
    setReplacePairs((prev) =>
      prev.map((pair, i) =>
        i === index ? { ...pair, [field]: value } : pair,
      ),
    );
  };

  return (
    <div
      className={`fixed bg-card border rounded-lg shadow-xl z-50 w-[280px] h-[420px] flex flex-col select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
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
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 py-2 border-b shrink-0">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          Column
        </label>
        <SearchableSelect
          value={selectedColumn}
          onChange={setSelectedColumn}
          options={headers.map((header) => ({ label: header, value: header }))}
          placeholder="Search or select column..."
        />
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Replace Pairs
            </label>
            <button
              onClick={addReplacePair}
              className="flex items-center gap-1 px-2 py-0.5 text-xs hover:bg-accent rounded-md transition-colors text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {replacePairs.map((pair, index) => (
              <div key={index} className="p-2 border rounded-md bg-muted/30 space-y-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-medium">#{index + 1}</span>
                  {replacePairs.length > 1 && (
                    <button
                      onClick={() => removeReplacePair(index)}
                      className="ml-auto p-0.5 hover:bg-accent rounded transition-colors"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    value={pair.pattern}
                    onChange={(e) => updateReplacePair(index, "pattern", e.target.value)}
                    placeholder="Pattern"
                    className="no-drag flex-1 h-8 px-2 text-xs border rounded-md bg-background w-full"
                  />
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={pair.replace}
                    onChange={(e) => updateReplacePair(index, "replace", e.target.value)}
                    placeholder="Replacement"
                    className="no-drag flex-1 h-8 px-2 text-xs border rounded-md bg-background w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="no-drag flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pair.regex}
                      onChange={(e) => updateReplacePair(index, "regex", e.target.checked)}
                      className="h-3 w-3 accent-foreground"
                    />
                    Regex
                  </label>
                  <label className="no-drag flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pair.ignoreCase}
                      onChange={(e) => updateReplacePair(index, "ignoreCase", e.target.checked)}
                      className="h-3 w-3 accent-foreground"
                    />
                    Ignore Case
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 pb-2 flex gap-2 shrink-0">
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          className="flex-1 px-2 py-1.5 rounded-md"
          variant="secondary"
          size="sm"
          onClick={handleApply}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}