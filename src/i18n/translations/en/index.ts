import type { Translations } from "@/i18n/translations/types";
import { enCommon } from "@/i18n/translations/en/common";
import { enPipeline } from "@/i18n/translations/en/pipeline";
import { enCanvas } from "@/i18n/translations/en/canvas";
import { enDialog } from "@/i18n/translations/en/dialog";
import { enAi } from "@/i18n/translations/en/ai";
import { enSettings } from "@/i18n/translations/en/settings";
import { enHelp } from "@/i18n/translations/en/help";
import { enUpdate } from "@/i18n/translations/en/update";
import { enPlugins } from "@/i18n/translations/en/plugins";
import { enOnboarding } from "@/i18n/translations/en/onboarding";

/**
 * Every en string, merged back into one flat object.
 *
 * Typed as `Translations`, so a key missing from any section is a compile
 * error. Keys are unique by construction — the split was generated from the
 * original single object and verified for duplicates.
 */
export const en: Translations = {
  ...enCommon,
  ...enPipeline,
  ...enCanvas,
  ...enDialog,
  ...enAi,
  ...enSettings,
  ...enHelp,
  ...enUpdate,
  ...enPlugins,
  ...enOnboarding,
};
