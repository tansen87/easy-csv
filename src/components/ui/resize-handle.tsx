import * as React from "react";

interface ResizeHandleProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      if (direction === "vertical") {
        onResize(e.movementY);
      } else {
        onResize(e.movementX);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, direction, onResize]);

  return (
    <div
      className={`relative ${className}`}
      onMouseDown={handleMouseDown}
    >
      {direction === "vertical" ? (
        <div className="absolute top-0 left-0 right-0 h-1 bg-border cursor-ns-resize hover:bg-muted" />
      ) : (
        <div className="absolute top-0 bottom-0 left-0 w-1 bg-border cursor-ew-resize hover:bg-muted" />
      )}
    </div>
  );
}