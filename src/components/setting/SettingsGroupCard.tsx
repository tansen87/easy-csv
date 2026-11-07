import React from "react";

interface SettingsGroupCardProps {
  children: React.ReactNode;
}

/**
 * The rounded card that holds one group's rows (design 030 §11.15, 方案 B).
 *
 * 040 dropped the shadow: the dialog's own surface became a muted canvas, so a
 * card is a **surface step plus a hairline**, not a floating sheet. Stacking
 * `shadow-xl` (dialog) · `shadow-sm` (card) · `bg-card` was three ways of saying
 * depth at once - and in light mode the card and the pane were both pure white,
 * so only the shadow told them apart.
 *
 * `overflow-hidden` clips the rows to the card's rounded corners, and the last
 * row drops its own bottom border so it does not double with the card edge.
 * Rows carry their own 16px inset (see `SettingsRow`), so the wrapper adds no
 * padding - that was the source of the old 12 + 6 = 18px double inset.
 */
export function SettingsGroupCard({ children }: SettingsGroupCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="[&>*:last-child]:border-b-0">{children}</div>
    </div>
  );
}
