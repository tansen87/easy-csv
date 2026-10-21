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
  Infinity as InfinityIcon,
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
  QuickActionKind,
  QuickActionRequest,
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
  headers: string[];
  onClose: () => void;
  /** Entries report what was clicked; the floating dialog anchors itself. */
  onSelect: (request: QuickActionRequest) => void;
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
          emit("filter");
        }}
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        {t.filterAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          emit("batch-filter");
        }}
      >
        <FunnelPlus className="h-4 w-4 text-muted-foreground" />
        {t.batchFilterAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          emit("replace");
        }}
      >
        <Replace className="h-4 w-4 text-muted-foreground" />
        {t.replaceAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          emit("pivot");
        }}
      >
        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
        {t.pivotAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          emit("date");
        }}
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {t.dateAction}
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          emit("window");
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
                      // Explicit mapping: the plain `split` entry used to be
                      // mangled by a `startsWith("split")` sniff.
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
                    emit("number-transform", {
                      numberTransform: option.transformType as NumberTransformKind,
                    });
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
          emit("sort");
        }}
      >
        <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
        {t.sortAction}
      </button>
    </div>
  );
}
