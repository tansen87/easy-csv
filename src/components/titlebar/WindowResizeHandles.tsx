import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { usesCustomTitleBar } from "@/lib/platform";

/**
 * Resize grips for the borderless window.
 *
 * Two Windows behaviours force this to be hand-rolled:
 *
 * 1. `startResizeDragging` (which sends `WM_NCLBUTTONDOWN`) does nothing here,
 *    because Windows only runs its resize loop while the window still carries
 *    `WS_THICKFRAME` — and that bit has to stay off or DWM paints a 1px border
 *    that shows up in the four CSS-rounded corners.
 * 2. tao's own `WM_NCHITTEST` handler turns the outer ~8px into non-client
 *    area, so a press there never reaches the webview. That is why the window
 *    is configured `resizable: false`: without `RESIZABLE` tao falls through
 *    to `HTCLIENT` and the grips below actually receive events.
 *
 * So the grips drive the geometry themselves through `setSize` /
 * `setPosition`. Moves are coalesced with `requestAnimationFrame` and one
 * in-flight call at a time, otherwise a fast drag queues dozens of IPC round
 * trips and the window lags behind the cursor.
 */

type Direction =
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest";

const MIN_WIDTH = 640;
const MIN_HEIGHT = 420;

const EDGE = "absolute z-40 window-resize-handle";
const CORNER = "absolute z-50 window-resize-handle";

const GRIPS: Array<{ direction: Direction; className: string }> = [
  { direction: "North", className: `${EDGE} left-3 right-3 top-0 h-1.5 cursor-ns-resize` },
  { direction: "South", className: `${EDGE} left-3 right-3 bottom-0 h-1.5 cursor-ns-resize` },
  { direction: "West", className: `${EDGE} top-3 bottom-3 left-0 w-1.5 cursor-ew-resize` },
  { direction: "East", className: `${EDGE} top-3 bottom-3 right-0 w-1.5 cursor-ew-resize` },
  { direction: "NorthWest", className: `${CORNER} left-0 top-0 h-3 w-3 cursor-nwse-resize` },
  { direction: "NorthEast", className: `${CORNER} right-0 top-0 h-3 w-3 cursor-nesw-resize` },
  { direction: "SouthWest", className: `${CORNER} left-0 bottom-0 h-3 w-3 cursor-nesw-resize` },
  { direction: "SouthEast", className: `${CORNER} right-0 bottom-0 h-3 w-3 cursor-nwse-resize` },
];

type Frame = { x: number; y: number; width: number; height: number };

type Drag = {
  direction: Direction;
  origin: Frame;
  pointerX: number;
  pointerY: number;
};

function clamp(value: number, min: number) {
  return Math.max(min, value);
}

/** Window geometry for one drag step, in logical (CSS) pixels. */
function frameFor(drag: Drag, dx: number, dy: number): Frame {
  const { x, y, width, height } = drag.origin;
  const west = drag.direction.includes("West");
  const east = drag.direction.includes("East");
  const north = drag.direction.includes("North");
  const south = drag.direction.includes("South");

  let nextX = x;
  let nextY = y;
  let nextWidth = width;
  let nextHeight = height;

  if (west) {
    nextWidth = clamp(width - dx, MIN_WIDTH);
    nextX = x + width - nextWidth;
  } else if (east) {
    nextWidth = clamp(width + dx, MIN_WIDTH);
  }

  if (north) {
    nextHeight = clamp(height - dy, MIN_HEIGHT);
    nextY = y + height - nextHeight;
  } else if (south) {
    nextHeight = clamp(height + dy, MIN_HEIGHT);
  }

  return { x: nextX, y: nextY, width: nextWidth, height: nextHeight };
}

export function WindowResizeHandles() {
  const [maximized, setMaximized] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const pendingRef = useRef<Frame | null>(null);
  const inFlightRef = useRef(false);
  const rafRef = useRef(0);

  const flush = useCallback(() => {
    if (inFlightRef.current) return;
    const target = pendingRef.current;
    if (!target) return;
    pendingRef.current = null;
    inFlightRef.current = true;

    let win;
    try {
      win = getCurrentWindow();
    } catch {
      inFlightRef.current = false;
      return;
    }

    void (async () => {
      try {
        await win.setSize(new LogicalSize(target.width, target.height));
        await win.setPosition(new LogicalPosition(target.x, target.y));
      } catch (error) {
        console.warn("[resize]", error);
      } finally {
        inFlightRef.current = false;
        if (pendingRef.current) flush();
      }
    })();
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      flush();
    });
  }, [flush]);

  const onPointerDown = useCallback(
    (direction: Direction) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);

      let win;
      try {
        win = getCurrentWindow();
      } catch {
        return;
      }

      void (async () => {
        try {
          // The grips unmount when maximised, but a zoom triggered a frame
          // ago can still be on screen; never resize a zoomed window.
          if (await win.isMaximized()) return;
          const scale = await win.scaleFactor();
          const [position, size] = await Promise.all([
            win.outerPosition(),
            win.outerSize(),
          ]);
          const logical = position.toLogical(scale);
          const logicalSize = size.toLogical(scale);
          dragRef.current = {
            direction,
            origin: {
              x: logical.x,
              y: logical.y,
              width: logicalSize.width,
              height: logicalSize.height,
            },
            pointerX: event.screenX,
            pointerY: event.screenY,
          };
          // Suppress text selection while the cursor leaves the grips.
          document.body.style.userSelect = "none";
        } catch (error) {
          console.warn("[resize]", error);
        }
      })();
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      pendingRef.current = frameFor(
        drag,
        event.screenX - drag.pointerX,
        event.screenY - drag.pointerY,
      );
      schedule();
    },
    [schedule],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    pendingRef.current = null;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    let win;
    try {
      win = getCurrentWindow();
    } catch {
      return;
    }

    let alive = true;
    let unlisten: (() => void) | undefined;

    const sync = () => {
      void win
        ?.isMaximized()
        .then((value) => {
          if (alive) setMaximized(value);
        })
        .catch(() => {});
    };

    sync();
    void win
      .onResized(sync)
      .then((off) => {
        if (alive) unlisten = off;
        else off();
      })
      .catch(() => {});

    return () => {
      alive = false;
      unlisten?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.userSelect = "";
    };
  }, []);

  if (!usesCustomTitleBar || maximized) return null;

  return (
    <>
      {GRIPS.map(({ direction, className }) => (
        <div
          key={direction}
          aria-hidden="true"
          className={className}
          onPointerDown={onPointerDown(direction)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      ))}
    </>
  );
}
