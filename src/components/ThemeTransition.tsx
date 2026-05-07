import React, { useEffect, useState, useRef } from "react";

interface ThemeTransitionProps {
  isActive: boolean;
  x: number;
  y: number;
  theme: "dark" | "light" | "system";
}

export const ThemeTransition: React.FC<ThemeTransitionProps> = React.memo(
  ({ isActive, x, y, theme }) => {
    const [style, setStyle] = useState<React.CSSProperties>({});
    const animationRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
      if (isActive) {
        const targetTheme = theme === "dark" ? "light" : "dark";
        const bgColor =
          targetTheme === "light" ? "hsl(210 40% 98%)" : "hsl(222.2 84% 4.9%)";
        
        setStyle({
          background: bgColor,
          clipPath: `circle(0% at ${x}px ${y}px)`,
          opacity: 0.95,
          willChange: "clip-path, opacity",
        });

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (animationRef.current) {
              animationRef.current.style.clipPath = `circle(150% at ${x}px ${y}px)`;
              animationRef.current.style.transition = "clip-path 0.6s ease-out, opacity 0.6s ease-out";
            }
          });
        });
      }

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, [isActive, x, y, theme]);

    if (!isActive) return null;

    return (
      <div
        ref={animationRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={style}
      />
    );
  }
);

export default ThemeTransition;
