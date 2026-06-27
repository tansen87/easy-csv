import { useState, useEffect, useRef } from "react";
import {
  Filter,
  ArrowUpDown,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUp01,
  ArrowDown01,
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
  Ruler,
  RulerDimensionLine,
  Infinity,
  Replace,
  LayoutGrid,
  Eraser,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TextTransformType } from "@/components/spreadsheet/TextTransformDialog";
import { NumberTransformType } from "@/components/spreadsheet/NumberTransformDialog";

interface ContextMenuState {
  x: number;
  y: number;
  row: number | null;
  col: number;
}

interface ContextMenuProps {
  contextMenu: ContextMenuState;
  onClose: () => void;
  onOpenFilterDialog: (col: number, x: number, y: number) => void;
  onOpenPivotDialog: (x: number, y: number) => void;
  onOpenDateTransformDialog: (col: number, x: number, y: number) => void;
  onOpenTextTransformDialog: (col: number, x: number, y: number, transformType?: TextTransformType) => void;
  onOpenSliceDialog: (col: number, x: number, y: number, sliceType?: string) => void;
  onOpenReplaceDialog: (col: number, x: number, y: number) => void;
  onOpenWindowDialog: (col: number, x: number, y: number) => void;
  onOpenPadDialog: (col: number, x: number, y: number, padType: string) => void;
  onOpenNumberTransformDialog: (col: number, x: number, y: number, transformType?: NumberTransformType) => void;
  onSort: (col: number, order: "asc" | "desc", numeric: boolean) => void;
}

export function ContextMenu({
  contextMenu,
  onClose,
  onOpenFilterDialog,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenTextTransformDialog,
  onOpenSliceDialog,
  onOpenReplaceDialog,
  onOpenWindowDialog,
  onOpenPadDialog,
  onOpenNumberTransformDialog,
  onSort,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: contextMenu.x, y: contextMenu.y });

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

  const sortOptions = [
    { label: "A → Z", icon: ArrowDownAZ, order: "asc" as const, numeric: false },
    { label: "Z → A", icon: ArrowUpAZ, order: "desc" as const, numeric: false },
    { label: "0 → 9", icon: ArrowDown01, order: "asc" as const, numeric: true },
    { label: "9 → 0", icon: ArrowUp01, order: "desc" as const, numeric: true },
  ];

  const textTransformOptions = [
    { label: "Len", icon: RulerDimensionLine, transformType: "len" as TextTransformType },
    { label: "Lowercase", icon: CaseLower, transformType: "lower" as TextTransformType },
    { label: "Uppercase", icon: CaseUpper, transformType: "upper" as TextTransformType },
    { label: "Trim", icon: AlignCenter, transformType: "trim" as TextTransformType },
    { label: "LTrim", icon: AlignLeft, transformType: "ltrim" as TextTransformType },
    { label: "RTrim", icon: AlignRight, transformType: "rtrim" as TextTransformType },
    { label: "Strip", icon: Eraser, transformType: "strip" as TextTransformType },
    { label: "Left", icon: ArrowLeftFromLine, transformType: "splitLeft" },
    { label: "Right", icon: ArrowRightFromLine, transformType: "splitRight" },
    { label: "Slice", icon: Slice, transformType: "slice" },
    { label: "Split", icon: Scissors, transformType: "split" },
    { label: "Pad", icon: AlignCenter, transformType: "pad" },
  ];

  const numberTransformOptions = [
    { label: "Abs", icon: Ruler, transformType: "abs" },
    { label: "Floor", icon: ArrowDown, transformType: "floor" },
    { label: "Ceil", icon: ArrowUp, transformType: "ceil" },
    { label: "Integer", icon: DecimalsArrowLeft, transformType: "int" },
    { label: "Float", icon: Infinity, transformType: "float" },
    { label: "Round", icon: DecimalsArrowRight, transformType: "round" },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed bg-card border rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground border-b mb-1">
        Quick Actions
      </div>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenFilterDialog(contextMenu.col, contextMenu.x, contextMenu.y);
        }}
      >
        <Filter className="h-4 w-4 text-muted-foreground" />
        Filter
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenReplaceDialog(contextMenu.col, contextMenu.x, contextMenu.y);
        }}
      >
        <Replace className="h-4 w-4 text-muted-foreground" />
        Replace
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenPivotDialog(contextMenu.x, contextMenu.y);
        }}
      >
        <Grid3X3 className="h-4 w-4 text-muted-foreground" />
        Pivot Table
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenDateTransformDialog(contextMenu.col, contextMenu.x, contextMenu.y);
        }}
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        Date
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenWindowDialog(contextMenu.col, contextMenu.x, contextMenu.y);
        }}
      >
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        Window
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
            Text
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
                      if (option.transformType.startsWith("split") || option.transformType === "slice") {
                        let sliceType = option.transformType;
                        if (sliceType.startsWith("split")) {
                          sliceType = sliceType.replace("split", "").toLowerCase();
                        }
                        onOpenSliceDialog(contextMenu.col, contextMenu.x, contextMenu.y, sliceType);
                      } else if (option.transformType === "pad") {
                        onOpenPadDialog(contextMenu.col, contextMenu.x, contextMenu.y, "pad");
                      } else {
                        onOpenTextTransformDialog(contextMenu.col, contextMenu.x, contextMenu.y, option.transformType as TextTransformType);
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
            Number
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
                    onOpenNumberTransformDialog(contextMenu.col, contextMenu.x, contextMenu.y, option.transformType as NumberTransformType);
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
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            Sort
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
            {sortOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={`${option.order}-${option.numeric}`}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onSort(contextMenu.col, option.order, option.numeric);
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
    </div>
  );
}
