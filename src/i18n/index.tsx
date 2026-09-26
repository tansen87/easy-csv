import { createContext, useContext, useState, type ReactNode } from "react";
import {
  translations,
  type Language,
  type EffectiveLanguage,
  type Translations,
} from "./translations";

interface LanguageContextType {
  language: Language;
  effectiveLanguage: EffectiveLanguage;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "easy-csv-language";

export function resolveSystemLanguage(): EffectiveLanguage {
  const raw = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return raw.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh" || saved === "system") return saved;
  } catch {
    /* ignore: fall back to the default when storage is unavailable */
  }
  return "system";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const effectiveLanguage: EffectiveLanguage =
    language === "system" ? resolveSystemLanguage() : language;

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore: persistence is best-effort */
    }
  };

  const t = translations[effectiveLanguage];

  return (
    <LanguageContext.Provider
      value={{ language, effectiveLanguage, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
