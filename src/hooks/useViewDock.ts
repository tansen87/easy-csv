import { useCallback, useEffect, useMemo, useState } from "react";

import {
  DOCK_RAIL_WIDTH,
  DOCK_WIDTH_DEFAULT,
  VIEW_PANELS,
  clampDockWidth,
} from "@/modules/pipeline/viewPanels";
import type { ViewPanelId } from "@/types/viewDock";

/**
 * State of the right-hand dock (design 076 · option A).
 *
 * Replaces the four independent booleans that used to live in `useUIState` and
 * `App`: they could all be true at once while the panels shared one anchor, so
 * opening a second panel simply covered the first. One slot means one truth —
 * `activePanel === null` is "closed", anything else is "that panel is showing".
 */
export function useViewDock() {
  const [activePanel, setActivePanel] = useState<ViewPanelId | null>(null);
  const [panelWidth, setPanelWidth] = useState(DOCK_WIDTH_DEFAULT);

  /** Clicking the panel that is already open closes the dock. */
  const togglePanel = useCallback((id: ViewPanelId) => {
    setActivePanel((current) => (current === id ? null : id));
  }, []);

  const openPanel = useCallback((id: ViewPanelId) => {
    setActivePanel(id);
  }, []);

  const closeDock = useCallback(() => setActivePanel(null), []);

  const setWidth = useCallback((width: number) => {
    setPanelWidth(clampDockWidth(width));
  }, []);

  /** Alt+1..4 switch panels, Alt+0 closes — the menu shows the same keycaps. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key === "0") {
        setActivePanel(null);
        event.preventDefault();
        return;
      }
      const panel = VIEW_PANELS.find((entry) => entry.key === event.key);
      if (!panel) return;
      setActivePanel((current) => (current === panel.id ? null : panel.id));
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** 0 when closed, so the canvas and the log drawer never reserve a dead strip. */
  const dockWidth = activePanel ? panelWidth + DOCK_RAIL_WIDTH : 0;

  return useMemo(
    () => ({
      activePanel,
      panelWidth,
      dockWidth,
      togglePanel,
      openPanel,
      closeDock,
      setWidth,
    }),
    [
      activePanel,
      panelWidth,
      dockWidth,
      togglePanel,
      openPanel,
      closeDock,
      setWidth,
    ],
  );
}

export type ViewDockState = ReturnType<typeof useViewDock>;
