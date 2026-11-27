import { describe, it, expect } from "vitest";

import {
  DEFAULT_SHORTCUTS,
  comboFromEvent,
  comboMatches,
  comboTokens,
  conflictingAction,
  isModifierOnly,
  isUsableCombo,
  mergeShortcuts,
  shortcutsDiffer,
} from "@/lib/shortcuts";

const press = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", { key, ...init });

describe("shortcut registry (design 083)", () => {
  it("records Ctrl/⌘ as Mod and keeps the key upper case", () => {
    expect(comboFromEvent(press("s", { ctrlKey: true }))).toBe("Mod+S");
    expect(comboFromEvent(press("Z", { metaKey: true, shiftKey: true }))).toBe(
      "Mod+Shift+Z",
    );
    expect(comboFromEvent(press("q", { altKey: true }))).toBe("Alt+Q");
  });

  it("ignores a bare modifier so the recorder can wait for the real key", () => {
    expect(isModifierOnly(press("Shift", { shiftKey: true }))).toBe(true);
    expect(comboFromEvent(press("Shift", { shiftKey: true }))).toBeNull();
  });

  it("rejects bindings that would fire while typing, accepts function keys", () => {
    expect(isUsableCombo("O")).toBe(false);
    expect(isUsableCombo("Shift+O")).toBe(false);
    expect(isUsableCombo("Mod+O")).toBe(true);
    expect(isUsableCombo("Alt+Q")).toBe(true);
    expect(isUsableCombo("F5")).toBe(true);
  });

  it("matches only when the modifier set is exact", () => {
    expect(comboMatches(press("s", { ctrlKey: true }), "Mod+S")).toBe(true);
    expect(comboMatches(press("s", { metaKey: true }), "Mod+S")).toBe(true);
    expect(comboMatches(press("S", { ctrlKey: true }), "Mod+S")).toBe(true);
    expect(
      comboMatches(press("s", { ctrlKey: true, shiftKey: true }), "Mod+S"),
    ).toBe(false);
    expect(comboMatches(press("s"), "Mod+S")).toBe(false);
    expect(comboMatches(press("q", { altKey: true }), "Alt+Q")).toBe(true);
  });

  it("renders tokens with the platform modifier and readable key names", () => {
    const tokens = comboTokens("Mod+ArrowUp");
    expect(tokens[0]).toMatch(/^(Ctrl|⌘)$/);
    expect(tokens[1]).toBe("↑");
  });

  it("merges a stored blob over the defaults and drops unknown ids", () => {
    const merged = mergeShortcuts({
      savePipeline: "Mod+Shift+S",
      notAnAction: "Mod+X",
      broken: 42,
    });
    expect(merged.savePipeline).toBe("Mod+Shift+S");
    expect(merged.openFile).toBe(DEFAULT_SHORTCUTS.openFile);
    expect("notAnAction" in merged).toBe(false);
    expect(mergeShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
  });

  it("names the action already holding a combo", () => {
    // `redo` gives its default away, so the exclusion below has one owner only.
    const map = { ...DEFAULT_SHORTCUTS, execute: "Mod+Y", redo: "Mod+9" };
    expect(conflictingAction("Mod+Y", map, "redo")).toBe("execute");
    expect(conflictingAction("Mod+Y", map, "execute")).toBeNull();
    expect(conflictingAction("Mod+8", map, "redo")).toBeNull();
  });

  it("reports whether anything differs from the defaults", () => {
    expect(shortcutsDiffer(DEFAULT_SHORTCUTS)).toBe(false);
    expect(shortcutsDiffer({ ...DEFAULT_SHORTCUTS, undo: "Mod+U" })).toBe(true);
  });
});
