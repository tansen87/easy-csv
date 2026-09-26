import type { Translations } from "../types";
import { enCommon } from "./common";
import { enPipeline } from "./pipeline";
import { enCanvas } from "./canvas";
import { enDialog } from "./dialog";
import { enAi } from "./ai";
import { enSettings } from "./settings";
import { enHelp } from "./help";
import { enUpdate } from "./update";

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
};
