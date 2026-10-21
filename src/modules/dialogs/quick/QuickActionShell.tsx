import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";
import { computeAnchoredPosition } from "@/modules/dialogs/quick/lib/position";

interface QuickActionShellProps {
  title: string;
  anchor: { x: number; y: number };
  width: number;
  /** CSS max-height of the whole dialog; defaults to `min(78vh, 680px)`. */
  maxHeight?: string;
  /** Optional CSS min-height for the scrollable body (forms with few fields). */
  bodyMinHeight?: string;
  canApply: boolean;
  onApply: () => void;
  onAdvanced?: () => void;
  onClose: () => void;
  children: ReactNode;
}

const MARGIN = 8;
/** Conservative first-frame height; corrected once the real size is known. */
const ESTIMATED_HEIGHT = 360;
const DEFAULT_MAX_HEIGHT = "min(78vh, 680px)";
/** Header (py-2 + text-sm + border) + footer (py-2 + h-8 button + border). */
const CHROME_HEIGHT = 86;

/**
 * Floating, non-modal shell for the quick-action forms: anchored at the
 * right-click point, draggable by its title bar, closed by Esc or an outside
 * click. No backdrop — the canvas stays usable behind it.
 */
export function QuickActionShell({
  title,
  anchor,
  width,
  maxHeight = DEFAULT_MAX_HEIGHT,
  bodyMinHeight,
  canApply,
  onApply,
  onAdvanced,
  onClose,
  children,
}: QuickActionShellProps) {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() =>
    computeAnchoredPosition(
      anchor,
      { width, height: ESTIMATED_HEIGHT },
      { width: window.innerWidth, height: window.innerHeight },
      MARGIN,
    ),
  );
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  // Correct the estimate with the real rendered size after the first paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(
      computeAnchoredPosition(
        anchor,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
        MARGIN,
      ),
    );
  }, [anchor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxX = Math.max(MARGIN, window.innerWidth - rect.width - MARGIN);
      const maxY = Math.max(MARGIN, window.innerHeight - rect.height - MARGIN);
      setPosition({
        x: Math.max(
          MARGIN,
          Math.min(
            dragRef.current.posX + e.clientX - dragRef.current.startX,
            maxX,
          ),
        ),
        y: Math.max(
          MARGIN,
          Math.min(
            dragRef.current.posY + e.clientY - dragRef.current.startY,
            maxY,
          ),
        ),
      });
    };
    const onUp = () => setDragging(false);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    setDragging(true);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal={false}
      aria-label={title}
      className="fixed bg-card border rounded-lg shadow-xl z-50 flex flex-col overflow-hidden select-none"
      style={{ left: position.x, top: position.y, width, maxHeight }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        onMouseDown={handleHeaderMouseDown}
        className={`flex items-center justify-between px-3 py-2 border-b bg-muted/20 shrink-0 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <span className="text-sm font-medium">{title}</span>
        <button
          onClick={onClose}
          className="no-drag p-0.5 hover:bg-accent rounded transition-colors shrink-0 text-muted-foreground/70 hover:text-foreground"
          aria-label={t.cancel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Radix's viewport `h-full` needs a definite height. The shell is an
          auto-height flex column, so cap the viewport itself instead of relying
          on the outer `max-height` (design 031 §5). */}
      <ScrollArea
        className="flex-1 min-h-0 no-drag"
        viewportClassName="overflow-y-auto"
        viewportStyle={{
          maxHeight: `calc(${maxHeight} - ${CHROME_HEIGHT}px)`,
          minHeight: bodyMinHeight,
        }}
        hideHorizontalScrollbar
        blockContent
      >
        <div className="p-3 space-y-3">{children}</div>
      </ScrollArea>

      <div className="flex items-center gap-2 px-3 py-2 border-t shrink-0 no-drag">
        {onAdvanced && (
          <button
            type="button"
            onClick={onAdvanced}
            disabled={!canApply}
            title={t.quickAdvancedHint}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
          >
            {t.quickAdvanced}
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="secondary" size="sm" disabled={!canApply} onClick={onApply}>
            {t.apply}
          </Button>
        </div>
      </div>
    </div>
  );
}
