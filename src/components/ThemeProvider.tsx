import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export const ThemeProvider: React.FC<ThemeProviderProps> = React.memo(
  ({
    children,
    defaultTheme = "system",
    storageKey = "vite-ui-theme",
    ...props
  }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        return (stored as Theme) || defaultTheme;
      } catch {
        return defaultTheme;
      }
    });

    useEffect(() => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
        return;
      }

      root.classList.add(theme);
    }, [theme]);

    const setTheme = useCallback(
      (newTheme: Theme) => {
        try {
          localStorage.setItem(storageKey, newTheme);
        } catch {
          // localStorage might be disabled
        }
        setThemeState(newTheme);
      },
      [storageKey]
    );

    const value = useMemo(
      () => ({
        theme,
        setTheme,
      }),
      [theme, setTheme]
    );

    return (
      <ThemeProviderContext.Provider {...props} value={value}>
        {children}
      </ThemeProviderContext.Provider>
    );
  }
);

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
