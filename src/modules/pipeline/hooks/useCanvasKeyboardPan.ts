import { useEffect, useRef, type RefObject } from "react";

const PAN_KEYS: Record<string, [number, number]> = {
  w: [0, 1],
  arrowup: [0, 1],
  a: [1, 0],
  arrowleft: [1, 0],
  s: [0, -1],
  arrowdown: [0, -1],
  d: [-1, 0],
  arrowright: [-1, 0],
}; // [dx, dy], The direction is the direction of the 'field of view'; View port translation is reversed

const BASE_SPEED = 600; // px/s, Screen space
const BOOST = 2; // Shift Acceleration Ratio

export function useCanvasKeyboardPan(
  instanceRef: RefObject<any>,
  enabled: boolean,
) {
  const pressed = useRef(new Set<string>());
  const shiftDown = useRef(false);
  const rafId = useRef(0);
  const lastTs = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable;

    const tick = (ts: number) => {
      const inst = instanceRef.current;
      if (inst && pressed.current.size > 0) {
        let dx = 0,
          dy = 0;
        pressed.current.forEach((k) => {
          const [x, y] = PAN_KEYS[k] ?? [0, 0];
          dx += x;
          dy += y;
        });
        const len = Math.hypot(dx, dy) || 1;
        const speed = BASE_SPEED * (shiftDown.current ? BOOST : 1);
        const dt = Math.min((ts - lastTs.current) / 1000, 0.1);
        const vp = inst.getViewport();
        inst.setViewport({
          x: vp.x + (dx / len) * speed * dt,
          y: vp.y + (dy / len) * speed * dt,
          zoom: vp.zoom,
        });
      }
      lastTs.current = ts;
      rafId.current =
        pressed.current.size > 0 ? requestAnimationFrame(tick) : 0;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Maintain the same guard as FlowPanel's existing keyboard processing
      if (isTyping(e)) return;
      // The combination keys yield to global shortcuts (Ctrl+D, Alt+A, Shift+S, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Shift") {
        shiftDown.current = true;
        return;
      }
      const k = e.key.toLowerCase();
      if (PAN_KEYS[k] && !pressed.current.has(k)) {
        e.preventDefault(); // Prevent scrolling of nested scroll containers with arrow keys
        pressed.current.add(k);
        lastTs.current = performance.now();
        if (!rafId.current) rafId.current = requestAnimationFrame(tick);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        shiftDown.current = false;
        return;
      }
      pressed.current.delete(e.key.toLowerCase());
    };
    const onBlur = () => {
      pressed.current.clear();
      shiftDown.current = false;
    }; // Window focus fallback

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [enabled, instanceRef]);
}
