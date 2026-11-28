import { createContext } from "react";

/**
 * The flexible middle of `BottomDock`'s header row (design 084).
 *
 * The dock owns the row (tabs on the left, window actions on the right); a
 * panel that lives in the dock portals its own tools into this slot, so the
 * log filters sit on the same line as the tabs instead of spending a second
 * 32px row. Kept in its own module so `modules/` can depend on the context
 * without importing the dock component.
 */
export const DockHeaderSlotContext = createContext<HTMLElement | null>(null);
