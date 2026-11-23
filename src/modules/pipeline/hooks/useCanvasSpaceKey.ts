import { useEffect, useState } from "react";

/**
 * Tracks whether Space is held over the canvas.
 *
 * Space is React Flow's temporary pan key (`panActivationKeyCode="Space"`), so
 * the canvas's own mouse handlers stand down while it is down. This is state
 * the gesture code needs, not a HUD (the old key echo was retired, design 014).
 */
export function useCanvasSpaceKey(): boolean {
  const [spaceDown, setSpaceDown] = useState(false);

  useEffect(() => {
    const isTyping = (e: KeyboardEvent) =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable;

    const isSpace = (e: KeyboardEvent) =>
      e.key === " " || e.key === "Spacebar";

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      if (isSpace(e)) setSpaceDown(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isSpace(e)) setSpaceDown(false);
    };
    const onBlur = () => setSpaceDown(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  return spaceDown;
}
