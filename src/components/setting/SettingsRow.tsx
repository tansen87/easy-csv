import React from "react";

import { cn } from "@/lib/utils";
import { highlightSegments } from "@/utils/settingsSearch";
import { rowElementId } from "./settingsSections";

/**
 * One row = one setting (design 030 §4.2): a three-track grid of
 * `title | description | control`, 36px tall. Density is the point — the old
 * layout spent ~76px per setting by stacking the three vertically, which is
 * what made a directory necessary in the first place.
 */
interface SettingsRowProps {
  id: string;
  title: string;
  description?: string;
  /** Current search query; hits are wrapped in `<mark>`. */
  highlight?: string;
  /**
   * Present ⇒ the row is clickable and this runs when the row **itself** is
   * clicked (macOS-style delegation: clicking a switch row toggles it, clicking
   * a dropdown row opens it). Clicks that land on a control are left alone, so
   * a checkbox is not toggled twice. Destructive rows deliberately pass nothing
   * — clicking a description must never delete data.
   */
  onActivate?: () => void;
  children: React.ReactNode;
}

/** Elements that handle their own clicks; the row must not also act. */
const SELF_HANDLED =
  "input, button, select, textarea, a, label, [role='combobox'], [role='listbox'], [role='option'], [role='searchbox']";

function Highlighted({ text, query }: { text: string; query?: string }) {
  const segments = highlightSegments(text, query ?? "");
  if (segments.length === 1 && !segments[0].hit) return <>{text}</>;
  return (
    <>
      {segments.map((segment, index) =>
        segment.hit ? (
          <mark
            key={index}
            className="rounded-sm bg-primary/20 px-px text-foreground"
          >
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        ),
      )}
    </>
  );
}

export function SettingsRow({
  id,
  title,
  description,
  highlight,
  onActivate,
  children,
}: SettingsRowProps) {
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!onActivate) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(SELF_HANDLED)) return;
    onActivate();
  };

  return (
    <div
      id={rowElementId(id)}
      data-settings-row={id}
      tabIndex={-1}
      onClick={onActivate ? handleClick : undefined}
      className={cn(
        "grid min-h-9 grid-cols-[176px_minmax(0,1fr)_auto] items-center gap-4",
        "rounded-sm border-b border-border/60 px-1.5",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        onActivate && "cursor-pointer hover:bg-accent/40",
      )}
    >
      <div className="truncate text-[13px] font-medium">
        <Highlighted text={title} query={highlight} />
      </div>
      <div
        className="truncate text-[11.5px] text-muted-foreground"
        title={description}
      >
        {description ? (
          <Highlighted text={description} query={highlight} />
        ) : null}
      </div>
      <div className="flex items-center justify-self-end">{children}</div>
    </div>
  );
}
