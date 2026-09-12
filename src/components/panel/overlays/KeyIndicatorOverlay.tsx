import { useEffect, useState } from "react";

// Fixed display order: W/A/S/D first, then arrow keys. Combinations are shown
// in this order regardless of the order keys were pressed (no jitter).
const PAN_KEYS_ORDER = [
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowleft",
  "arrowdown",
  "arrowright",
];

const DISPLAY: Record<string, string> = {
  w: "W",
  a: "A",
  s: "S",
  d: "D",
  arrowup: "↑",
  arrowleft: "←",
  arrowdown: "↓",
  arrowright: "→",
};

const FADE_MS = 200;

// After the last key/mouse release, stay fully visible for HOLD_MS, then fade
// out over FADE_MS before unmounting, so the HUD does not vanish abruptly.
const HOLD_MS = 600;

export interface KeyIndicatorOverlayProps {
  keys: string[];
  shift: boolean;
  buttons: number[];
  space: boolean;
  labels: { left: string; middle: string; right: string };
}

/** Pure, non-interactive HUD showing pressed keys/mouse buttons above the status bar. */
export function KeyIndicatorOverlay({
  keys,
  shift,
  buttons,
  space,
  labels,
}: KeyIndicatorOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [fading, setFading] = useState(false);

  const active = keys.length > 0 || buttons.length > 0 || space;

  useEffect(() => {
    if (active) {
      setMounted(true);
      setFading(false);
      return;
    }
    // Release: hold fully visible for a moment, then fade out before unmount.
    const fadeId = setTimeout(() => setFading(true), HOLD_MS);
    const unmountId = setTimeout(() => setMounted(false), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(fadeId);
      clearTimeout(unmountId);
    };
  }, [active]);

  if (!mounted) return null;

  const orderedKeys = Array.from(new Set(keys)).sort(
    (a, b) => PAN_KEYS_ORDER.indexOf(a) - PAN_KEYS_ORDER.indexOf(b),
  );
  const mouseLabels: Record<number, string> = {
    0: labels.left,
    1: labels.middle,
    2: labels.right,
  };
  // Group the mouse/Space inputs separately from keyboard keycaps.
  const hasMouse = buttons.length > 0 || space;

  return (
    <div
      className={`absolute bottom-8 left-3 z-50 flex items-center gap-1 select-none pointer-events-none transition-opacity duration-200 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      {orderedKeys.map((k) => (
        <kbd
          key={k}
          className="min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded border border-border/60 bg-card/80 text-[11px] text-muted-foreground font-medium shadow-sm"
        >
          {DISPLAY[k] ?? k.toUpperCase()}
        </kbd>
      ))}
      {hasMouse && orderedKeys.length > 0 && (
        <span className="w-px h-3 bg-border/40" />
      )}
      {buttons.map((b) => (
        <span
          key={b}
          className="h-[22px] px-1.5 flex items-center rounded-md border border-border/60 bg-card/80 text-[11px] text-muted-foreground font-medium shadow-sm"
        >
          {mouseLabels[b]}
        </span>
      ))}
      {space && (
        <kbd className="min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded border border-border/60 bg-card/80 text-[11px] text-muted-foreground font-medium shadow-sm">
          Space
        </kbd>
      )}
      {shift && (
        <kbd className="h-[22px] px-1.5 flex items-center rounded bg-primary/10 text-[10px] text-primary font-medium border border-primary/20">
          ×2
        </kbd>
      )}
    </div>
  );
}
