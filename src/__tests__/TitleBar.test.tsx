import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";

/**
 * Custom title bar (design 043).
 *
 * The bar itself is the menu row; these tests only cover the pieces that talk
 * to the window: the brand's drag region and the three caption buttons.
 */

const { win } = vi.hoisted(() => ({
  win: {
    minimize: vi.fn(async () => {}),
    toggleMaximize: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    isMaximized: vi.fn(async () => false),
    onResized: vi.fn(async (_cb: () => void) => () => {}),
    onFocusChanged: vi.fn(async (_cb: (event: { payload: boolean }) => void) => () => {}),
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => win,
}));

import { TitleBarBrand, WindowControls } from "@/components/titlebar/TitleBar";

function renderControls() {
  return render(
    <LanguageProvider>
      <WindowControls />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("easy-csv-language", "zh");
  win.minimize.mockClear();
  win.toggleMaximize.mockClear();
  win.close.mockClear();
  win.isMaximized.mockReset();
  win.isMaximized.mockResolvedValue(false);
  win.onResized.mockClear();
  win.onResized.mockImplementation(async () => () => {});
  win.onFocusChanged.mockClear();
  win.onFocusChanged.mockImplementation(async () => () => {});
});

afterEach(() => {
  localStorage.clear();
  delete document.body.dataset.windowActive;
});

describe("custom title bar (design 043)", () => {
  it("exposes the app name as a deep drag region", () => {
    render(
      <LanguageProvider>
        <TitleBarBrand />
      </LanguageProvider>,
    );

    const brand = screen.getByText("Easy Csv").parentElement;
    expect(brand).toHaveAttribute("data-tauri-drag-region", "deep");
  });

  it("wires the three caption buttons to the window API", () => {
    renderControls();

    fireEvent.click(screen.getByRole("button", { name: "最小化" }));
    expect(win.minimize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "最大化" }));
    expect(win.toggleMaximize).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it("swaps maximize for restore once the window reports it is maximized", async () => {
    let onResized: (() => void) | undefined;
    win.onResized.mockImplementation(async (cb: () => void) => {
      onResized = cb;
      return () => {};
    });
    win.isMaximized.mockResolvedValueOnce(false).mockResolvedValue(true);

    renderControls();
    expect(await screen.findByRole("button", { name: "最大化" })).toBeInTheDocument();

    await act(async () => {
      onResized?.();
    });

    expect(await screen.findByRole("button", { name: "还原" })).toBeInTheDocument();
  });

  it("dims the bar while the window is inactive", async () => {
    let onFocusChanged: ((event: { payload: boolean }) => void) | undefined;
    win.onFocusChanged.mockImplementation(
      async (cb: (event: { payload: boolean }) => void) => {
        onFocusChanged = cb;
        return () => {};
      },
    );

    const { unmount } = renderControls();

    await act(async () => {
      onFocusChanged?.({ payload: false });
    });
    expect(document.body.dataset.windowActive).toBe("false");

    unmount();
    expect(document.body.dataset.windowActive).toBeUndefined();
  });
});
