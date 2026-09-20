import type { Translations } from "../types";
import { zhCommon } from "./common";
import { zhPipeline } from "./pipeline";
import { zhCanvas } from "./canvas";
import { zhDialog } from "./dialog";
import { zhAi } from "./ai";
import { zhSettings } from "./settings";
import { zhHelp } from "./help";

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
};
