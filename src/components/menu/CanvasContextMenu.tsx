import { Fragment, useEffect, useRef, useLayoutEffect } from "react";
import type { LucideIcon } from "lucide-react";

export interface CanvasMenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Draw a hairline divider above this item. */
  separatorBefore?: boolean;
  /** Destructive entry: red text, tinted hover. */
  danger?: boolean;
  onSelect: () => void;
}

interface CanvasContextMenuProps {
  x: number;
  y: number;
  items: CanvasMenuItem[];
  onClose: () => void;
}

/**
 * Independent right-click menu for the canvas. Kept as its own component so
 * future features (edit step, duplicate, etc.) can add items without touching
 * the gesture/state plumbing in FlowPanel.
 */
export function CanvasContextMenu({
  x,
  y,
  items,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Clamp the menu inside the viewport so it never overflows the right/bottom edge.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = Math.max(0, x + rect.width - window.innerWidth + 8);
    const dy = Math.max(0, y + rect.height - window.innerHeight + 8);
    el.style.left = `${x - dx}px`;
    el.style.top = `${y - dy}px`;
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-50 min-w-40 bg-card border border-border rounded-lg shadow-lg p-1"
        style={{ left: x, top: y }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Fragment key={item.key}>
            {item.separatorBefore && (
              <div className="my-1 h-px bg-border/60" role="separator" />
            )}
            <button
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                item.disabled
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : item.danger
                    ? "text-danger hover:bg-danger-soft"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {item.label}
            </button>
            </Fragment>
          );
        })}
      </div>
    </>
  );
}
