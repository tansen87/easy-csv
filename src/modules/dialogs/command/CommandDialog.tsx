import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useStore } from "reactflow";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { CommandFormBody } from "@/modules/dialogs/command/CommandFormBody";
import { COMMAND_LABELS, type CommandDialogState } from "@/types/dialog";
import { useLanguage } from "@/i18n";

// Kept as a re-export so imports written against the old location keep working
// while call sites migrate to `@/types/dialog` (design 019 §8).
export type {
  CommandDialogState,
  CommandDialogType,
  CommandFormProps,
} from "@/types/dialog";
export { COMMAND_LABELS } from "@/types/dialog";

interface CommandDialogProps {
  commandDialog: CommandDialogState | null;
  onAddCommand: (
    command: import("@/types/xan").XanCommand,
    initialParameters?: Record<string, any>,
  ) => void;
  onStepUpdate?: (stepId: string, parameters: Record<string, any>) => void;
  setCommandDialog: (dialog: CommandDialogState | null) => void;
  headers?: string[];
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
  /** Open this command's docs (design 074); the old dock row `?` moved here. */
  onShowHelp?: (commandName: string) => void;
}

/** Popover width on a roomy canvas. */
const POPOVER_WIDTH = 480;
/** Cap for the whole surface; the form body scrolls inside it. */
const POPOVER_MAX_HEIGHT = 560;
/** Gap between the anchored card and the popover. */
const ANCHOR_GAP = 12;
/** Keep this much canvas visible on every side. */
const EDGE_MARGIN = 8;
const HEADER_HEIGHT = 40;
/** Header + the form's own footer (CommandFormShell 56 / ParamSheet 52). */
const CHROME_HEIGHT = HEADER_HEIGHT + 56;
/** CSS variable the surface reads to cap its scroll area. */
const MAX_HEIGHT_VAR = "--command-popover-max-height";

/**
 * Design 081 · B — the parameter popover anchored to its step card.
 *
 * `CommandPopover` is the only part that re-renders while a card moves: it
 * derives the position from the React Flow store (node position × viewport
 * transform) and writes a single `translate3d`. It never reads layout, and the
 * surface (form included) is passed in as `children`, so React reuses that
 * subtree instead of re-rendering it on every drag frame. This is what fixes
 * the old popover's jank (see prototype 081 §02.1).
 */
export function CommandDialog(props: CommandDialogProps) {
  if (!props.commandDialog) return null;
  const { commandDialog } = props;
  return (
    <CommandPopover anchorStepId={commandDialog.stepId}>
      <CommandDialogSurface {...props} commandDialog={commandDialog} />
    </CommandPopover>
  );
}

function CommandPopover({
  anchorStepId,
  children,
}: {
  anchorStepId?: string;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const surfaceWrapRef = useRef<HTMLDivElement>(null);
  /** Canvas size, kept fresh by a ResizeObserver — never read per drag frame. */
  const [host, setHost] = useState({ width: 0, height: 0 });
  /** Rendered popover height, so the clamp knows how tall it really is. */
  const [popoverHeight, setPopoverHeight] = useState(0);
  /**
   * The visible card's box inside its React Flow node, in flow units. The node
   * box and the card are not always the same size (the layout gives the node a
   * nominal width), and anchoring to the node box made the right-hand gap
   * wider than the left-hand one. Measured once per open — never per frame.
   */
  const [cardBox, setCardBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const anchorNode = useStore(
    useCallback(
      (state) =>
        anchorStepId ? state.nodeInternals.get(anchorStepId) : undefined,
      [anchorStepId],
    ),
  );
  const [viewX, viewY, zoom] = useStore(
    useCallback((state) => state.transform, []),
  );
  /** Latest zoom for one-off measurements, without re-running on every pan. */
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useLayoutEffect(() => {
    const hostEl = hostRef.current;
    if (!hostEl) return;
    const measure = () =>
      setHost({ width: hostEl.clientWidth, height: hostEl.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(hostEl);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const wrap = surfaceWrapRef.current;
    if (!wrap) return;
    const measure = () => setPopoverHeight(wrap.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!anchorStepId) {
      setCardBox(null);
      return;
    }
    const hostEl = hostRef.current;
    // The host is a sibling of the canvas, so the card lives in the parent
    // scope — querying inside the host itself finds nothing (and silently fell
    // back to React Flow's nominal node width).
    const canvasScope = hostEl?.parentElement ?? null;
    const nodeEl = canvasScope?.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${anchorStepId}"]`,
    );
    const cardEl = nodeEl?.querySelector<HTMLElement>("[data-step-card]");
    if (!nodeEl || !cardEl) {
      setCardBox(null);
      return;
    }
    // Rects are in screen px; dividing by the zoom turns them into flow units,
    // so later pan/zoom can reuse the same numbers without measuring again.
    const scale = zoomRef.current || 1;
    const nodeRect = nodeEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    if (cardRect.width < 1 || cardRect.height < 1) {
      // Hidden / not laid out yet: fall back to the node box for this frame.
      setCardBox(null);
      return;
    }
    setCardBox({
      left: (cardRect.left - nodeRect.left) / scale,
      top: (cardRect.top - nodeRect.top) / scale,
      width: cardRect.width / scale,
      height: cardRect.height / scale,
    });
  }, [anchorStepId]);

  const maxHeight = Math.max(
    200,
    Math.min(POPOVER_MAX_HEIGHT, host.height - EDGE_MARGIN * 2),
  );
  const availableWidth = Math.max(0, host.width - EDGE_MARGIN * 2);
  const width = Math.min(POPOVER_WIDTH, availableWidth || POPOVER_WIDTH);

  // Flow coordinates → canvas pixels, pure arithmetic. The card's own box wins
  // over the node's nominal size, so both gaps are measured from the same edge
  // the user sees.
  const nodeX = anchorNode?.positionAbsolute?.x ?? anchorNode?.position.x ?? 0;
  const nodeY = anchorNode?.positionAbsolute?.y ?? anchorNode?.position.y ?? 0;
  const cardWidth = (cardBox?.width ?? anchorNode?.width ?? 0) * zoom;
  const cardHeight = (cardBox?.height ?? anchorNode?.height ?? 0) * zoom;
  const cardX = (nodeX + (cardBox?.left ?? 0)) * zoom + viewX;
  const cardY = (nodeY + (cardBox?.top ?? 0)) * zoom + viewY;

  const renderedHeight = popoverHeight || maxHeight;
  let x: number;
  let y: number;
  if (anchorNode && cardWidth > 0 && cardHeight > 0) {
    // Right of the card, flipping left when the right edge has no room.
    x = cardX + cardWidth + ANCHOR_GAP;
    if (x + width > host.width - EDGE_MARGIN) {
      x = cardX - width - ANCHOR_GAP;
    }
    y = cardY;
  } else {
    // No card to anchor to (new command): centre in the canvas, still no scrim.
    x = (host.width - width) / 2;
    y = (host.height - renderedHeight) / 2;
  }
  x = Math.max(EDGE_MARGIN, Math.min(x, host.width - width - EDGE_MARGIN));
  y = Math.max(
    EDGE_MARGIN,
    Math.min(y, host.height - renderedHeight - EDGE_MARGIN),
  );

  return (
    <div
      ref={hostRef}
      data-testid="command-dialog-anchor"
      className="pointer-events-none absolute inset-0 z-30"
    >
      <div
        ref={surfaceWrapRef}
        className="absolute left-0 top-0"
        style={
          {
            width,
            maxHeight,
            transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`,
            [MAX_HEIGHT_VAR]: `${Math.round(maxHeight)}px`,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  );
}

function CommandDialogSurface({
  commandDialog,
  onAddCommand,
  onStepUpdate,
  setCommandDialog,
  headers = [],
  sourceTable,
  onShowHelp,
}: CommandDialogProps & { commandDialog: CommandDialogState }) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Land in the first field, the same way the old dialog did.
  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>(
        "input:not([type='hidden']), textarea, select",
      )
      ?.focus();
  }, [commandDialog.type, commandDialog.stepId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCommandDialog(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setCommandDialog]);

  const title = commandDialog.stepLabel ?? COMMAND_LABELS[commandDialog.type];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal={false}
      aria-label={title}
      className="pointer-events-auto flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
      style={{ maxHeight: `var(${MAX_HEIGHT_VAR})` }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border pl-3.5 pr-2">
        <h3 className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {title}
        </h3>
        <span className="flex-none font-mono text-[10px] text-muted-foreground">
          {commandDialog.type}
        </span>
        <div className="ml-auto flex flex-none items-center gap-0.5">
          {onShowHelp && (
            <Tooltip content={t.commandDocs}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.commandDocs}
                onClick={() => onShowHelp(commandDialog.type)}
              >
                <BookOpen className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          <Tooltip content={t.close}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.close}
              onClick={() => setCommandDialog(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex min-h-0 flex-col">
        <CommandFormBody
          commandDialog={commandDialog}
          onAddCommand={onAddCommand}
          onStepUpdate={onStepUpdate}
          setCommandDialog={setCommandDialog}
          headers={headers}
          sourceTable={sourceTable}
          bodyMaxHeight={`calc(var(${MAX_HEIGHT_VAR}, ${POPOVER_MAX_HEIGHT}px) - ${CHROME_HEIGHT}px)`}
        />
      </div>
    </div>
  );
}
