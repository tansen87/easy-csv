import { useEffect, useState, type RefObject } from "react";
import {
  getCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";

import { usesCustomTitleBar } from "@/lib/platform";
import { useLanguage } from "@/i18n";

/**
 * Custom window chrome.
 *
 * The menu row doubles as the title bar, so the app name sits before 文件 and
 * the caption buttons sit after the settings icon. Dragging is handled by
 * `data-tauri-drag-region="deep"` — Tauri's own script also turns a double
 * click on that region into maximize/restore, so no extra handler is needed.
 */

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1,
  shapeRendering: "crispEdges",
} as const;

function IconMinimize() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...strokeProps}>
      <path d="M0 5.5h10" />
    </svg>
  );
}

function IconMaximize() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...strokeProps}>
      <rect x="0.5" y="0.5" width="9" height="9" />
    </svg>
  );
}

function IconRestore() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...strokeProps}>
      <path d="M2.5 2.5V0.5h7v7h-2" />
      <rect x="0.5" y="2.5" width="7" height="7" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" {...strokeProps}>
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </svg>
  );
}

/** The window API throws outside Tauri (tests, plain browser preview). */
function withWindow(action: (win: TauriWindow) => Promise<unknown>) {
  try {
    void action(getCurrentWindow()).catch((error: unknown) => {
      // A denied capability shows up here and nowhere else — the ACL rejects
      // the IPC silently otherwise, which looks like a dead button.
      console.warn("[titlebar]", error);
    });
  } catch {
    /* not running inside the Tauri webview */
  }
}

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  '[role="button"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[contenteditable="true"]',
].join(", ");

/**
 * Double-clicking the title bar toggles maximise.
 *
 * Tauri's own handler keys off `mousedown.detail === 2`, but the first press
 * of a double click already sends the window into a system drag loop, so the
 * second press arrives with `detail === 1` and nothing happens. Detect the
 * second press by timestamp instead — and do it in the capture phase, so
 * `stopPropagation` keeps Tauri's `start_dragging` from claiming it.
 */
export function useTitleBarDoubleClick(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const bar = ref.current;
    // Native chrome on macOS/Linux keeps its own title bar behaviour.
    if (!bar || !usesCustomTitleBar) return;

    let lastPress = 0;
    const onPress = (event: globalThis.MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (!target || !bar.contains(target)) return;
      // Buttons and menu items own their clicks.
      if (target.closest(INTERACTIVE_SELECTOR)) return;

      const now = performance.now();
      if (now - lastPress < 450) {
        lastPress = 0;
        event.stopPropagation();
        event.preventDefault();
        withWindow((win) => win.toggleMaximize());
        return;
      }
      lastPress = now;
    };

    bar.addEventListener("mousedown", onPress, true);
    return () => bar.removeEventListener("mousedown", onPress, true);
  }, [ref]);
}

export function TitleBarBrand() {
  return (
    <div
      className="titlebar-brand flex flex-none items-center pr-1"
      data-tauri-drag-region="deep"
    >
      <span className="text-[12.5px] leading-4 font-medium text-foreground">
        Easy Csv
      </span>
    </div>
  );
}

export function WindowControls() {
  const { t } = useLanguage();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let win: TauriWindow | null = null;
    try {
      win = getCurrentWindow();
    } catch {
      return;
    }

    let alive = true;
    const unlisteners: Array<() => void> = [];

    const syncMaximized = () => {
      void win
        ?.isMaximized()
        .then((value) => {
          if (!alive) return;
          setMaximized(value);
          // Rounded corners only while the window is restored (index.css).
          document.documentElement.dataset.windowMaximized = String(value);
        })
        .catch(() => {});
    };

    syncMaximized();
    void win
      .onResized(syncMaximized)
      .then((unlisten) => {
        if (alive) unlisteners.push(unlisten);
        else unlisten();
      })
      .catch(() => {});

    void win
      .onFocusChanged(({ payload }) => {
        // Windows dims the whole title bar of an inactive window.
        document.body.dataset.windowActive = String(payload);
      })
      .then((unlisten) => {
        if (alive) unlisteners.push(unlisten);
        else unlisten();
      })
      .catch(() => {});

    return () => {
      alive = false;
      unlisteners.forEach((unlisten) => unlisten());
      delete document.body.dataset.windowActive;
      delete document.documentElement.dataset.windowMaximized;
    };
  }, []);

  return (
    <div className="ml-3 flex flex-none items-stretch self-stretch">
      <button
        type="button"
        aria-label={t.titlebarMinimize}
        className="titlebar-btn"
        onClick={() => withWindow((win) => win.minimize())}
      >
        <IconMinimize />
      </button>
      <button
        type="button"
        aria-label={maximized ? t.titlebarRestore : t.titlebarMaximize}
        className="titlebar-btn"
        onClick={() => withWindow((win) => win.toggleMaximize())}
      >
        {maximized ? <IconRestore /> : <IconMaximize />}
      </button>
      <button
        type="button"
        aria-label={t.titlebarClose}
        className="titlebar-btn titlebar-btn--close"
        onClick={() => withWindow((win) => win.close())}
      >
        <IconClose />
      </button>
    </div>
  );
}
