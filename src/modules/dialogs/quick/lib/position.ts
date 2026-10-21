export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Places a floating dialog at the right-click point while keeping it fully
 * visible: flip to the left/above when it would overflow, then clamp.
 */
export function computeAnchoredPosition(
  anchor: Point,
  size: Size,
  viewport: ViewportSize,
  margin = 8,
): Point {
  let x = anchor.x;
  let y = anchor.y;

  if (x + size.width + margin > viewport.width) {
    x = anchor.x - size.width;
  }
  if (y + size.height + margin > viewport.height) {
    y = anchor.y - size.height;
  }

  x = Math.max(margin, Math.min(x, viewport.width - size.width - margin));
  y = Math.max(margin, Math.min(y, viewport.height - size.height - margin));

  return { x, y };
}
