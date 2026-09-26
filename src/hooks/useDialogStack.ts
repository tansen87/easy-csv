import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Payload + open state for one dialog kind. */
export interface DialogState<P = unknown> {
  open: boolean;
  payload?: P;
}

/**
 * Unified dialog switch stack (019 §4.4, resolves 007 D4 Esc semantics):
 *
 * - one state bag replaces scattered `showXxx` / `setShowXxx` pairs;
 * - dialogs are tracked in open order, `Esc` closes only the topmost one;
 * - `open(kind, payload?)` / `close(kind)` / `closeTop()` / `closeAll()`;
 * - `onEsc` can be disabled per app (e.g. while a drag gesture is running).
 *
 * Migration note: existing `ui.setShowXxx` call sites can move over in
 * batches — `open(kind)` replaces `setShowXxx(true)`, `close(kind)` replaces
 * `setShowXxx(false)`, and per-dialog payloads replace the companion state
 * (e.g. `editingTemplate`).
 */
export function useDialogStack<K extends string>(options?: {
  /** Set false to temporarily disable the global Esc handler. */
  escEnabled?: boolean;
}) {
  const escEnabled = options?.escEnabled ?? true;

  const [states, setStates] = useState<Partial<Record<K, DialogState>>>({});
  // Open order (oldest first) so Esc can close only the topmost dialog.
  const orderRef = useRef<K[]>([]);

  const open = useCallback((kind: K, payload?: unknown) => {
    orderRef.current = orderRef.current.filter((k) => k !== kind);
    orderRef.current.push(kind);
    setStates((prev) => ({ ...prev, [kind]: { open: true, payload } }));
  }, []);

  const close = useCallback((kind: K) => {
    orderRef.current = orderRef.current.filter((k) => k !== kind);
    setStates((prev) => ({ ...prev, [kind]: { open: false } }));
  }, []);

  const closeTop = useCallback(() => {
    const top = orderRef.current[orderRef.current.length - 1];
    if (top) close(top);
  }, [close]);

  const closeAll = useCallback(() => {
    orderRef.current = [];
    setStates({});
  }, []);

  // Esc closes only the topmost dialog (007 D4).
  useEffect(() => {
    if (!escEnabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Respect open HTML dialogs (radix handles its own Esc).
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) return;
      closeTop();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [escEnabled, closeTop]);

  const isOpen = useCallback(
    (kind: K) => states[kind]?.open === true,
    [states],
  );

  const payloadOf = useCallback(
    <P>(kind: K) => states[kind]?.payload as P | undefined,
    [states],
  );

  return useMemo(
    () => ({
      states: states as Readonly<Partial<Record<K, DialogState>>>,
      open,
      close,
      closeTop,
      closeAll,
      isOpen,
      payloadOf,
      /** Number of currently open dialogs (topmost = last). */
      openCount: orderRef.current.length,
    }),
    [states, open, close, closeTop, closeAll, isOpen, payloadOf],
  );
}

export type DialogStack = ReturnType<typeof useDialogStack>;
