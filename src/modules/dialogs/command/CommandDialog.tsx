import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CommandFormBody } from "@/modules/dialogs/command/CommandFormBody";
import { COMMAND_LABELS, type CommandDialogState } from "@/types/dialog";
import { xanCommands } from "@/data/commands";
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
  /** Open this command's docs (design 074); the old dock row `?` moved here. */
  onShowHelp?: (commandName: string) => void;
  /**
   * Design 081 · D: collapse back into the right-hand inspector instead of
   * closing. Absent when the dialog is opened without an inspector behind it.
   */
  onCollapse?: () => void;
}

/**
 * Design 081 · D — the wide split dialog.
 *
 * Used for commands that need the extra context (batch-*, join, duckdb, chart):
 * parameters on the left, command description + input columns on the right.
 * Everyday tweaks open the right inspector instead (see `CommandInspector`).
 */
export function CommandDialog(props: CommandDialogProps) {
  if (!props.commandDialog) return null;
  return <CommandDialogShell {...props} commandDialog={props.commandDialog} />;
}

const DIALOG_MAX_HEIGHT = "min(80vh, 600px)";
/** Header (48) + footer (56) are fixed; the form body scrolls. */
const BODY_MAX_HEIGHT = `calc(${DIALOG_MAX_HEIGHT} - 104px)`;

function CommandDialogShell({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
  sourceTable,
  onShowHelp,
  onCollapse,
}: CommandDialogProps & { commandDialog: CommandDialogState }) {
  const { t, effectiveLanguage } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isZh = effectiveLanguage === "zh";
  /** Dragged position of the card, relative to its centred origin. */
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  /** The wide dialog is movable by its title bar, like the old modal. */
  const handleHeaderMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Buttons in the header keep their own clicks.
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const start = offset;

      const onMove = (moveEvent: MouseEvent) => {
        setOffset({
          x: start.x + moveEvent.clientX - startX,
          y: start.y + moveEvent.clientY - startY,
        });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [offset],
  );

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

  const title = commandDialog.stepLabel ?? COMMAND_LABELS[commandDialog.type];
  const command = xanCommands.find((entry) => entry.id === commandDialog.type);
  const description = isZh
    ? command?.descriptionCn || command?.description
    : command?.description;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={() => setCommandDialog(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-[min(80vh,600px)] w-[min(800px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl outline-none"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="flex h-12 shrink-0 cursor-grab items-center gap-2.5 border-b border-border px-4 select-none active:cursor-grabbing"
          onMouseDown={handleHeaderMouseDown}
        >
          <h3 className="min-w-0 truncate text-[14px] font-medium text-foreground">
            {title}
          </h3>
          <span className="flex-none font-mono text-[10.5px] text-muted-foreground">
            {commandDialog.type}
          </span>
          <div className="ml-auto flex flex-none items-center gap-0.5">
            {onCollapse && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px] font-normal text-muted-foreground"
                onClick={onCollapse}
              >
                <Minimize2 className="h-3.5 w-3.5" />
                {t.commandCollapse}
              </Button>
            )}
            {onShowHelp && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[11px] font-normal text-muted-foreground"
                onClick={() => onShowHelp(commandDialog.type)}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {t.commandDocs}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.close}
              onClick={() => setCommandDialog(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <CommandFormBody
              commandDialog={commandDialog}
              onAddCommand={onAddCommand}
              onStepUpdate={onStepUpdate}
              setCommandDialog={setCommandDialog}
              headers={headers}
              sourceTable={sourceTable}
              bodyMaxHeight={BODY_MAX_HEIGHT}
            />
          </div>

          {/* Second column: what the command does and which columns it sees.
              Hidden on narrow windows so the form keeps a usable width. */}
          <aside className="hidden w-[268px] flex-none flex-col overflow-y-auto border-l border-border-soft bg-muted/30 px-4 py-3 min-[860px]:flex">
            <div className="font-mono text-[10px] tracking-[0.02em] text-muted-foreground/60">
              {t.commandDocsSection}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {description || "—"}
            </p>

            <div className="mt-4 font-mono text-[10px] tracking-[0.02em] text-muted-foreground/60">
              {t.commandInputColumns}
              {headers.length > 0 ? ` · ${headers.length}` : ""}
            </div>
            {headers.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {headers.map((header) => (
                  <span
                    key={header}
                    className="max-w-full truncate rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {header}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                {t.commandNoInputColumns}
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
