import * as React from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    /**
     * Skip the horizontal bar. Mounting it sets Radix's `scrollbarXEnabled`,
     * which switches the viewport to `overflow-x: scroll` — i.e. content wider
     * than the box (or even a sub-pixel overshoot) shows a horizontal bar.
     * Vertical-only content should opt out so the box keeps `overflow-x: hidden`.
     */
    hideHorizontalScrollbar?: boolean;
    /**
     * Radix's inner wrapper is `min-width: 100%; display: table` **as an inline
     * style**, so it grows to its widest child's min-content width — and every
     * row inside inherits that width, which drags trailing / right-aligned
     * controls (buttons) outside the box when a single child is too wide.
     * Overriding it to block sizing (important, since inline styles win) keeps
     * rows at the box width so only the over-wide child overflows.
     */
    blockContent?: boolean;
    /**
     * Extra classes for the internal viewport. The viewport's default `h-full`
     * needs a definite parent height, so auto-height containers that only set a
     * `max-height` must instead cap the viewport itself (e.g.
     * `max-h-[...] overflow-y-auto`) — see design 031 §5.
     */
    viewportClassName?: string;
    /** Inline style for the internal viewport (used for computed max-heights). */
    viewportStyle?: React.CSSProperties;
  }
>(
  (
    {
      className,
      children,
      hideHorizontalScrollbar = false,
      blockContent = false,
      viewportClassName,
      viewportStyle,
      ...props
    },
    ref,
  ) => (
    <ScrollAreaPrimitive.Root
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "h-full w-full rounded-[inherit]",
          blockContent && "[&>div]:block!",
          viewportClassName,
        )}
        style={viewportStyle}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      {!hideHorizontalScrollbar && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  ),
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        // `z-panel` keeps the bar above the scrolled content: it overlays the
        // viewport's right edge, so a sticky section header that carries a
        // z-index of its own would otherwise paint across it and make the bar
        // appear to vanish mid-scroll.
        "z-panel flex touch-none select-none transition-colors",
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent p-[1px]",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent p-[1px]",
        className,
      )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
