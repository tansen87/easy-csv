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
  }
>(
  (
    {
      className,
      children,
      hideHorizontalScrollbar = false,
      blockContent = false,
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
        )}
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
      "flex touch-none select-none transition-colors",
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
