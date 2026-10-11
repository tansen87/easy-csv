import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { ThemeProvider } from "@/components/setting/ThemeProvider";
import { SettingsDialog } from "@/components/setting/SettingsDialog";
import {
  SETTINGS_GROUPS,
  sectionElementId,
} from "@/components/setting/settingsSections";
import type { DelimiterMode } from "@/types/xan";

/**
 * The settings dialog as a whole (design 030). Three things are worth pinning:
 *
 * 1. the two **contracts** — every row in `settingsSections` is rendered, and
 *    the directory lists exactly the groups the content renders;
 * 2. search — filtering by title *and* by a `keywords` alias, plus the empty
 *    state;
 * 3. the relocated footer (reset / save) and the keyboard shortcuts.
 */

// The plugin group subscribes to download progress on mount; nothing here needs
// the events. Its catalogue comes from the globally mocked `invoke`, which
// resolves to `undefined`, so it renders an empty catalogue — enough for the
// structure contracts below. Its own behaviour is covered in
// `PluginSection.test.tsx`.
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

const aiConfig = {
  provider: "deepseek",
  model: "deepseek-chat",
  baseUrl: "",
  providerName: "",
  apiKeys: {},
  models: [],
} as any;

function renderDialog(overrides: Record<string, unknown> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    delimiterMode: "auto" as DelimiterMode,
    onDelimiterModeChange: vi.fn(),
    noHeaders: false,
    onNoHeadersChange: vi.fn(),
    systemNotification: true,
    onSystemNotificationChange: vi.fn(),
    minimizeToTray: true,
    onMinimizeToTrayChange: vi.fn(),
    doubleClickFitView: true,
    onDoubleClickFitViewChange: vi.fn(),
    autoCheckUpdate: true,
    onAutoCheckUpdateChange: vi.fn(),
    maxConcurrentRuns: 4,
    onMaxConcurrentRunsChange: vi.fn(),
    onResetOnboarding: vi.fn(),
    onSave: vi.fn(),
    aiConfig,
    onAIConfigChange: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <ThemeProvider>
      <LanguageProvider>
        <SettingsDialog {...(props as React.ComponentProps<typeof SettingsDialog>)} />
      </LanguageProvider>
    </ThemeProvider>,
  );
  return { ...utils, props };
}

const rowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-settings-row]"))
    .map((node) => node.getAttribute("data-settings-row"))
    .filter((id): id is string => id !== null);

const searchbox = () => screen.getByRole("searchbox");

const type = (value: string) =>
  fireEvent.change(searchbox(), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
  window.localStorage.clear();
});

describe("settings dialog — structure contracts (design 030 §0.4)", () => {
  it("renders a row for every row defined in settingsSections", () => {
    const { container } = renderDialog();

    const expected = SETTINGS_GROUPS.flatMap((group) =>
      group.rows.map((row) => row.id),
    );
    const rendered = rowIds(container);

    // No static row may be missing…
    for (const id of expected) expect(rendered).toContain(id);
    // …and the only rows that do not come from `settingsSections` are the
    // plugin group's, which are built from the catalogue at runtime.
    const extra = rendered.filter((id) => !expected.includes(id));
    expect(extra.every((id) => id?.startsWith("plugin-"))).toBe(true);
  });

  it("renders a heading for every group, with the anchor the nav targets", () => {
    const { container } = renderDialog();

    for (const group of SETTINGS_GROUPS) {
      expect(container.querySelector(`#${sectionElementId(group.id)}`)).toBeTruthy();
    }
  });

  it("renders the plugin group's heading, and no row for the group itself", () => {
    const { container } = renderDialog();

    const heading = container.querySelector(
      `#${sectionElementId("plugins")}`,
    ) as HTMLElement;
    expect(heading).toBeTruthy();
    expect(heading.textContent).toContain("Plugins");
    // Its actions live on the heading (see `PluginSection.test.tsx`), and the
    // group is not a row of its own.
    expect(
      heading.querySelector('button[aria-label="Refresh catalog"]'),
    ).toBeTruthy();
    expect(rowIds(container)).not.toContain("plugins");
  });

  it("lists exactly the same groups in the directory as in the content", () => {
    const { container } = renderDialog();

    const nav = container.querySelector("nav[aria-label]")!;
    const navCount = nav.querySelectorAll("button").length;
    expect(navCount).toBe(SETTINGS_GROUPS.length);
  });
});

describe("settings dialog — search (design 030 §4.3)", () => {
  it("filters rows by title, across groups", () => {
    const { container } = renderDialog();

    type("tray");

    expect(rowIds(container)).toEqual(["tray"]);
    // The matching group's heading survives as context.
    expect(container.textContent).toContain("Window");
  });

  it("filters by a `keywords` alias, which is invisible in the UI", () => {
    const { container } = renderDialog();

    type("dark");

    expect(rowIds(container)).toEqual(["theme"]);
  });

  it("requires every term", () => {
    const { container } = renderDialog();

    type("tray notification");

    expect(rowIds(container)).toEqual([]);
  });

  it("shows the empty state with the query echoed back", () => {
    const { container } = renderDialog();

    type("zzzz");

    expect(rowIds(container)).toEqual([]);
    expect(container.textContent).toContain("zzzz");
    expect(container.textContent).toMatch(/No settings match/);
  });

  it("clears the search on the first Escape and closes on the second", () => {
    const { container, props } = renderDialog();

    type("tray");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(rowIds(container).length).toBeGreaterThan(1);
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("focuses the search box on `/` when no field has focus", () => {
    renderDialog();

    fireEvent.keyDown(window, { key: "/" });

    expect(document.activeElement).toBe(searchbox());
  });
});

describe("settings dialog — whole-row activation (design 030 §4.2)", () => {
  // Clicking a row must do what clicking its control does. `delimiter` used to
  // fall through to the "inert" branch, so its row silently did nothing while
  // the AI dropdowns next to it worked.
  it("opens the delimiter dropdown when its row is clicked", () => {
    const { container } = renderDialog();
    const row = container.querySelector(
      '[data-settings-row="delimiter"]',
    ) as HTMLElement;
    const combo = row.querySelector('[role="combobox"]') as HTMLInputElement;

    fireEvent.click(row);

    expect(document.activeElement).toBe(combo);
    // `Select` opens on focus.
    expect(row.querySelector('[role="listbox"]')).toBeTruthy();
    expect(row.className).toContain("cursor-pointer");
  });

  it("toggles a switch when its row is clicked", () => {
    const { container, props } = renderDialog({ noHeaders: false });
    const row = container.querySelector(
      '[data-settings-row="no-headers"]',
    ) as HTMLElement;

    fireEvent.click(row);

    expect(props.onNoHeadersChange).toHaveBeenCalledWith(true);
  });
});

describe("settings dialog — directory and footer", () => {
  it("scrolls to and focuses the group heading when a directory entry is used", () => {
    const { container } = renderDialog();
    const scrollIntoView = vi.fn();
    const heading = container.querySelector(
      `#${sectionElementId("window")}`,
    ) as HTMLElement;
    heading.scrollIntoView = scrollIntoView;

    // "Window" appears twice — as the directory entry and as the heading
    // itself; the directory entry is the button.
    fireEvent.click(screen.getByRole("button", { name: "Window" }));

    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(heading);
  });

  it("resets the six values the old footer reset", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));

    expect(props.onDelimiterModeChange).toHaveBeenCalledWith("auto");
    expect(props.onNoHeadersChange).toHaveBeenCalledWith(false);
    expect(props.onSystemNotificationChange).toHaveBeenCalledWith(true);
    expect(props.onMinimizeToTrayChange).toHaveBeenCalledWith(true);
    expect(props.onDoubleClickFitViewChange).toHaveBeenCalledWith(true);
  });

  it("saves through the footer", () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /Save Settings/i }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it("renders nothing while closed", () => {
    const { container } = renderDialog({ isOpen: false });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
