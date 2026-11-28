import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { Button } from "@/components/ui/Button";
import type { PanelDockState } from "@/types/xan";
import { DockHeaderSlotContext } from "@/components/layout/dockSlots";

/** `logs` is always the first tab; results follow, one per successful branch. */
export type BottomDockTab = "logs" | `result:${number}`;

interface BottomDockProps {
  open: boolean;
  activeTab: BottomDockTab;
  onTabChange: (tab: BottomDockTab) => void;
  onClose: () => void;
  /** Tab descriptors, built by the caller (日志 first, then results). */
  tabs: BottomDockTabItem[];
  /** Accessible name for the tab list (optional: the tabs describe themselves). */
  label?: string;
  /** Height/maximize persistence (stored under the historical `logPanel` key). */
  dockState?: PanelDockState;
  onDockChange?: (patch: Partial<PanelDockState>) => void;
  /** Pixels to keep free at the window's right edge (AI panel + view dock). */
  rightInset?: number;
  /** The first tab's body (logs). Kept mounted while another tab is active so
   *  its scroll position and filters survive tab switches. */
  children: React.ReactNode;
  /** Body for the active result tab; only mounted while that tab is active. */
  panel?: React.ReactNode;
  /**
   * Facts about the active tab (step chain, counts, copy), rendered in the tab
   * row itself: a second head row cost 32px for very little (084 feedback).
   */
  meta?: React.ReactNode;
  /**
   * Height the active tab's content wants. The dock grows to meet it (never
   * shrinks), so a 6-row result is not cut in half by the log drawer's
   * default height.
   */
  preferredHeight?: number;
}

export interface BottomDockTabItem {
  id: BottomDockTab;
  label: string;
  /** Right-hand figure: line count, row count, "前 500 行". */
  count?: React.ReactNode;
  /**
   * Content arrived while another panel was being read. A dot, not a jump:
   * a finished run must not pull the user away from the logs they opened.
   */
  unseen?: boolean;
}

const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 160;
/** Height of the window's menu bar (`.app-header` is `h-9`). */
const APP_HEADER_HEIGHT = 36;
/** A dragged-to-max drawer still reads as a drawer, not a broken full screen. */
const TITLEBAR_HEIGHT = 56;

/**
 * The one bottom drawer (design 084): 日志 first, then one tab per result
 * branch. Results used to be canvas nodes that landed off-screen and shrank
 * with the zoom; inside the drawer the table gets the window's width and a
 * fixed 13px type size, while the canvas keeps its own space.
 *
 * Height, the top-edge grip and the maximized surface moved here from
 * `LogPanel` so both tabs share one shell. `--bottom-dock-height` replaces
 * `--log-drawer-height` (design 082's selection tray rides on it).
 */
export function BottomDock({
  open,
  activeTab,
  onTabChange,
  onClose,
  tabs,
  label,
  dockState,
  onDockChange,
  rightInset = 0,
  children,
  panel,
  meta,
  preferredHeight,
}: BottomDockProps) {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState(false);
  const [height, setHeight] = useState(
    dockState?.height && dockState.height >= MIN_HEIGHT
      ? dockState.height
      : DEFAULT_HEIGHT,
  );
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  /** DOM node in the header row that panels portal their tools into. */
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  // A new run can leave the stored tab pointing at a branch that no longer
  // exists; the caller resolves the fallback and passes an id that exists.
  const active: BottomDockTab = tabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : (tabs[0]?.id ?? "logs");

  useLayoutEffect(() => {
    if (!open || isMaximized) return;
    const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
    setHeight((current) => Math.min(current, max));
  }, [open, isMaximized]);

  // Grow to fit the content that just became active (results), never shrink:
  // the height the user dragged to stays theirs.
  useLayoutEffect(() => {
    if (!open || isMaximized || !preferredHeight) return;
    const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
    setHeight((current) => Math.max(current, Math.min(preferredHeight, max)));
  }, [open, isMaximized, preferredHeight]);

  // Publish the rendered height so canvas overlays anchored to the bottom ride
  // above the drawer, including mid-drag.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--bottom-dock-height",
      `${open && !isMaximized ? height : 0}px`,
    );
    return () => {
      root.style.removeProperty("--bottom-dock-height");
    };
  }, [open, isMaximized, height]);

  const handleResizeStart = useCallback(
    (event: React.PointerEvent) => {
      if (isMaximized) return;
      event.preventDefault();
      resizeRef.current = { startY: event.clientY, startHeight: height };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      const handleMove = (moveEvent: PointerEvent) => {
        const start = resizeRef.current;
        if (!start) return;
        const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
        setHeight(
          Math.max(
            MIN_HEIGHT,
            Math.min(
              start.startHeight + (start.startY - moveEvent.clientY),
              max,
            ),
          ),
        );
      };
      const handleUp = (upEvent: PointerEvent) => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const start = resizeRef.current;
        resizeRef.current = null;
        if (!start) return;
        const max = Math.max(MIN_HEIGHT, window.innerHeight - TITLEBAR_HEIGHT);
        onDockChange?.({
          height: Math.max(
            MIN_HEIGHT,
            Math.min(start.startHeight + (start.startY - upEvent.clientY), max),
          ),
        });
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [height, isMaximized, onDockChange],
  );

  if (!open) return null;

  return (
    <div
      style={
        isMaximized
          ? {
              left: 0,
              right: 0,
              top: APP_HEADER_HEIGHT,
              height: `calc(100vh - ${APP_HEADER_HEIGHT}px)`,
            }
          : { left: 0, right: rightInset, bottom: 0, height }
      }
      className={cn(
        "fixed z-floating flex flex-col overflow-hidden bg-card shadow-lg",
        isMaximized ? "w-full" : "rounded-t-lg border-x border-t border-border",
      )}
      onContextMenu={(event) => event.preventDefault()}
      data-testid="bottom-dock"
    >
      {!isMaximized && (
        <div
          onPointerDown={handleResizeStart}
          className="h-[5px] shrink-0 cursor-row-resize bg-transparent transition-colors hover:bg-primary/15"
          aria-label={t.logResizeHint}
          title={t.logResizeHint}
        />
      )}

      <div className="flex h-8 flex-none items-center gap-2 border-b border-border-soft px-2">
        <div
          role="tablist"
          {...(label ? { "aria-label": label } : {})}
          className="flex shrink-0 items-center gap-0.5"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active === tab.id}
              data-dock-tab={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex h-[24px] items-center gap-1.5 rounded-[5px] px-2 text-[11.5px] transition-colors",
                // Same recipe as the document tabs (`.tab-selected`): a 12%
                // brand wash on the card surface, plus the inset ring in dark
                // mode. "Selected" then means one thing across the app.
                active === tab.id
                  ? "tab-selected font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
              {tab.unseen && (
                <span
                  className="h-1 w-1 shrink-0 rounded-full bg-primary"
                  title={t.dockNewResults}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>

        <span className="h-3 w-px shrink-0 bg-border-soft" aria-hidden="true" />

        {/* One flexible middle: the active result's chain/counts/copy, or the
            log panel's filters (portaled, so its state stays in LogPanel). */}
        <div
          ref={setHeaderSlot}
          className="@container flex min-w-0 flex-1 items-center gap-2"
        >
          {meta}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Tooltip content={isMaximized ? t.restore : t.maximize}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={isMaximized ? t.restore : t.maximize}
              onClick={() => setIsMaximized((value) => !value)}
              className="h-7 w-7 p-0"
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </Tooltip>
          <Tooltip content={t.close}>
            <Button
              variant="ghost"
              size="xs"
              aria-label={t.close}
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <DockHeaderSlotContext.Provider value={headerSlot}>
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              active === "logs" ? "" : "hidden",
            )}
          >
            {children}
          </div>
          {active !== "logs" && panel}
        </div>
      </DockHeaderSlotContext.Provider>
    </div>
  );
}
