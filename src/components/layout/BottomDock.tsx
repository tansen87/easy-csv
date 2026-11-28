import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown, Maximize2, Minimize2, X } from "lucide-react";

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
        <DockTabSwitcher
          tabs={tabs}
          active={active}
          onSelect={onTabChange}
          label={label}
        />

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

/**
 * The dock's panel switcher (design 084 second pass): a select, not a row of
 * tabs. The header also has to hold the active panel's own tools (step chain
 * or log filters), and results multiply per branch — one control that names the
 * current panel keeps that room and answers "which page am I on" at a glance.
 *
 * Follows the select-only combobox pattern: the button carries `aria-expanded`
 * and `aria-activedescendant`, the list is a `listbox` of `option`s. The list
 * opens downward inside the dock (the drawer clips at the window edge), capped
 * in height so ten result branches cannot run off the dock.
 */
function DockTabSwitcher({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: BottomDockTabItem[];
  active: BottomDockTab;
  onSelect: (tab: BottomDockTab) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const currentIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active),
  );
  const current = tabs[currentIndex] ?? tabs[0];

  useEffect(() => {
    if (!open) return;
    setCursor(currentIndex);
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, currentIndex]);

  const choose = (id: BottomDockTab) => {
    onSelect(id);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setCursor((index) => (index + 1) % tabs.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setCursor((index) => (index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        event.preventDefault();
        setCursor(0);
        break;
      case "End":
        event.preventDefault();
        setCursor(tabs.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (tabs[cursor]) choose(tabs[cursor].id);
        break;
      case "Escape":
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className="relative shrink-0" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="dock-panel-list"
        aria-activedescendant={
          open && tabs[cursor] ? `dock-panel-${tabs[cursor].id}` : undefined
        }
        aria-label={label}
        data-dock-switcher
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-[24px] items-center gap-1.5 rounded-[5px] border pl-2 pr-1 text-[11.5px] transition-colors",
          open
            ? "border-border bg-muted text-foreground"
            : "border-border bg-background text-foreground hover:bg-muted/60",
        )}
      >
        <span className="max-w-[132px] truncate">{current?.label}</span>
        {current?.count !== undefined && (
          <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
            {current.count}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          id="dock-panel-list"
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-[220px] w-[184px] overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`dock-panel-${tab.id}`}
              type="button"
              role="option"
              aria-selected={tab.id === active}
              data-dock-tab={tab.id}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(tab.id)}
              className={cn(
                "flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[11.5px]",
                index === cursor
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
              {tab.id === active && <Check className="h-3 w-3 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
