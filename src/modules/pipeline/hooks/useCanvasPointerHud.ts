import { useEffect, useRef, type RefObject } from "react";

export type PointerHudChangeHandler = (
  buttons: number[],
  space: boolean,
) => void;

/**
 * Lightweight mouse-button + Space tracker for the canvas HUD (see
 * docs/design/014_canvas-key-indicator.md). It only reports state at change
 * points (mousedown/mouseup/mouseleave/blur/Space keydown+keyup), so there is
 * no per-frame render. It deliberately does not call preventDefault or
 * stopPropagation, and does not touch cut/connect/ReactFlow handling.
 */
export function useCanvasPointerHud(
  containerRef: RefObject<HTMLElement>,
  onChange: PointerHudChangeHandler,
) {
  const buttons = useRef(new Set<number>()); // e.button: 0/1/2
  const spaceDown = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;

    // Fixed order [left, middle, right] (0→1→2), independent of press order.
    const emit = () =>
      onChangeRef.current?.(
        Array.from(buttons.current).sort((a, b) => a - b),
        spaceDown.current,
      );

    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable;

    // e.button (0/1/2) is only reliable on mousedown; on mouseup the button
    // attribute is always 0, so rebuild the set from the e.buttons bitmask
    // (1=left, 2=right, 4=middle) instead of trusting e.button.
    // Middle button (1) is intentionally not tracked: middle-drag panning is
    // a frequent, quiet gesture, so its "middle" capsule would be visual noise.
    // Only left (0) and right (2) are reported.
    const syncFromButtons = (bitmask: number) => {
      const next = new Set<number>();
      if (bitmask & 1) next.add(0); // left
      if (bitmask & 2) next.add(2); // right
      if (
        next.size !== buttons.current.size ||
        [...next].some((b) => !buttons.current.has(b))
      ) {
        buttons.current = next;
        emit();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 2) return;
      if (!buttons.current.has(e.button)) {
        buttons.current.add(e.button);
        emit();
      }
    };
    const onMouseUp = (e: MouseEvent) => syncFromButtons(e.buttons);
    const onMouseLeave = (e: MouseEvent) => {
      // Dragging keeps the pointer inside via setPointerCapture for the frame,
      // so only a real release (no buttons held) clears the tracked set.
      if (e.buttons === 0 && buttons.current.size > 0) {
        buttons.current.clear();
        emit();
      }
    };
    const onBlur = () => {
      if (buttons.current.size > 0 || spaceDown.current) {
        buttons.current.clear();
        spaceDown.current = false;
        emit();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if ((e.key === " " || e.key === "Spacebar") && !spaceDown.current) {
        spaceDown.current = true;
        emit();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Spacebar") && spaceDown.current) {
        spaceDown.current = false;
        emit();
      }
    };

    // Listen in the CAPTURE phase: ReactFlow stops propagation for pan/selection
    // mousedown/mouseup on the pane, so bubbling listeners on the wrapper never
    // see the button. Capture runs before that stop and still reaches our
    // tracking without touching cut/connect/ReactFlow behavior.
    container?.addEventListener("mousedown", onMouseDown, true);
    container?.addEventListener("mouseup", onMouseUp, true);
    container?.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("blur", onBlur);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      container?.removeEventListener("mousedown", onMouseDown, true);
      container?.removeEventListener("mouseup", onMouseUp, true);
      container?.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [containerRef]);
}
