import { useState, useCallback, useRef } from "react";
import { ToastAction, ToastType } from "@/components/setting/Toast";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
  duration?: number;
}

export interface ToastOptions {
  /** Optional button, e.g. the pipeline-completion toast's "View result". */
  action?: ToastAction;
  /** Milliseconds before auto-dismiss (Toast's own default is 5000). */
  duration?: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          type,
          action: options?.action,
          duration: options?.duration,
        },
      ]);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const removeToastRef = useRef(removeToast);
  removeToastRef.current = removeToast;

  return { toasts, showToast, removeToast, showToastRef, removeToastRef };
}
