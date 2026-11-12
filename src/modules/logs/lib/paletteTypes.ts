import type { LucideIcon } from "lucide-react";

/**
 * Where a palette entry comes from. The palette uses it for two things: the
 * compact source tag on the right of a row while searching, and the tie-break
 * when two entries score the same (commands beat files — see `SOURCE_ORDER`).
 *
 * Kept in its own module so `lib/scoreItem.ts` can depend on it without a cycle
 * back into the component.
 */
export type PaletteSource = "action" | "command" | "tab" | "file" | "template";

export interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string;
  /** Extra searchable tokens (e.g. English aliases for localized labels). */
  search?: string;
  icon?: LucideIcon;
  /** Icon shown once on the group header; when set, per-item icons are hidden. */
  groupIcon?: LucideIcon;
  /** Suppress icons entirely for this item's group (no header, no per-item). */
  noIcon?: boolean;
  group: string;
  source?: PaletteSource;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}
