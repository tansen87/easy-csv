import { describe, it, expect } from "vitest";
import {
  delimiterModeFromSettings,
  settingsPatchForMode,
} from "@/utils/delimiterMode";

// Design 018 §3.9: the settings page and the input node badge edit the same
// state, and these two helpers are the only translation between the settings
// shape (autoDetectDelimiter + defaultDelimiter) and the single UI value.
describe("delimiterModeFromSettings", () => {
  it("reports auto-detection while the switch is on", () => {
    expect(delimiterModeFromSettings(true, ",")).toBe("auto");
    // The concrete delimiter stays relevant as the fallback, but is not shown.
    expect(delimiterModeFromSettings(true, ";")).toBe("auto");
  });

  it("reports the concrete delimiter once detection is off", () => {
    expect(delimiterModeFromSettings(false, ";")).toBe(";");
    expect(delimiterModeFromSettings(false, "\t")).toBe("\t");
  });

  it("falls back to a comma when no delimiter was ever stored", () => {
    expect(delimiterModeFromSettings(false, "")).toBe(",");
  });
});

describe("settingsPatchForMode", () => {
  it('only turns detection on for "auto" (keeping the stored delimiter)', () => {
    expect(settingsPatchForMode("auto")).toEqual({ autoDetectDelimiter: true });
  });

  it("locks a concrete delimiter and turns detection off", () => {
    expect(settingsPatchForMode("|")).toEqual({
      autoDetectDelimiter: false,
      delimiter: "|",
    });
    expect(settingsPatchForMode("\t")).toEqual({
      autoDetectDelimiter: false,
      delimiter: "\t",
    });
  });

  it("round-trips through the settings shape", () => {
    for (const mode of ["auto", ",", ";", "\t", "|", "^"]) {
      const patch = settingsPatchForMode(mode);
      // Applying the patch makes the control render the picked value again.
      expect(
        delimiterModeFromSettings(
          patch.autoDetectDelimiter,
          patch.delimiter ?? ",",
        ),
      ).toBe(mode === "auto" ? "auto" : mode);
    }

    // A locked mode survives a later re-read of the mode.
    const locked = settingsPatchForMode(";");
    expect(
      delimiterModeFromSettings(
        locked.autoDetectDelimiter,
        locked.delimiter ?? ",",
      ),
    ).toBe(";");
  });
});
