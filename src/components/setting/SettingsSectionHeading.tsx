import React from "react";

interface SettingsSectionHeadingProps {
  /** Anchor id — `sectionElementId(groupId)`; the directory and the spy use it. */
  id: string;
  name: string;
  /** Optional trailing content, e.g. the plugin summary. */
  children?: React.ReactNode;
}

/**
 * The group label of one settings group (design 030 §11.15, 方案 B).
 *
 * iOS-style: a muted 12px line **above** the group's card, not a sticky
 * heading. The card carries the grouping, so this deliberately does not try to
 * stand out (that was 方案 A) and does not stick — a card's `overflow-hidden`
 * would break `position: sticky` anyway.
 *
 * Shared on purpose: `SettingsTabContent` renders it generically, and groups
 * that bring their own content (the plugin one) render it themselves — so the
 * two cannot drift apart.
 */
export function SettingsSectionHeading({
  id,
  name,
  children,
}: SettingsSectionHeadingProps) {
  return (
    <h3
      id={id}
      tabIndex={-1}
      className="flex items-center justify-between gap-3 px-1 pb-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {name}
      {children}
    </h3>
  );
}
