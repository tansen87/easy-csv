import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import type { CommandDialogState } from "@/types/dialog";
import { XanCommand } from "@/types/xan";
import { handleCommandSubmit } from "@/modules/dialogs/command/lib/helpers";
import { useLanguage } from "@/i18n";

interface CommandFormShellProps {
  commandDialog: CommandDialogState;
  onAddCommand: (command: XanCommand, params?: Record<string, any>) => void;
  onStepUpdate?: (stepId: string, params: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  disabled?: boolean;
  children?: ReactNode;
}

export function CommandFormShell({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  disabled,
  children,
}: CommandFormShellProps) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const hintNodeRef = useRef<HTMLElement | null>(null);
  const [hint, setHint] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const computePos = useCallback((node: HTMLElement) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return null;
    const r = node.getBoundingClientRect();
    return {
      top: r.bottom - box.top + 4,
      left: r.left - box.left,
      width: r.width,
    };
  }, []);

  // Unified `{{var}}` hint: any free-text input in the form that starts
  // containing "{{" gets a small tooltip under it. Covers every command form
  // (F3) without editing each raw <input>.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onInput = (e: Event) => {
      hintNodeRef.current = null;
      const tgt = e.target as HTMLElement | null;
      if (
        !tgt ||
        !(tgt instanceof HTMLInputElement || tgt instanceof HTMLTextAreaElement)
      )
        return;
      const value = (tgt as HTMLInputElement).value;
      if (typeof value === "string" && value.includes("{{")) {
        const pos = computePos(tgt);
        hintNodeRef.current = tgt;
        setHint(
          pos ? { top: pos.top, left: pos.left, width: pos.width } : null,
        );
      } else {
        setHint(null);
      }
    };
    const onFocusOut = (e: Event) => {
      if (e.target === hintNodeRef.current) {
        hintNodeRef.current = null;
        setHint(null);
      }
    };

    el.addEventListener("input", onInput, true);
    el.addEventListener("focusout", onFocusOut, true);
    return () => {
      el.removeEventListener("input", onInput, true);
      el.removeEventListener("focusout", onFocusOut, true);
    };
  }, [computePos]);

  return (
    <div className="flex min-h-0 flex-col">
      <ScrollArea
        className="min-h-0"
        hideHorizontalScrollbar
        blockContent
        viewportStyle={{ maxHeight: "calc(80vh - 108px)" }}
      >
        <div
          ref={containerRef}
          className="relative space-y-4 px-5 py-4 [&_label]:font-mono [&_label]:text-[11px] [&_label]:font-normal [&_label]:text-muted-foreground"
        >
          {children}
          {hint && (
            <div
              className="absolute z-50 rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] leading-snug text-muted-foreground/80 shadow-sm pointer-events-none"
              style={{ top: hint.top, left: hint.left, maxWidth: hint.width }}
            >
              {t.variablePlaceholderHint}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-border px-5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCommandDialog(null)}
        >
          {t.cancel}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            handleCommandSubmit({
              commandDialog,
              onAddCommand,
              onStepUpdate,
              setCommandDialog,
            })
          }
          disabled={disabled}
        >
          {commandDialog.isUpdate ? t.update : t.commandAdd}
        </Button>
      </div>
    </div>
  );
}
