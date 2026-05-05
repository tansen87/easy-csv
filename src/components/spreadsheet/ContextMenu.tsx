import {
  Copy,
  Filter,
  ArrowUpDown,
  ChevronRight,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUp01,
  ArrowDown01,
  Grid3X3,
  Rows3,
  Repeat,
  Repeat2,
  Settings2,
  Calendar,
  Scissors
} from "lucide-react";

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
  onOpenSplitDialog: (col: number, x: number, y: number) => void;
  onSort: (col: number, order: "asc" | "desc", numeric: boolean) => void;
  onDedup: (col: number) => void;
  onTranspose: (col: number) => void;
  onReverse: (col: number) => void;
  onCopy?: () => void;
  hasSelection?: boolean;
}

export function ContextMenu({
  contextMenu,
  onClose,
  onOpenFilterDialog,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenSplitDialog,
  onSort,
  onDedup,
  onTranspose,
  onReverse,
  onCopy,
  hasSelection,
}: ContextMenuProps) {
  const sortOptions = [
    { label: "A → Z", icon: ArrowDownAZ, order: "asc" as const, numeric: false },
    { label: "Z → A", icon: ArrowUpAZ, order: "desc" as const, numeric: false },
    { label: "0 → 9", icon: ArrowDown01, order: "asc" as const, numeric: true },
    { label: "9 → 0", icon: ArrowUp01, order: "desc" as const, numeric: true },
  ];

  const operationOptions = [
    { label: "Dedup", icon: Rows3, action: onDedup },
    { label: "Transpose", icon: Repeat2, action: onTranspose },
    { label: "Reverse", icon: Repeat, action: onReverse },
  ];

  return (
    <div
      className="fixed bg-card border rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1 text-xs font-semibold text-muted-foreground border-b mb-1">
        Quick Actions
      </div>

      {hasSelection && onCopy && (
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onCopy();
          }}
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
          Copy
        </button>
      )}

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
        Date Transform
      </button>

      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onOpenSplitDialog(contextMenu.col, contextMenu.x, contextMenu.y);
        }}
      >
        <Scissors className="h-4 w-4 text-muted-foreground" />
        Split Column
      </button>

      <div className="relative group">
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            Sort
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>

        <div className="absolute left-full top-0 hidden group-hover:block pl-1">
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

      <div className="relative group">
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
            Operation
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>

        <div className="absolute left-full top-0 hidden group-hover:block pl-1">
          <div className="bg-card border rounded-lg shadow-lg py-1 min-w-[160px]">
            {operationOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.label}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    option.action(contextMenu.col);
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
