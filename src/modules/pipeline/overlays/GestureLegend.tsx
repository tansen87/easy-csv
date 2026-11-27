import { Fragment } from "react";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

interface GestureLegendProps {
  leftTool: "select" | "pan";
  swapMouseButtons: boolean;
  locked: boolean;
  className?: string;
}

interface LegendItem {
  keys: string[];
  label: string;
}

/**
 * Quiet binding legend for the canvas, toggled from the rail's canvas menu.
 * It mirrors the current left tool and button swap so the hints can never
 * drift from the actual gestures.
 */
export function GestureLegend({
  leftTool,
  swapMouseButtons,
  locked,
  className,
}: GestureLegendProps) {
  const { t } = useLanguage();
  const primary = swapMouseButtons ? t.mouseRight : t.mouseLeft;
  const secondary = swapMouseButtons ? t.mouseLeft : t.mouseRight;
  // Secondary button: cut on blank canvas, connect from a step card. The
  // legend shows the cut label; the crosshair/cursor tells the rest.
  const rightItem: LegendItem = { keys: [secondary], label: t.gestureCut };

  const items: LegendItem[] =
    leftTool === "pan"
      ? [
          { keys: [primary], label: t.gesturePan },
          { keys: ["Shift", primary], label: t.gestureSelect },
          ...(locked ? [] : [rightItem]),
          { keys: [t.gestureWheel], label: t.gestureZoom },
        ]
      : [
          { keys: [primary], label: t.gestureSelect },
          ...(locked ? [] : [rightItem]),
          { keys: ["Space", primary], label: t.gesturePan },
          { keys: [t.gestureWheel], label: t.gestureZoom },
        ];

  return (
    <div
      role="status"
      aria-live="off"
      className={cn(
        // Design 082: a quiet floor note in the bottom-right corner, not a
        // second card. The action tray owns the centre; this yields to it.
        "pointer-events-none absolute bottom-2 right-3 z-30 flex items-center gap-3 text-[10.5px] text-muted-foreground/70",
        className,
      )}
    >
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="h-3 w-px bg-border" />}
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            {item.keys.map((key, keyIndex) => (
              <Fragment key={keyIndex}>
                {keyIndex > 0 && (
                  <span className="text-[9px] text-muted-foreground/70">+</span>
                )}
                <kbd className="inline-flex h-[18px] items-center rounded-[3px] border border-border bg-background px-1.5 font-mono text-[9.5px] text-foreground">
                  {key}
                </kbd>
              </Fragment>
            ))}
            <span>{item.label}</span>
          </span>
        </Fragment>
      ))}
      {locked && (
        <>
          <span className="h-3 w-px bg-border" />
          <span className="font-medium text-foreground">{t.gestureLocked}</span>
        </>
      )}
    </div>
  );
}
