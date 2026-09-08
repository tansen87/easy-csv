/**
 * Pure helpers for floating-panel docking: clamp persisted positions back
 * inside the viewport so panels never end up off-screen after a resize or
 * window-shape change (min window 1024×640).
 */
import { PanelDockState } from "@/types/xan";

export interface ClampOptions {
  /** Panel's rendered width in px. */
  width: number;
  /** Panel's rendered height in px. */
  height: number;
  /** Top bar height panels must not overlap (app header). */
  minY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

/**
 * Clamp a docked x/y into the visible area. Missing coordinates fall back to
 * a sensible default: right edge for x, vertically centered for y.
 */
export function clampPanelPosition(
  dock: PanelDockState | undefined,
  { width, height, minY = 56, viewportWidth, viewportHeight }: ClampOptions,
): { x: number; y: number } {
  const vw =
    viewportWidth ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  const vh =
    viewportHeight ??
    (typeof window !== "undefined" ? window.innerHeight : 720);

  const defaultX = Math.max(0, vw - width);
  const defaultY = Math.max(minY, Math.min((vh - height) / 2, vh - height));

  const x = dock?.x !== undefined ? dock.x : defaultX;
  const y = dock?.y !== undefined ? dock.y : defaultY;

  return {
    x: Math.max(0, Math.min(x, Math.max(0, vw - width))),
    y: Math.max(minY, Math.min(y, Math.max(minY, vh - height))),
  };
}
