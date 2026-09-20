import type { EffectiveLanguage, Translations } from "./types";
import { en } from "./en";
import { zh } from "./zh";

export type { Language, EffectiveLanguage, Translations } from "./types";

export const translations: Record<EffectiveLanguage, Translations> = {
  en,
  zh,
};
