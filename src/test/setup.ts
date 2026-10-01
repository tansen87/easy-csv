import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import * as React from "react";

/**
 * Fail loudly when React resolved to its production build.
 *
 * `@testing-library/react` calls `React.act`, which only exists in React's
 * development build. A shell exporting `NODE_ENV=production` otherwise makes
 * every render-based suite die with the opaque
 * `React.act is not a function`, obscuring the real cause. `vitest.config.ts`
 * pins `NODE_ENV=test`; this guard turns a regression of that pin into one
 * actionable message instead of hundreds of identical failures.
 */
if (typeof (React as { act?: unknown }).act !== "function") {
  throw new Error(
    "React resolved to its production build, so `React.act` is unavailable " +
      "(every @testing-library/react render would fail). Expected NODE_ENV=test " +
      "from vitest.config.ts's `test.env`. Re-run with `NODE_ENV=test pnpm test` " +
      "if this fires; also check for a shell/profile that exports NODE_ENV=production.",
  );
}

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/plugin-dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Mock @tauri-apps/plugin-fs
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// scrollIntoView is not implemented in jsdom
Element.prototype.scrollIntoView = vi.fn();

/**
 * jsdom has no ResizeObserver, which several components (chart panel, panels
 * with dock sizing) construct on mount. Recharts' `ResponsiveContainer` also
 * measures its container this way, so the stub reports a fixed size — otherwise
 * a percentage-sized chart would measure 0×0 and render nothing.
 */
if (!("ResizeObserver" in globalThis)) {
  const SIZE = { width: 600, height: 400 };
  class ResizeObserverStub {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      const entry = {
        target,
        contentRect: {
          ...SIZE,
          x: 0, y: 0, top: 0, left: 0, right: SIZE.width, bottom: SIZE.height,
          toJSON: () => SIZE,
        },
      } as unknown as ResizeObserverEntry;
      // Synchronous: recharts reads the size from state during the same act
      // window, and an async callback would leave the chart unrendered when the
      // test asserts right after `render()`.
      this.cb([entry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: ResizeObserverStub,
  });
}
