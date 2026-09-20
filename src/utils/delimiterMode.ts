import type { DelimiterMode } from "@/types/xan";

/**
 * The delimiter state lives in two settings (`autoDetectDelimiter` +
 * `defaultDelimiter`) but is presented — and edited — as a single value by both
 * the settings page and the workflow's input node badge (design 018 §3.9).
 *
 * These two helpers are the only translation between the two shapes, so the two
 * controls cannot drift apart:
 * - `delimiterModeFromSettings` renders the settings as the value shown in the UI.
 * - `settingsPatchForMode` turns a UI edit back into the settings to persist.
 */

/** `"auto"` when detection is on, otherwise the delimiter that will be used. */
export function delimiterModeFromSettings(
  autoDetectDelimiter: boolean,
  defaultDelimiter: string,
): DelimiterMode {
  return autoDetectDelimiter ? "auto" : defaultDelimiter || ",";
}

/**
 * Settings to apply for a picked mode. `delimiter` is absent when the mode is
 * `"auto"` — detection being on makes the concrete value irrelevant, so it is
 * kept as the fallback for the next time detection fails.
 */
export function settingsPatchForMode(mode: DelimiterMode): {
  autoDetectDelimiter: boolean;
  delimiter?: string;
} {
  return mode === "auto"
    ? { autoDetectDelimiter: true }
    : { autoDetectDelimiter: false, delimiter: mode };
}
