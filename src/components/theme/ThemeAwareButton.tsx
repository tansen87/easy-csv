import * as React from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Button as AnimalButton } from "animal-island-ui";
import type { ButtonProps as AnimalButtonProps } from "animal-island-ui";

interface ThemeAwareButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  className?: string;
  type?: AnimalButtonProps["type"];
  size?: AnimalButtonProps["size"];
  danger?: boolean;
  ghost?: boolean;
  block?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function ThemeAwareButton({
  className = "",
  type = "primary",
  size = "small",
  danger,
  ghost,
  block,
  loading,
  icon,
  children,
  ...props
}: ThemeAwareButtonProps) {
  const { theme } = useTheme();

  if (theme === "animal-island") {
    return (
      <AnimalButton
        type={type}
        size={size}
        danger={danger}
        ghost={ghost}
        block={block}
        loading={loading}
        icon={icon}
        className={className}
        {...props}
      >
        {children}
      </AnimalButton>
    );
  }

  return (
    <button
      className={`rounded-md text-sm bg-muted transition-colors ${className}`}
      {...props}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
}
