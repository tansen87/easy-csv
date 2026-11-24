import React, { useCallback, useRef } from "react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  DOCK_RAIL_WIDTH,
  DOCK_WIDTH_DEFAULT,
  DOCK_WIDTH_MAX,
  DOCK_WIDTH_MIN,
  VIEW_PANELS,
} from "@/modules/pipeline/viewPanels";
import type { ViewPanelId } from "@/types/viewDock";

/**
 * Right-hand dock shell (design 076 · option A).
 *
 * One column plus a 40px rail. The rail is the whole point: before it, the only
 * way to reach the other three panels was the 「查看」menu, so opening a second
 * one silently covered the first. Here the rail keeps all four visible, and the
 * column can only ever hold one of them.
 */
interface ViewDockProps {
  activePanel: ViewPanelId | null;
  onSelectPanel: (id: ViewPanelId) => void;
  /** Width of the panel column, excluding the rail. */
  width: number;
  onWidthChange: (width: number) => void;
  children: React.ReactNode;
}

export function ViewDock({
  activePanel,
  onSelectPanel,
  width,
  onWidthChange,
  children,
}: ViewDockProps) {
  const { t } = useLanguage();
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startX: event.clientX, startWidth: width };
    },
    [width],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return;
      // The dock hangs off the right edge, so dragging left makes it wider.
      onWidthChange(
        drag.current.startWidth + (drag.current.startX - event.clientX),
      );
    },
    [onWidthChange],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  if (!activePanel) return null;

  return (
    <div
      className="relative mt-9 flex h-[calc(100%-2.25rem)] flex-none border-l border-border-soft"
      style={{ width: width + DOCK_RAIL_WIDTH }}
      data-testid="view-dock"
      data-active-panel={activePanel}
    >
      {/* Drag the inner edge; double-click restores the default width. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t.viewDockResize}
        aria-valuemin={DOCK_WIDTH_MIN}
        aria-valuemax={DOCK_WIDTH_MAX}
        aria-valuenow={width}
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => onWidthChange(DOCK_WIDTH_DEFAULT)}
        className="absolute inset-y-0 left-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize"
      />

      {/* `key` restarts the 120ms fade when the panel changes, so a switch reads
          as one surface replacing another instead of content mutating. */}
      <div
        key={activePanel}
        className="dock-panel-in min-w-0 flex-1 overflow-hidden"
      >
        {children}
      </div>

      <div className="flex w-10 flex-none flex-col items-center gap-0.5 border-l border-border-soft bg-muted/40 py-1.5">
        {VIEW_PANELS.map((panel) => {
          const Icon = panel.icon;
          const label = t[panel.labelKey];
          const active = panel.id === activePanel;
          return (
            <Tooltip key={panel.id} content={label} side="left">
              <button
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() => onSelectPanel(panel.id)}
                className={cn(
                  "flex h-[38px] w-[30px] flex-col items-center justify-center gap-1 rounded-md transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="font-mono text-[8.5px] leading-none tabular-nums opacity-80">
                  {panel.index}
                </span>
              </button>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
