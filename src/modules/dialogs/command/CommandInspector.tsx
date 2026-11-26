import { useEffect, useRef } from "react";
import { BookOpen, Maximize2, X } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { CommandFormBody } from "@/modules/dialogs/command/CommandFormBody";
import { COMMAND_LABELS, type CommandDialogState } from "@/types/dialog";
import { useLanguage } from "@/i18n";

interface CommandInspectorProps {
  commandDialog: CommandDialogState;
  onAddCommand: (
    command: import("@/types/xan").XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
  sourceTable?: string;
  onShowHelp?: (commandName: string) => void;
  /** Design 081 · D: expand into the wide split dialog. */
  onExpand: () => void;
}

/**
 * Design 081 · A — the right-hand parameter inspector.
 *
 * A real column beside the canvas (not an overlay): selecting a step swaps the
 * right side to its parameters, the canvas keeps its full height, and there is
 * no backdrop or drag. Complex forms can expand into the wide dialog (D).
 */
export function CommandInspector({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
  sourceTable,
  onShowHelp,
  onExpand,
}: CommandInspectorProps) {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCommandDialog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandDialog]);

  // Land in the first field, the same way the old dialog did.
  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLElement>(
        "input:not([type='hidden']), textarea, select",
      )
      ?.focus();
  }, [commandDialog.type, commandDialog.stepId]);

  const title = commandDialog.stepLabel ?? COMMAND_LABELS[commandDialog.type];

  return (
    <aside
      ref={panelRef}
      data-testid="command-inspector"
      className="mt-9 flex h-[calc(100%-2.25rem)] w-[470px] max-w-[55vw] flex-none flex-col border-l border-border bg-card"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex h-11 flex-none items-center gap-2 border-b border-border px-3.5">
        <h3 className="min-w-0 truncate text-[13.5px] font-medium text-foreground">
          {title}
        </h3>
        <span className="flex-none font-mono text-[10px] text-muted-foreground">
          {commandDialog.type}
        </span>
        <div className="ml-auto flex flex-none items-center gap-0.5">
          <Tooltip content={t.commandExpand}>
            <button
              type="button"
              aria-label={t.commandExpand}
              onClick={onExpand}
              className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          {onShowHelp && (
            <Tooltip content={t.commandDocs}>
              <button
                type="button"
                aria-label={t.commandDocs}
                onClick={() => onShowHelp(commandDialog.type)}
                className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <BookOpen className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
          <Tooltip content={t.close}>
            <button
              type="button"
              aria-label={t.close}
              onClick={() => setCommandDialog(null)}
              className="grid h-[26px] w-[26px] place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <CommandFormBody
          commandDialog={commandDialog}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
          headers={headers}
          sourceTable={sourceTable}
          fill
        />
      </div>
    </aside>
  );
}
