import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { COMMAND_FORMS } from "@/modules/dialogs/command";
import { COMMAND_LABELS, type CommandDialogState } from "@/types/dialog";
import { useLanguage } from "@/i18n";

// Kept as a re-export so imports written against the old location keep working
// while call sites migrate to `@/types/dialog` (design 019 §8).
export type {
  CommandDialogState,
  CommandDialogType,
  CommandFormProps,
} from "@/types/dialog";
export { COMMAND_LABELS } from "@/types/dialog";

interface CommandDialogProps {
  commandDialog: CommandDialogState | null;
  onAddCommand: (
    command: import("@/types/xan").XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
}

/**
 * Unified entry point for every command parameter form.
 *
 * Split in two so the hooks in `CommandDialogShell` are never called
 * conditionally — the previous single-component version returned early on a
 * null dialog *before* its hooks, which broke the rules of hooks
 * (`react-hooks/rules-of-hooks`).
 */
export function CommandDialog(props: CommandDialogProps) {
  if (!props.commandDialog) return null;
  return <CommandDialogShell {...props} commandDialog={props.commandDialog} />;
}

function CommandDialogShell({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
  sourceTable,
}: CommandDialogProps & { commandDialog: CommandDialogState }) {
  const { t } = useLanguage();
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
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
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
    const firstInput = dialogRef.current?.querySelector<HTMLElement>(
      "input:not([type='hidden']), textarea, select",
    );
    (firstInput ?? dialogRef.current)?.focus();
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
        className="absolute flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-card shadow-xl outline-none"
        style={{
          left: `calc(50% + ${offset.x}px)`,
          top: `calc(50% + ${offset.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex h-[52px] shrink-0 cursor-grab items-center gap-2.5 border-b border-border px-5 select-none active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-medium text-foreground">
              {COMMAND_LABELS[commandDialog.type]}
            </h3>
            <span className="font-mono text-[11px] text-muted-foreground">
              {commandDialog.type}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto cursor-pointer"
            aria-label={t.close}
            onClick={() => setCommandDialog(null)}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex min-h-0 flex-col">
          {FormComponent && (
            <FormComponent
              commandDialog={commandDialog}
              onAddCommand={onAddCommand}
              onStepUpdate={onStepUpdate}
              setCommandDialog={setCommandDialog}
              headers={headers}
              sourceTable={sourceTable}
            />
          )}
        </div>
      </div>
    </div>
  );
}
