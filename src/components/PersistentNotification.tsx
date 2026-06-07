import { useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle, Info, X, ChevronDown, ChevronUp } from "lucide-react";

export type NotificationType = "warning" | "info" | "error" | "success";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

const iconMap = {
  success: AlertCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const colorMap = {
  success: "bg-green-500/10 text-green-600 border-green-500/20",
  error: "bg-red-500/10 text-red-600 border-red-500/20",
  warning: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  info: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

const iconColorMap = {
  success: "text-green-500",
  error: "text-red-500",
  warning: "text-yellow-500",
  info: "text-blue-500",
};

export interface NotificationPanelProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
}

export function NotificationPanel({ notifications, onDismiss, onDismissAll }: NotificationPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [position, setPosition] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".notification-panel-header")) {
      e.preventDefault();

      // Get current panel position from DOM if not set
      const rect = panelRef.current?.getBoundingClientRect();
      const currentX = position.x ?? rect?.left ?? 0;
      const currentY = position.y ?? rect?.top ?? 48;

      // Set position to current actual position before starting drag
      if (position.x === null || position.y === null) {
        setPosition({ x: currentX, y: currentY });
      }

      setIsDragging(true);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: currentX,
        startPosY: currentY,
      };
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    setPosition({
      x: dragRef.current.startPosX + deltaX,
      y: dragRef.current.startPosY + deltaY,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (notifications.length === 0) return null;

  const warningCount = notifications.filter(n => n.type === "warning").length;
  const errorCount = notifications.filter(n => n.type === "error").length;

  return (
    <div
      ref={panelRef}
      className={`fixed z-40 w-96 ${isDragging ? "cursor-grabbing" : ""}`}
      style={{
        left: position.x !== null ? position.x : "auto",
        top: position.y !== null ? position.y : 48,
        right: position.x !== null ? "auto" : 16,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="notification-panel-header flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/30 cursor-grab select-none">
          <div className="flex items-center gap-2 flex-1">
            {warningCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-yellow-600">
                <AlertCircle className="h-3 w-3" />
                {warningCount}
              </span>
            )}
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-3 w-3" />
                {errorCount}
              </span>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {notifications.length} notification{notifications.length > 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismissAll();
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear all
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            className="p-0.5 hover:bg-muted/50 rounded transition-colors"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <div className="max-h-64 overflow-y-auto">
            {notifications.map((notification) => {
              const Icon = iconMap[notification.type];
              return (
                <div
                  key={notification.id}
                  className={`flex items-center gap-2 px-3 py-2 border-b border-border/20 last:border-b-0 ${colorMap[notification.type]}`}
                >
                  <Icon className={`h-4 w-4 ${iconColorMap[notification.type]} flex-shrink-0`} />
                  <span className="text-sm flex-1">{notification.message}</span>
                  <button
                    onClick={() => onDismiss(notification.id)}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
