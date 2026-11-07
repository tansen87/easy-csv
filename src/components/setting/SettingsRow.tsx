import React from "react";

import { cn } from "@/lib/utils";
import { highlightSegments } from "@/utils/settingsSearch";
import { rowElementId } from "./settingsSections";

/**
 * One row = one setting (design 030 §4.2, re-cut in 040 §3): a three-track grid
 * of `title | description | control`.
 *
 * 040 changes the rhythm, not the structure: 44px tall instead of 36, two type
 * sizes instead of four (13 title / 12 description), and the whole row inset by
 * 16 so titles line up with the group heading above them.
 *
 * `extra` is a second line in the description column. Two rows need one - the
 * delimiter shows how the sample line splits, the API key points at the
 * console - and both used to add a bordered sub-row that broke the rhythm.
 */
interface SettingsRowProps {
  id: string;
  title: string;
  description?: string;
  /** Current search query; hits are wrapped in `<mark>`. */
  highlight?: string;
  /** Second line under the description: a sample, a pair of links. */
  extra?: React.ReactNode;
  /**
   * Present ⇒ the row is clickable and this runs when the row **itself** is
   * clicked (macOS-style delegation: clicking a switch row toggles it, clicking
   * a dropdown row opens it). Clicks that land on a control are left alone, so
   * a switch is not toggled twice. Destructive rows deliberately pass nothing
   * - clicking a description must never delete data.
   */
  onActivate?: () => void;
  children: React.ReactNode;
}

/** Elements that handle their own clicks; the row must not also act. */
const SELF_HANDLED =
  "input, button, select, textarea, a, label, [role='combobox'], [role='listbox'], [role='option'], [role='searchbox'], [role='switch'], [role='radiogroup']";

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
  extra,
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
        "grid min-h-11 grid-cols-[190px_minmax(0,1fr)_auto] items-center gap-4",
        "border-b border-border/60 px-4 py-2",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        onActivate && "cursor-pointer hover:bg-accent/40",
      )}
    >
      <div className="truncate text-[13px] font-medium leading-tight">
        <Highlighted text={title} query={highlight} />
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-xs leading-snug text-muted-foreground"
          title={description}
        >
          {description ? (
            <Highlighted text={description} query={highlight} />
          ) : null}
        </div>
        {extra}
      </div>
      <div className="flex items-center justify-self-end gap-2">{children}</div>
    </div>
  );
}
