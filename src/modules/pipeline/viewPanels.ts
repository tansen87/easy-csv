import {
  Braces,
  GitMerge,
  History,
  NotebookPen,
  Table2,
  type LucideIcon,
} from "lucide-react";

import type { ViewPanelId } from "@/types/viewDock";

/**
 * The right-hand dock behind 「view」(design 076).
 *
 * One slot, one panel, plus a 40px tab rail. The order here is the order of the
 * View menu and of the rail, and it never changes at runtime — switching panels
 * only swaps the body, so nothing moves under the pointer.
 */

export interface ViewPanelDef {
  id: ViewPanelId;
  /** i18n key holding the panel name (also used by the menu and the rail). */
  labelKey:
    | "dataProfile"
    | "versionHistory"
    | "dataLineage"
    | "variables"
    | "ledger";
  icon: LucideIcon;
  /** `Alt + <key>` opens this panel (menu shows the same keycap). */
  key: string;
}

export const VIEW_PANELS: readonly ViewPanelDef[] = [
  {
    id: "profile",
    labelKey: "dataProfile",
    icon: Table2,
    key: "1",
  },
  {
    id: "version",
    labelKey: "versionHistory",
    icon: History,
    key: "2",
  },
  {
    id: "lineage",
    labelKey: "dataLineage",
    icon: GitMerge,
    key: "3",
  },
  {
    id: "variables",
    labelKey: "variables",
    icon: Braces,
    key: "4",
  },
  {
    id: "ledger",
    labelKey: "ledger",
    icon: NotebookPen,
    key: "5",
  },
] as const;

/** The rail is 40 wide; a 320 panel leaves 360 of window for the dock. */
export const DOCK_RAIL_WIDTH = 40;
export const DOCK_WIDTH_DEFAULT = 320;
export const DOCK_WIDTH_MIN = 280;
export const DOCK_WIDTH_MAX = 420;

export const clampDockWidth = (width: number) =>
  Math.min(DOCK_WIDTH_MAX, Math.max(DOCK_WIDTH_MIN, Math.round(width)));
