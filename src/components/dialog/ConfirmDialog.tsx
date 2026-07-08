import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
}: ConfirmDialogProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="relative bg-card rounded-lg shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/20">
          <Button
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel || t.cancel}
          </Button>
          <Button
            variant="secondary"
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
