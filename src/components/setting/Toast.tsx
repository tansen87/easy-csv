import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertCircle, Info, X } from "lucide-react";
import { useLanguage } from "@/i18n";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
  /**
   * Optional button, e.g. "View result" on the pipeline-completion toast
   * (design 027 §4.3). Clicking it also dismisses the toast.
   */
  action?: ToastAction;
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const colorMap = {
  success: "bg-success-soft text-success border-success/20",
  error: "bg-danger-soft text-danger border-danger/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  info: "bg-info-soft text-info border-info/20",
};

const iconColorMap = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

export function Toast({
  message,
  type = "info",
  onClose,
  duration = 5000,
  action,
}: ToastProps) {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = iconMap[type];

  return (
    <div
      className={`pointer-events-auto fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-2 py-2 rounded-lg border backdrop-blur-sm transition-all duration-300 ${colorMap[type]} ${
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <Icon className={`h-5 w-5 ${iconColorMap[type]} flex-shrink-0`} />
      <span className="text-sm font-medium">{message}</span>
      {action && (
        <button
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="ml-1 shrink-0 rounded-md border border-border/60 bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground transition-colors hover:bg-background"
        >
          {action.label}
        </button>
      )}
      <button
        onClick={onClose}
        aria-label={t.close}
        className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export interface ToastContainerProps {
  toasts: {
    id: string;
    message: string;
    type: ToastType;
    action?: ToastAction;
    duration?: number;
  }[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center p-4 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          action={toast.action}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}
