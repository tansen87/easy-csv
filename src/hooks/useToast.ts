import { useState, useCallback, useRef } from "react";
import { ToastType } from "@/components/setting/Toast";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const removeToastRef = useRef(removeToast);
  removeToastRef.current = removeToast;

  return { toasts, showToast, removeToast, showToastRef, removeToastRef };
}
