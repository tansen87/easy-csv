import React from "react";

interface ThemeTransitionProps {
  isActive: boolean;
  theme: "dark" | "light";
}

export const ThemeTransition: React.FC<ThemeTransitionProps> = React.memo(
  ({ isActive, theme }) => {
    if (!isActive) return null;

    const bgColor =
      theme === "light" ? "hsl(210 40% 98%)" : "hsl(222.2 84% 4.9%)";

    return (
      <div
        className="fixed inset-0 pointer-events-none z-50"
        style={{ background: bgColor, opacity: 0.95 }}
      />
    );
  }
);

export default ThemeTransition;
