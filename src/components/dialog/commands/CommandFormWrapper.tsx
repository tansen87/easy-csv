import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CommandDialogState } from "@/components/dialog/CommandDialog";
import { XanCommand } from "@/types/xan";
import { handleCommandSubmit } from "@/components/dialog/commands/helpers";
import { useLanguage } from "@/i18n";

interface CommandFormWrapperProps {
  commandDialog: CommandDialogState;
  onAddCommand: (command: XanCommand, params?: Record<string, any>) => void;
  onStepUpdate?: (stepId: string, params: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  disabled?: boolean;
  children?: ReactNode;
  scrollHeight?: string;
}

export function CommandFormWrapper({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  disabled,
  children,
  scrollHeight,
}: CommandFormWrapperProps) {
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

  const content = (
    <div ref={containerRef} className="relative space-y-3 pr-2.5">
      {children}
      {hint && (
        <div
          className="absolute z-50 bg-card border border-border/60 rounded-md shadow-sm px-2 py-1 text-[11px] text-muted-foreground/80 pointer-events-none leading-snug"
          style={{ top: hint.top, left: hint.left, maxWidth: hint.width }}
        >
          {t.variablePlaceholderHint}
        </div>
      )}
    </div>
  );

  const buttons = (
    <div className="flex justify-end gap-2 mt-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setCommandDialog(null)}
      >
        Cancel
      </Button>
      <Button
        variant="secondary"
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
        {commandDialog.isUpdate ? "Update" : "Add"}
      </Button>
    </div>
  );

  if (scrollHeight) {
    return (
      <>
        <ScrollArea style={{ height: scrollHeight }}>{content}</ScrollArea>
        {buttons}
      </>
    );
  }

  return (
    <>
      {content}
      {buttons}
    </>
  );
}
