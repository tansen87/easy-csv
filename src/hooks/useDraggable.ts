import { useState, useRef, useEffect, useCallback } from "react";

interface DraggableOptions {
  initialX: number;
  initialY: number;
  maxWidth?: number;
  maxHeight?: number;
  maxX?: number;
  maxY?: number;
}

export function useDraggable({
  initialX,
  initialY,
  maxWidth = 300,
  maxHeight = 400,
  maxX,
  maxY,
}: DraggableOptions) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });
  const positionRef = useRef(position);
  const isDraggingRef = useRef(isDragging);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;

    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: positionRef.current.x,
      startPosY: positionRef.current.y,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - dragRef.current.startX;
      const deltaY = e.clientY - dragRef.current.startY;

      const effectiveMaxX =
        maxX !== undefined ? maxX : window.innerWidth - maxWidth;
      const effectiveMaxY =
        maxY !== undefined ? maxY : window.innerHeight - maxHeight;

      setPosition({
        x: Math.max(
          0,
          Math.min(dragRef.current.startPosX + deltaX, effectiveMaxX),
        ),
        y: Math.max(
          0,
          Math.min(dragRef.current.startPosY + deltaY, effectiveMaxY),
        ),
      });
    },
    [maxWidth, maxHeight, maxX, maxY],
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return { position, isDragging, handleMouseDown };
}
