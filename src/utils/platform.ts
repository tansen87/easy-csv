/**
 * Platform helpers for small platform-conditional behaviors.
 *
 * Detection is based on `navigator.userAgent`, which works reliably across the
 * webview runtimes used by Tauri on Windows / macOS / Linux without needing an
 * async call to `@tauri-apps/plugin-os`.
 */

export type Platform = "windows" | "macos" | "linux" | "other";

export function getPlatform(): Platform {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform =
    typeof navigator !== "undefined" ? (navigator.platform ?? "") : "";
  if (/Windows/i.test(ua) || /Win/i.test(platform)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platform)) return "macos";
  if (/Linux/i.test(ua) || /Linux/i.test(platform)) return "linux";
  return "other";
}

export function isWindows(): boolean {
  return getPlatform() === "windows";
}

export function isMacOS(): boolean {
  return getPlatform() === "macos";
}

/**
 * The modifier key symbol used for displaying shortcuts: ⌘ on macOS, Ctrl
 * elsewhere. Rendering mirrors the actual binding in `useKeyboardShortcuts`
 * (which already accepts both `ctrlKey` and `metaKey`).
 */
export function modKeySymbol(): string {
  return isMacOS() ? "⌘" : "Ctrl";
}
