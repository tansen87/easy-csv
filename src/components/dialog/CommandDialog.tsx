import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMAND_FORMS, COMMAND_LABELS } from "@/components/dialog/commands";

export type CommandDialogType =
  | "search"
  | "bisect"
  | "filter"
  | "sort"
  | "select"
  | "view"
  | "count"
  | "slice"
  | "head"
  | "tail"
  | "sample"
  | "dedup"
  | "shuffle"
  | "frequency"
  | "groupby"
  | "stats"
  | "agg"
  | "bins"
  | "window"
  | "headers"
  | "flatten"
  | "hist"
  | "plot"
  | "drop"
  | "map"
  | "transform"
  | "enum"
  | "fill"
  | "complete"
  | "blank"
  | "separate"
  | "top"
  | "cat"
  | "join"
  | "merge"
  | "rename"
  | "behead"
  | "fixlengths"
  | "explode"
  | "implode"
  | "input"
  | "scrape"
  | "fmt"
  | "to"
  | "from"
  | "reverse"
  | "transpose"
  | "pivot"
  | "unpivot"
  | "split"
  | "partition"
  | "range"
  | "run"
  | "eval"
  | "output"
  | "batch-filter"
  | "batch-from"
  | "batch-to";

export interface CommandDialogState {
  type: CommandDialogType;
  params: Record<string, any>;
  isUpdate?: boolean;
  stepId?: string;
}

interface CommandDialogProps {
  commandDialog: CommandDialogState;
  onAddCommand: (
    command: import("@/types/xan").XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
}

export function CommandDialog({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
}: CommandDialogProps) {
  if (!commandDialog) return null;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setOffset({
        x: dragStart.current.offsetX + (e.clientX - dragStart.current.x),
        y: dragStart.current.offsetY + (e.clientY - dragStart.current.y),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const FormComponent = COMMAND_FORMS[commandDialog.type];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCommandDialog(null);
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [setCommandDialog],
  );

  useEffect(() => {
    dialogRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onClick={() => setCommandDialog(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="absolute bg-card border rounded-xl shadow-xl w-full max-w-2xl p-4 outline-none"
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: `calc(50% + ${offset.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between mb-2 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <h3 className="text-lg font-semibold">
            {COMMAND_LABELS[commandDialog.type]}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCommandDialog(null)}
            aria-label="Close"
          >
            <X className="h-4 w-4 accent-foreground" />
          </Button>
        </div>

        {FormComponent && (
          <FormComponent
            commandDialog={commandDialog}
            onAddCommand={onAddCommand}
            onStepUpdate={onStepUpdate}
            setCommandDialog={setCommandDialog}
            headers={headers}
          />
        )}
      </div>
    </div>
  );
}
