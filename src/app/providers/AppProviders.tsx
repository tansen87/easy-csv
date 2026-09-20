import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/setting/ThemeProvider";
import { LanguageProvider } from "@/i18n";

/**
 * App-level provider composition (019 §2 app/providers).
 * Kept in one place so the entry file stays a one-liner.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <LanguageProvider>{children}</LanguageProvider>
    </ThemeProvider>
  );
}
