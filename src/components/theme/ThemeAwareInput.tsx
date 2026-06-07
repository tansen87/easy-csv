import React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Input } from "animal-island-ui";
import type { InputProps } from "animal-island-ui";

interface ThemeAwareInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  className?: string;
  size?: InputProps['size'];
}

export function ThemeAwareInput({
  className = "",
  size = "small",
  ...props
}: ThemeAwareInputProps) {
  const { theme } = useTheme();

  if (theme === "animal-island") {
    return (
      <Input
        {...props}
        size={size}
        className={className}
        shadow={true}
      />
    );
  }

  return (
    <input
      {...props}
      className={`w-full h-10 px-3 text-sm border rounded-md bg-background ${className}`}
    />
  );
}