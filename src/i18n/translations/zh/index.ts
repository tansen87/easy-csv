import type { Translations } from "@/i18n/translations/types";
import { zhCommon } from "@/i18n/translations/zh/common";
import { zhPipeline } from "@/i18n/translations/zh/pipeline";
import { zhCanvas } from "@/i18n/translations/zh/canvas";
import { zhDialog } from "@/i18n/translations/zh/dialog";
import { zhAi } from "@/i18n/translations/zh/ai";
import { zhSettings } from "@/i18n/translations/zh/settings";
import { zhHelp } from "@/i18n/translations/zh/help";
import { zhUpdate } from "@/i18n/translations/zh/update";
import { zhPlugins } from "@/i18n/translations/zh/plugins";
import { zhOnboarding } from "@/i18n/translations/zh/onboarding";

/**
 * Every zh string, merged back into one flat object.
 *
 * Typed as `Translations`, so a key missing from any section is a compile
 * error. Keys are unique by construction — the split was generated from the
 * original single object and verified for duplicates.
 */
export const zh: Translations = {
  ...zhCommon,
  ...zhPipeline,
  ...zhCanvas,
  ...zhDialog,
  ...zhAi,
  ...zhSettings,
  ...zhHelp,
  ...zhUpdate,
  ...zhPlugins,
  ...zhOnboarding,
};
