import React from "react";

interface SettingsSectionHeadingProps {
  /** Anchor id - `sectionElementId(groupId)`; the directory and the spy use it. */
  id: string;
  name: string;
  /**
   * Position in `SETTINGS_GROUPS`, 1-based. Rendered as `01`…`06` **through a
   * `data-index` attribute** (see the `.settings-index` rule in `index.css`),
   * so the number stays decoration: it never joins `textContent`, and a
   * filtered list keeps the original number instead of renumbering.
   */
  index: number;
  /** Optional trailing content, e.g. the plugin summary. */
  children?: React.ReactNode;
}

/**
 * The group label of one settings group.
 *
 * iOS-style: a muted 12px line **above** the group's card, not a sticky
 * heading. The card carries the grouping, so this deliberately does not try to
 * stand out and does not stick - a card's `overflow-hidden` would break
 * `position: sticky` anyway.
 *
 * The hairline trailing the name is what turns six floating labels into a table
 * of contents: each group reads as a section of one list.
 *
 * Shared on purpose: `SettingsTabContent` renders it generically, and groups
 * that bring their own content (the plugin one) render it themselves - so the
 * two cannot drift apart.
 */
export function SettingsSectionHeading({
  id,
  name,
  index,
  children,
}: SettingsSectionHeadingProps) {
  return (
    <h3
      id={id}
      tabIndex={-1}
      data-index={String(index).padStart(2, "0")}
      className="settings-index flex items-center gap-2 pb-2 pl-4 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {name}
      <span aria-hidden className="h-px min-w-4 flex-1 bg-border/70" />
      {children}
    </h3>
  );
}
