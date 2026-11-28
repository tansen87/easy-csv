import { modKeySymbol } from "@/utils/platform";

/**
 * Design 083: one registry for every rebindable app shortcut.
 *
 * A combo is stored as a platform-neutral string such as `Mod+S` or `Alt+Q`,
 * where `Mod` means Ctrl on Windows/Linux and ⌘ on macOS. Letters are upper
 * case; the last segment is the key itself (`O`, `F`, `ArrowUp`, `F5`).
 */
export type ShortcutActionId =
  | "openFile"
  | "openNewTab"
  | "savePipeline"
  | "importPipeline"
  | "exportPipeline"
  | "undo"
  | "redo"
  | "execute"
  | "openTemplates"
  | "toggleLogs"
  | "toggleResults"
  | "toggleAI"
  | "commandPalette";

/** Order here is the order in the settings section. */
export const SHORTCUT_ACTION_IDS: ShortcutActionId[] = [
  "openFile",
  "openNewTab",
  "savePipeline",
  "importPipeline",
  "exportPipeline",
  "undo",
  "redo",
  "execute",
  "openTemplates",
  "commandPalette",
  "toggleLogs",
  "toggleResults",
  "toggleAI",
];

export type ShortcutMap = Record<ShortcutActionId, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  openFile: "Mod+O",
  openNewTab: "Mod+N",
  savePipeline: "Mod+S",
  importPipeline: "Mod+I",
  exportPipeline: "Mod+E",
  undo: "Mod+Z",
  redo: "Mod+Y",
  execute: "Mod+R",
  openTemplates: "Mod+T",
  commandPalette: "Mod+F",
  toggleLogs: "Alt+Q",
  toggleResults: "Alt+R",
  toggleAI: "Alt+A",
};

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

/** Readable labels for keys whose `event.key` is a code rather than a glyph. */
const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Del",
  Tab: "Tab",
};

export function isModifierOnly(event: KeyboardEvent): boolean {
  return MODIFIER_KEYS.has(event.key);
}

/**
 * Build a combo from a keydown, without judging whether it is usable.
 * Modifier-only presses return `null` (the recorder must ignore them).
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  if (isModifierOnly(event)) return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  parts.push(key);
  return parts.join("+");
}

/**
 * A binding must not be a bare letter: typing would trigger it everywhere the
 * canvas has focus. Ctrl/⌘/Alt (and function keys on their own) are accepted.
 */
export function isUsableCombo(combo: string): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  if (/^F\d{1,2}$/.test(key)) return true;
  return parts.includes("Mod") || parts.includes("Alt");
}

/** Does this keydown match the stored combo? */
export function comboMatches(event: KeyboardEvent, combo: string): boolean {
  const parts = combo.split("+");
  const key = parts[parts.length - 1];
  const hasMod = event.ctrlKey || event.metaKey;
  if (parts.includes("Mod") !== hasMod) return false;
  if (parts.includes("Alt") !== event.altKey) return false;
  if (parts.includes("Shift") !== event.shiftKey) return false;
  return event.key.toLowerCase() === key.toLowerCase();
}

/** `Mod+O` → `["Ctrl", "O"]` (or `["⌘", "O"]`). */
export function comboTokens(combo: string): string[] {
  return combo
    .split("+")
    .map((part) =>
      part === "Mod" ? modKeySymbol() : (KEY_LABELS[part] ?? part),
    );
}

/**
 * Merge a persisted blob over the defaults: unknown ids are dropped, missing
 * ids fall back, and a value that is not a string is ignored.
 */
export function mergeShortcuts(raw: unknown): ShortcutMap {
  const merged: ShortcutMap = { ...DEFAULT_SHORTCUTS };
  if (!raw || typeof raw !== "object") return merged;
  const source = raw as Record<string, unknown>;
  for (const id of SHORTCUT_ACTION_IDS) {
    const value = source[id];
    if (typeof value === "string" && value.length > 0) merged[id] = value;
  }
  return merged;
}

/** The other action already using `combo`, if any. */
export function conflictingAction(
  combo: string,
  map: ShortcutMap,
  exclude: ShortcutActionId,
): ShortcutActionId | null {
  const hit = SHORTCUT_ACTION_IDS.find(
    (id) => id !== exclude && map[id] === combo,
  );
  return hit ?? null;
}

/** True when at least one action differs from its default. */
export function shortcutsDiffer(map: ShortcutMap): boolean {
  return SHORTCUT_ACTION_IDS.some((id) => map[id] !== DEFAULT_SHORTCUTS[id]);
}
