/**
 * Where the app draws its own window chrome (design 043).
 *
 * Windows only: the 48px menu row doubles as the title bar — `main.rs` drops
 * the native frame in `setup` before revealing the window. macOS keeps its
 * traffic lights and Linux keeps the window manager frame (an undecorated GTK
 * window loses the resize/move affordances users expect there).
 */
export const usesCustomTitleBar =
  typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
