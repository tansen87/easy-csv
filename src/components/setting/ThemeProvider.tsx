import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

export type Theme = "dark" | "light" | "system";
export type Accent = "ink" | "teal" | "clay" | "graphite";
export type ResolvedTheme = "dark" | "light";

/** Presets understood by the token sheet in `index.css` (design 034). */
export const ACCENTS: readonly Accent[] = ["ink", "teal", "clay", "graphite"];

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultAccent?: Accent;
  storageKey?: string;
  accentStorageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  /** Appearance after resolving `system`, so consumers don't re-read matchMedia. */
  resolvedTheme: ResolvedTheme;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  accent: "ink",
  setAccent: () => null,
  resolvedTheme: "light",
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const isTheme = (value: unknown): value is Theme =>
  value === "dark" || value === "light" || value === "system";

const isAccent = (value: unknown): value is Accent =>
  typeof value === "string" && (ACCENTS as readonly string[]).includes(value);

export const ThemeProvider: React.FC<ThemeProviderProps> = React.memo(
  ({
    children,
    defaultTheme = "system",
    defaultAccent = "ink",
    storageKey = "vite-ui-theme",
    accentStorageKey = "easy-csv-accent",
    ...props
  }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
      try {
        const stored = localStorage.getItem(storageKey);
        return isTheme(stored) ? stored : defaultTheme;
      } catch {
        return defaultTheme;
      }
    });

    const [accent, setAccentState] = useState<Accent>(() => {
      try {
        const stored = localStorage.getItem(accentStorageKey);
        return isAccent(stored) ? stored : defaultAccent;
      } catch {
        return defaultAccent;
      }
    });

    // `system` needs the live value: without a listener, switching the OS
    // appearance would only apply on the next reload.
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => {
      if (typeof window === "undefined") return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    });

    useEffect(() => {
      const query = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = (event: MediaQueryListEvent) => {
        setSystemTheme(event.matches ? "dark" : "light");
      };
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }, []);

    const resolvedTheme: ResolvedTheme =
      theme === "system" ? systemTheme : theme;

    useEffect(() => {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
      root.style.colorScheme = resolvedTheme;
    }, [resolvedTheme]);

    useEffect(() => {
      window.document.documentElement.dataset.accent = accent;
    }, [accent]);

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

    const setAccent = useCallback(
      (newAccent: Accent) => {
        try {
          localStorage.setItem(accentStorageKey, newAccent);
        } catch {
          // localStorage might be disabled
        }
        setAccentState(newAccent);
      },
      [accentStorageKey]
    );

    const value = useMemo(
      () => ({
        theme,
        setTheme,
        accent,
        setAccent,
        resolvedTheme,
      }),
      [theme, setTheme, accent, setAccent, resolvedTheme]
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
