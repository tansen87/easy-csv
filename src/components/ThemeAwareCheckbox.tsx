import React from "react";
import { useTheme } from "@/components/ThemeProvider";

interface ThemeAwareCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
}

export function ThemeAwareCheckbox({
  checked,
  onChange,
  children,
  className = "",
}: ThemeAwareCheckboxProps) {
  const { theme } = useTheme();
  
  // 如果是 animal-island 主题，使用原生 checkbox 但添加特定的样式类
  if (theme === "animal-island") {
    return (
      <label className={`flex items-center gap-2 text-sm cursor-pointer ${className}`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="animal-checkbox"
        />
        {children}
      </label>
    );
  }
  
  // 否则使用原生 checkbox
  return (
    <label className={`flex items-center gap-2 text-sm cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {children}
    </label>
  );
}