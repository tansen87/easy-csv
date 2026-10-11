import React from "react";

interface SettingsGroupCardProps {
  children: React.ReactNode;
}

/**
 * The rounded card that holds one group's rows (design 030 §11.15, 方案 B).
 *
 * `overflow-hidden` clips the rows to the card's rounded corners, and the last
 * row drops its own bottom border so it does not double with the card edge.
 */
export function SettingsGroupCard({ children }: SettingsGroupCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="px-3 py-1 [&>*:last-child]:border-b-0">{children}</div>
    </div>
  );
}
