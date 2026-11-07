import { useEffect, useState } from "react";
import {
  getCurrentWindow,
  type Window as TauriWindow,
} from "@tauri-apps/api/window";

import { useLanguage } from "@/i18n";

/**
 * Custom window chrome (design 043).
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

/**
 * Keeps the OS window title in sync with the active file. With the custom
 * chrome there is no native title bar left to show it, so the taskbar and
 * alt-tab are the only places it survives.
 */
export function setWindowTitle(title: string) {
  withWindow((win) => win.setTitle(title));
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
