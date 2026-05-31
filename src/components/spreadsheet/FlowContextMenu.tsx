import {
  ArrowUp,
  ArrowDown,
} from "lucide-react";

interface FlowContextMenuState {
  x: number;
  y: number;
  stepId?: string;
}

interface FlowContextMenuProps {
  contextMenu: FlowContextMenuState;
  onClose: () => void;
  onMoveUp: (stepId?: string) => void;
  onMoveDown: (stepId?: string) => void;
}

export function FlowContextMenu({
  contextMenu,
  onClose,
  onMoveUp,
  onMoveDown,
}: FlowContextMenuProps) {
  return (
    <div
      className="fixed bg-card border rounded-lg shadow-lg z-50 py-1 min-w-[160px]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
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
          onMoveUp(contextMenu.stepId);
        }}
      >
        <ArrowUp className="h-4 w-4 text-muted-foreground" />
        Move Up
      </button>
      <button
        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors flex items-center gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          onMoveDown(contextMenu.stepId);
        }}
      >
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        Move Down
      </button>
    </div>
  );
}