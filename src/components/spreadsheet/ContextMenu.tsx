import {
  Copy,
  SlidersHorizontal,
  ArrowUp,
  ChevronRight,
  Type,
  Hash,
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
  onSort: (col: number, order: "asc" | "desc", numeric: boolean) => void;
  onCopy?: () => void;
  hasSelection?: boolean;
}

export function ContextMenu({
  contextMenu,
  onClose,
  onOpenFilterDialog,
  onSort,
  onCopy,
  hasSelection,
}: ContextMenuProps) {
  const sortOptions = [
    { label: "Text A → Z", icon: Type, order: "asc" as const, numeric: false },
    { label: "Text Z → A", icon: Type, order: "desc" as const, numeric: false },
    { label: "Number ↑", icon: Hash, order: "asc" as const, numeric: true },
    { label: "Number ↓", icon: Hash, order: "desc" as const, numeric: true },
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
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        Filter
      </button>
      
      <div className="relative group">
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}
