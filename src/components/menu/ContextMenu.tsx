import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Filter,
  ArrowUpDown,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Grid3X3,
  Calendar,
  Scissors,
  Slice,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  Type,
  CaseLower,
  CaseUpper,
  Hash,
  AlignLeft,
  AlignRight,
  AlignCenter,
  DecimalsArrowLeft,
  DecimalsArrowRight,
  RulerDimensionLine,
  Infinity as InfinityIcon,
  Replace,
  LayoutGrid,
  Eraser,
  FunnelPlus,
  Plus,
  Minus,
  ListX,
  Copy,
  Pencil,
  Trash2,
  Crop,
  ClipboardList,
  PaintBucket,
  CircleSlash,
  Eye,
  EyeOff,
  FoldVertical,
  ChartColumn,
  Users,
  ListOrdered,
  Columns3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import type {
  NumberTransformKind,
  QuickActionKind,
  QuickActionRequest,
  TextTransformKind,
} from "@/types/dialog";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";

interface ContextMenuState {
  x: number;
  y: number;
  row: number | null;
  col: number;
}

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  headers: string[];
  onClose: () => void;
  /** Entries report what was clicked; the floating dialog anchors itself. */
  onSelect: (request: QuickActionRequest) => void;
}

function MenuItem({
  icon: Icon,
  label,
  trailing,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: ReactNode;
  trailing?: ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-accent",
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          danger ? "text-destructive" : "text-muted-foreground",
        )}
        strokeWidth={1.5}
      />
      <span className="truncate">{label}</span>
      {trailing}
    </button>
  );
}

/** One-level submenu that flips left / up when it would leave the viewport. */
function Submenu({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"right" | "left">("right");
  const [top, setTop] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const button = buttonRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!button || !panel) return;
    setSide(button.right + panel.width + 8 > window.innerWidth ? "left" : "right");
    const overflow = button.top + panel.height + 8 - window.innerHeight;
    setTop(overflow > 0 ? -overflow : 0);
  }, [open]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-[30px] w-full items-center gap-2 rounded-md px-2 text-left text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
        />
        <span className="truncate">{label}</span>
        <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/70" />
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-10",
            side === "right" ? "left-full pl-1" : "right-full pr-1",
          )}
          style={{ top }}
        >
          <div
            ref={panelRef}
            role="menu"
            className="min-w-[184px] rounded-lg border bg-card p-1 shadow-lg"
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export function ContextMenu({
  contextMenu,
  headers,
  onClose,
  onSelect,
}: ContextMenuProps) {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    x: contextMenu.x,
    y: contextMenu.y,
  });

  const emit = (
    kind: QuickActionKind,
    extra: Partial<QuickActionRequest> = {},
  ) => {
    onClose();
    onSelect({
      kind,
      x: contextMenu.x,
      y: contextMenu.y,
      col: contextMenu.col,
      headers,
      ...extra,
    });
  };

  useEffect(() => {
    const updatePosition = () => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = contextMenu.x;
        let y = contextMenu.y;

        if (x + menuRect.width > viewportWidth) {
          x = viewportWidth - menuRect.width - 8;
        }
        if (y + menuRect.height > viewportHeight) {
          y = Math.max(8, y - menuRect.height);
        }

        x = Math.max(8, x);
        y = Math.max(8, y);

        setPosition({ x, y });
      }
    };

    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [contextMenu.x, contextMenu.y]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const textTransformOptions: {
    label: string;
    icon: LucideIcon;
    transformType: TextTransformKind | "splitLeft" | "splitRight" | "slice" | "split" | "pad";
  }[] = [
    {
      label: t.textTransformLen,
      icon: RulerDimensionLine,
      transformType: "len",
    },
    {
      label: t.textTransformLower,
      icon: CaseLower,
      transformType: "lower",
    },
    {
      label: t.textTransformUpper,
      icon: CaseUpper,
      transformType: "upper",
    },
    {
      label: t.textTransformTrim,
      icon: AlignCenter,
      transformType: "trim",
    },
    {
      label: t.textTransformLtrim,
      icon: AlignLeft,
      transformType: "ltrim",
    },
    {
      label: t.textTransformRtrim,
      icon: AlignRight,
      transformType: "rtrim",
    },
    {
      label: t.textTransformStrip,
      icon: Eraser,
      transformType: "strip",
    },
    { label: t.sliceLeft, icon: ArrowLeftFromLine, transformType: "splitLeft" },
    {
      label: t.sliceRight,
      icon: ArrowRightFromLine,
      transformType: "splitRight",
    },
    { label: t.sliceSlice, icon: Slice, transformType: "slice" },
    { label: t.sliceSplit, icon: Scissors, transformType: "split" },
    { label: t.slicePad, icon: AlignCenter, transformType: "pad" },
  ];

  const numberTransformOptions: {
    label: string;
    icon: LucideIcon;
    transformType: NumberTransformKind;
  }[] = [
    { label: t.numTransformAbs, icon: Plus, transformType: "abs" },
    { label: t.numTransformNeg, icon: Minus, transformType: "neg" },
    { label: t.numTransformFloor, icon: ArrowDown, transformType: "floor" },
    { label: t.numTransformCeil, icon: ArrowUp, transformType: "ceil" },
    { label: t.numTransformInt, icon: DecimalsArrowLeft, transformType: "int" },
    { label: t.numTransformFloat, icon: InfinityIcon, transformType: "float" },
    {
      label: t.numTransformRound,
      icon: DecimalsArrowRight,
      transformType: "round",
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 w-[208px] rounded-lg border bg-card py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 border-b px-3 py-1 text-xs font-semibold text-muted-foreground">
        {t.quickActions}
      </div>

      <MenuItem icon={Filter} label={t.filterAction} onClick={() => emit("filter")} />
      <MenuItem
        icon={FunnelPlus}
        label={t.batchFilterAction}
        onClick={() => emit("batch-search")}
      />
      <MenuItem
        icon={ArrowUpDown}
        label={t.sortAction}
        onClick={() => emit("sort")}
      />

      <div className="my-1 h-px bg-border/60" />

      <Submenu icon={CircleSlash} label={t.emptyValuesAction}>
        <MenuItem
          icon={Eye}
          label={t.onlyEmptyAction}
          onClick={() => emit("search-empty")}
        />
        <MenuItem
          icon={EyeOff}
          label={t.excludeEmptyAction}
          onClick={() => emit("search-non-empty")}
        />
        <div className="my-1 h-px bg-border/60" />
        <MenuItem
          icon={PaintBucket}
          label={t.fillAction}
          onClick={() => emit("fill")}
        />
        <MenuItem
          icon={FoldVertical}
          label={t.blankDownAction}
          onClick={() => emit("blank-column")}
        />
      </Submenu>
      <MenuItem
        icon={ListX}
        label={t.dedupByColumnAction}
        onClick={() => emit("dedup-column")}
      />

      <div className="my-1 h-px bg-border/60" />

      <Submenu icon={Type} label={t.contextText}>
        <ScrollArea className="h-[240px]">
          {textTransformOptions.map((option) => (
            <MenuItem
              key={option.transformType}
              icon={option.icon}
              label={option.label}
              onClick={() => {
                const value = option.transformType;
                if (value === "splitLeft") {
                  emit("slice", { slice: "left" });
                } else if (value === "splitRight") {
                  emit("slice", { slice: "right" });
                } else if (value === "slice") {
                  emit("slice", { slice: "slice" });
                } else if (value === "split") {
                  emit("slice", { slice: "split" });
                } else if (value === "pad") {
                  emit("pad", { pad: "pad" });
                } else {
                  emit("text-transform", {
                    textTransform: value as TextTransformKind,
                  });
                }
              }}
            />
          ))}
        </ScrollArea>
      </Submenu>
      <Submenu icon={Hash} label={t.contextNumber}>
        {numberTransformOptions.map((option) => (
          <MenuItem
            key={option.transformType}
            icon={option.icon}
            label={option.label}
            onClick={() =>
              emit("number-transform", {
                numberTransform: option.transformType,
              })
            }
          />
        ))}
      </Submenu>
      <MenuItem
        icon={Replace}
        label={t.replaceAction}
        onClick={() => emit("replace")}
      />
      <MenuItem
        icon={Calendar}
        label={t.dateAction}
        onClick={() => emit("date")}
      />

      <div className="my-1 h-px bg-border/60" />

      <Submenu icon={ChartColumn} label={t.analyzeActions}>
        <MenuItem
          icon={Users}
          label={t.groupAggregateAction}
          onClick={() => emit("groupby")}
        />
        <MenuItem
          icon={ListOrdered}
          label={t.topRowsAction}
          onClick={() => emit("top")}
        />
        <div className="my-1 h-px bg-border/60" />
        <MenuItem
          icon={Grid3X3}
          label={t.pivotAction}
          onClick={() => emit("pivot")}
        />
        <MenuItem
          icon={LayoutGrid}
          label={t.windowAction}
          onClick={() => emit("window")}
        />
      </Submenu>

      <Submenu icon={Columns3} label={t.columnActions}>
        <MenuItem
          icon={Copy}
          label={t.copyColumnNameAction}
          onClick={() => emit("copy-column-name")}
        />
        <MenuItem
          icon={ClipboardList}
          label={t.copyColumnAction}
          onClick={() => emit("copy-column")}
        />
        <MenuItem
          icon={Pencil}
          label={t.renameColumnAction}
          onClick={() => emit("rename-column")}
        />
        <div className="my-1 h-px bg-border/60" />
        <MenuItem
          icon={Trash2}
          label={t.deleteColumnAction}
          danger
          onClick={() => emit("drop-column")}
        />
        <MenuItem
          icon={Crop}
          label={t.keepOnlyColumnAction}
          danger
          onClick={() => emit("keep-column")}
        />
      </Submenu>
    </div>
  );
}
