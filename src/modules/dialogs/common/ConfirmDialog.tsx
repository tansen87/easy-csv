import { useEffect, useId, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * What the action is about — a template name, an output path, a version
   * label. Printed in mono under a hairline (design 050) so the question and
   * the consequence each stay one short line.
   */
  detail?: string;
  /** `danger` for actions that erase records. Everything else keeps the ink button. */
  tone?: "default" | "danger";
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  detail,
  tone = "default",
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key === "Enter") {
        // A focused button already reacts to Enter itself; without this guard
        // the window listener would fire a second, possibly different action.
        if (document.activeElement instanceof HTMLButtonElement) return;
        onConfirm();
        return;
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
    [onCancel, onConfirm],
  );

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onCancel}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        className="animate-dialog-enter relative w-full max-w-[400px] overflow-hidden rounded-lg border border-border bg-card shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="px-5 pt-[18px] pb-4">
          <h3
            id={titleId}
            className="text-sm leading-5 font-medium text-foreground"
          >
            {title}
          </h3>
          <p
            id={messageId}
            className="mt-2 text-[13px] leading-[1.62] text-muted-foreground [overflow-wrap:anywhere]"
          >
            {message}
          </p>
          {detail && (
            <div className="mt-3.5 border-t border-border/60 pt-2.5 font-mono text-[11.5px] leading-snug tabular-nums text-foreground [overflow-wrap:anywhere]">
              {detail}
            </div>
          )}
        </div>
        <div className="flex h-14 items-center justify-end gap-2 border-t border-border px-5">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel || t.cancel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel || t.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
