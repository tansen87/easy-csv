import * as React from "react";

interface ResizeHandleProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  className?: string;
}

export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const [startPos, setStartPos] = React.useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    if (direction === "vertical") {
      setStartPos(e.clientY);
    } else {
      setStartPos(e.clientX);
    }
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      if (direction === "vertical") {
        onResize(e.clientY - startPos);
        setStartPos(e.clientY);
      } else {
        onResize(e.clientX - startPos);
        setStartPos(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "vertical" ? "ns-resize" : "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, direction, onResize, startPos]);

  return (
    <div
      className={`relative ${className}`}
      onMouseDown={handleMouseDown}
    >
      {direction === "vertical" ? (
        <div className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize ${isResizing ? "bg-primary" : "bg-border hover:bg-muted"}`} />
      ) : (
        <div className={`absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize ${isResizing ? "bg-primary" : "bg-border hover:bg-muted"}`} />
      )}
    </div>
  );
}