import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { useLanguage } from "@/i18n";
import { computeAnchoredPosition } from "@/modules/dialogs/quick/lib/position";

interface QuickActionShellProps {
  title: string;
  /** Mono column index shown in the header, e.g. `03 · region`. */
  scope?: string;
  anchor: { x: number; y: number };
  width: number;
  /** CSS max-height of the whole dialog; defaults to `min(78vh, 680px)`. */
  maxHeight?: string;
  /** "Will add `command` · `detail`" line above the actions. */
  summary?: { command: string; detail: string };
  /** Replaces the summary while the draft cannot be applied, e.g. "value". */
  blocked?: string;
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
/** Header (40) + footer (10 + 14 + 8 + 28 + 12 + border). */
const CHROME_HEIGHT = 112;

/**
 * Floating, non-modal shell for the quick-action forms: anchored at the
 * right-click point, draggable by its title bar, closed by Esc or an outside
 * click. No backdrop — the canvas stays usable behind it.
 *
 * Layout follows design 055: the header names the operation and the column it
 * acts on, the footer states what will be added, and there is exactly one
 * filled action.
 */
export function QuickActionShell({
  title,
  scope,
  anchor,
  width,
  maxHeight = DEFAULT_MAX_HEIGHT,
  summary,
  blocked,
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
      className="quick-slip quick-enter fixed z-50 flex flex-col overflow-hidden rounded-[10px] border bg-paper select-none"
      style={{ left: position.x, top: position.y, width, maxHeight }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        onMouseDown={handleHeaderMouseDown}
        className={cn(
          "flex h-10 shrink-0 items-center gap-2 border-b pl-3.5 pr-2",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <span className="text-[13px] font-medium">{title}</span>
        {scope && (
          <span className="ml-auto whitespace-nowrap font-mono text-[10.5px] text-muted-foreground/80">
            {scope}
          </span>
        )}
        <button
          onClick={onClose}
          className={cn(
            "no-drag grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[5px] text-muted-foreground/80 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
            !scope && "ml-auto",
          )}
          aria-label={t.cancel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Radix's viewport `h-full` needs a definite height. The shell is an
          auto-height flex column, so cap the viewport itself instead of
          relying on the outer `max-height` (design 031 §5). */}
      <ScrollArea
        className="flex-1 min-h-0 no-drag"
        viewportClassName="overflow-y-auto"
        viewportStyle={{ maxHeight: `calc(${maxHeight} - ${CHROME_HEIGHT}px)` }}
        hideHorizontalScrollbar
        blockContent
      >
        <div className="flex flex-col gap-3 px-3.5 pb-2.5 pt-3">{children}</div>
      </ScrollArea>

      <div className="shrink-0 border-t px-3.5 pb-3 pt-2.5 no-drag">
        <div
          className={cn(
            "mb-2 flex min-h-3.5 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px]",
            blocked ? "text-warning" : "text-muted-foreground",
          )}
        >
          {blocked ? (
            <>
              <span>{t.quickMissing}</span>
              <span className="text-foreground">{blocked}</span>
            </>
          ) : summary ? (
            <>
              <span>{t.quickWillAdd}</span>
              <code className="font-mono text-[10.5px] text-foreground">
                {summary.command}
              </code>
              <span className="text-muted-foreground/50">·</span>
              <code className="min-w-0 overflow-hidden text-ellipsis font-mono text-[10.5px] text-foreground">
                {summary.detail}
              </code>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {onAdvanced && (
            <button
              type="button"
              onClick={onAdvanced}
              disabled={!canApply}
              title={t.quickAdvancedHint}
              className="rounded text-[11.5px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40"
            >
              {t.quickAdvanced}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-7 rounded-md px-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={!canApply}
              className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/70"
            >
              {t.quickAddStep}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
