import { useState, useEffect, useRef } from "react";
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
  Infinity,
  Replace,
  LayoutGrid,
  Eraser,
  FunnelPlus,
  Plus,
  Minus,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/ScrollArea";
import type {
  NumberTransformKind,
  PadKind,
  SliceKind,
  TextTransformKind,
} from "@/types/dialog";
import { useLanguage } from "@/i18n";

interface ContextMenuState {
  x: number;
  y: number;
  row: number | null;
  col: number;
}

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  // Entries report what was clicked; the floating dialogs they used to open —
  // and therefore their x/y — are gone (design 019 §3.1).
  onOpenFilterDialog: (col: number) => void;
  onOpenBatchFilter: () => void;
  onOpenPivotDialog: () => void;
  onOpenDateTransformDialog: (col: number) => void;
  onOpenTextTransformDialog: (col: number, transformType: TextTransformKind) => void;
  onOpenSliceDialog: (col: number, sliceType: SliceKind) => void;
  onOpenReplaceDialog: (col: number) => void;
  onOpenWindowDialog: (col: number) => void;
  onOpenPadDialog: (col: number, padType: PadKind) => void;
  onOpenNumberTransformDialog: (
    col: number,
    transformType: NumberTransformKind,
  ) => void;
  onOpenSortDialog: (col: number) => void;
}

export function ContextMenu({
  contextMenu,
  onClose,
  onOpenFilterDialog,
  onOpenBatchFilter,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenTextTransformDialog,
  onOpenSliceDialog,
  onOpenReplaceDialog,
  onOpenWindowDialog,
  onOpenPadDialog,
  onOpenNumberTransformDialog,
  onOpenSortDialog,
}: ContextMenuProps) {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    x: contextMenu.x,
    y: contextMenu.y,
  });

  useEffect(() => {
    const updatePosition = () => {
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = contextMenu.x;
        let y = contextMenu.y;

        // Adjust horizontal position if menu overflows right
        if (x + menuRect.width > viewportWidth) {
          x = viewportWidth - menuRect.width - 8;
        }

        // Adjust vertical position if menu overflows bottom
        if (y + menuRect.height > viewportHeight) {
          y = Math.max(8, y - menuRect.height);
        }

        // Ensure menu doesn't overflow left or top
        x = Math.max(8, x);
        y = Math.max(8, y);

        setPosition({ x, y });
      }
    };

    // Use requestAnimationFrame to ensure DOM is fully rendered before calculating
    const rafId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafId);
  }, [contextMenu.x, contextMenu.y]);

  const handleSubmenuOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    const dropdown = e.currentTarget.nextElementSibling as HTMLElement;
    if (!dropdown) return;

    dropdown.classList.remove("hidden");

    const buttonRect = e.currentTarget.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if dropdown overflows to the right
    if (buttonRect.right + dropdownRect.width > viewportWidth) {
      dropdown.style.left = "-100%";
      dropdown.style.right = "auto";
    } else {
      dropdown.style.left = "100%";
      dropdown.style.right = "auto";
    }

    // Check if dropdown overflows to the bottom
    if (buttonRect.bottom + dropdownRect.height > viewportHeight) {
      const overflow = buttonRect.bottom + dropdownRect.height - viewportHeight;
      dropdown.style.top = `${-overflow}px`;
    } else {
      dropdown.style.top = "0";
    }
  };

  const textTransformOptions = [
    {
      label: t.textTransformLen,
      icon: RulerDimensionLine,
      transformType: "len" as TextTransformKind,
    },
    {
      label: t.textTransformLower,
      icon: CaseLower,
      transformType: "lower" as TextTransformKind,
    },
    {
      label: t.textTransformUpper,
      icon: CaseUpper,
      transformType: "upper" as TextTransformKind,
    },
    {
      label: t.textTransformTrim,
      icon: AlignCenter,
      transformType: "trim" as TextTransformKind,
    },
    {
      label: t.textTransformLtrim,
      icon: AlignLeft,
      transformType: "ltrim" as TextTransformKind,
    },
    {
      label: t.textTransformRtrim,
      icon: AlignRight,
      transformType: "rtrim" as TextTransformKind,
    },
    {
      label: t.textTransformStrip,
      icon: Eraser,
      transformType: "strip" as TextTransformKind,
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

  const numberTransformOptions = [
    { label: t.numTransformAbs, icon: Plus, transformType: "abs" },
    { label: t.numTransformNeg, icon: Minus, transformType: "neg" },
    { label: t.numTransformFloor, icon: ArrowDown, transformType: "floor" },
    { label: t.numTransformCeil, icon: ArrowUp, transformType: "ceil" },
    { label: t.numTransformInt, icon: DecimalsArrowLeft, transformType: "int" },
    { label: t.numTransformFloat, icon: Infinity, transformType: "float" },
    {
      label: t.numTransformRound,
      icon: DecimalsArrowRight,
      transformType: "round",
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground border-b mb-1">
        {t.quickActions}
      </div>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenFilterDialog(contextMenu.col);
        }}
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        {t.filterAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenBatchFilter();
        }}
      >
        <FunnelPlus className="h-4 w-4 text-muted-foreground" />
        {t.batchFilterAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenReplaceDialog(contextMenu.col);
        }}
      >
        <Replace className="h-4 w-4 text-muted-foreground" />
        {t.replaceAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenPivotDialog();
        }}
      >
        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
        {t.pivotAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenDateTransformDialog(contextMenu.col);
        }}
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {t.dateAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenWindowDialog(contextMenu.col);
        }}
      >
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        {t.windowAction}
      </button>

      <div className="relative group">
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
          onMouseEnter={handleSubmenuOpen}
          onMouseLeave={(e) => {
            const dropdown = e.currentTarget.nextElementSibling;
            if (dropdown) dropdown.classList.add("hidden");
          }}
        >
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            {t.contextText}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>

        <div
          className="absolute top-0 hidden pl-1"
          onMouseEnter={(e) => {
            e.currentTarget.classList.remove("hidden");
          }}
          onMouseLeave={(e) => {
            e.currentTarget.classList.add("hidden");
          }}
        >
          <div className="bg-card border rounded-lg shadow-lg py-1 min-w-[160px]">
            <ScrollArea className="h-[240px]">
              {textTransformOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.transformType}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      // Map the menu entry onto its canvas action. Previously
                      // this sniffed `transformType.startsWith("split")` and
                      // stripped the prefix, which turned the plain `split`
                      // entry into an empty string; the mapping is explicit
                      // now, and the remaining entries are text transforms.
                      const value = option.transformType;
                      if (value === "splitLeft") {
                        onOpenSliceDialog(contextMenu.col, "left");
                      } else if (value === "splitRight") {
                        onOpenSliceDialog(contextMenu.col, "right");
                      } else if (value === "slice") {
                        onOpenSliceDialog(contextMenu.col, "slice");
                      } else if (value === "split") {
                        onOpenSliceDialog(contextMenu.col, "split");
                      } else if (value === "pad") {
                        onOpenPadDialog(contextMenu.col, "pad");
                      } else {
                        onOpenTextTransformDialog(
                          contextMenu.col,
                          value as TextTransformKind,
                        );
                      }
                    }}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {option.label}
                  </button>
                );
              })}
            </ScrollArea>
          </div>
        </div>
      </div>

      <div className="relative group">
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
          onMouseEnter={handleSubmenuOpen}
          onMouseLeave={(e) => {
            const dropdown = e.currentTarget.nextElementSibling;
            if (dropdown) dropdown.classList.add("hidden");
          }}
        >
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-muted-foreground" />
            {t.contextNumber}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>

        <div
          className="absolute top-0 hidden pl-1"
          onMouseEnter={(e) => {
            e.currentTarget.classList.remove("hidden");
          }}
          onMouseLeave={(e) => {
            e.currentTarget.classList.add("hidden");
          }}
        >
          <div className="bg-card border rounded-lg shadow-lg py-1 min-w-[160px]">
            {numberTransformOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.transformType}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onOpenNumberTransformDialog(
                      contextMenu.col,
                      option.transformType as NumberTransformKind,
                    );
                  }}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenSortDialog(contextMenu.col);
        }}
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        {t.sortAction}
      </button>
    </div>
  );
}
