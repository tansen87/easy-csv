import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import {
  ThemeProvider,
  useTheme,
} from "@/components/setting/ThemeProvider";

/**
 * The two-axis theme contract (design 034 §2.1): `class` is the appearance,
 * `data-accent` is the accent, and neither is stored under the other's key.
 */

function Probe() {
  const { theme, setTheme, accent, setAccent, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="accent">{accent}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setAccent("teal")}>teal</button>
    </div>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  delete document.documentElement.dataset.accent;
});

describe("ThemeProvider — appearance + accent (design 034)", () => {
  it("defaults to system appearance and the ink accent", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("accent").textContent).toBe("ink");
    expect(document.documentElement.dataset.accent).toBe("ink");
  });

  it("persists the accent and writes it to `data-accent`", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText("teal").click();
    });

    expect(window.localStorage.getItem("easy-csv-accent")).toBe("teal");
    expect(document.documentElement.dataset.accent).toBe("teal");
  });

  it("falls back to ink when the stored accent is not a preset", () => {
    window.localStorage.setItem("easy-csv-accent", "magenta");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("accent").textContent).toBe("ink");
    expect(document.documentElement.dataset.accent).toBe("ink");
  });

  it("applies the light/dark class and colorScheme", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    act(() => {
      screen.getByText("dark").click();
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("follows live system appearance changes while in system mode", () => {
    let onChange: ((event: MediaQueryListEvent) => void) | null = null;
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_: string, cb: (event: MediaQueryListEvent) => void) => {
        onChange = cb;
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);

    render(
      <ThemeProvider defaultTheme="system">
        <Probe />
      </ThemeProvider>,
    );

    expect(document.documentElement.classList.contains("light")).toBe(true);

    act(() => {
      onChange?.({ matches: true } as unknown as MediaQueryListEvent);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });
});
