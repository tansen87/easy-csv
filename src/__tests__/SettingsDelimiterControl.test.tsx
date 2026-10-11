import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { SettingsTabContent } from "@/components/setting/SettingsTabContent";
import { buildSettingsModel } from "@/components/setting/settingsSections";
import { filterSettings } from "@/utils/settingsSearch";
import type { Translations } from "@/i18n/translations/types";

// Structure lives in `settingsSections`; these suites only care about one
// control, so the model is built from a stub `t` (titles become their keys).
const stubT = new Proxy({}, {
  get: (_target, key) => String(key),
}) as unknown as Translations;
const groups = filterSettings(buildSettingsModel(stubT), "");
// The scroll container handle the dialog normally supplies.
const scrollRootRef = { current: null } as React.RefObject<HTMLDivElement | null>;
import type { DelimiterMode } from "@/types/xan";

// Design 018 §3.9: the settings page and the workflow's input node badge are
// two mirrors of one value, so the settings page must show the app-wide mode
// and report edits with the picker's value verbatim.
const aiConfig = {
  provider: "deepseek",
  model: "deepseek-chat",
  baseUrl: "",
  providerName: "",
  models: [],
} as any;

function renderSettings(
  delimiterMode: DelimiterMode,
  onDelimiterModeChange = vi.fn(),
) {
  const utils = render(
    <LanguageProvider>
      <SettingsTabContent
        groups={groups}
        query=""
        scrollRootRef={scrollRootRef}
        theme="light"
        onThemeChange={vi.fn()}
        delimiterMode={delimiterMode}
        onDelimiterModeChange={onDelimiterModeChange}
        noHeaders={false}
        onNoHeadersChange={vi.fn()}
        systemNotification={true}
        onSystemNotificationChange={vi.fn()}
        minimizeToTray={true}
        onMinimizeToTrayChange={vi.fn()}
        doubleClickFitView={true}
        onDoubleClickFitViewChange={vi.fn()}
        autoCheckUpdate={true}
        onAutoCheckUpdateChange={vi.fn()}
        maxConcurrentRuns={4}
        onMaxConcurrentRunsChange={vi.fn()}
        aiConfig={aiConfig}
        onAIConfigChange={vi.fn()}
        showToast={vi.fn()}
      />
    </LanguageProvider>,
  );
  return { ...utils, onDelimiterModeChange };
}

function delimiterCombo() {
  return screen.getByPlaceholderText("Select delimiter") as HTMLInputElement;
}

function pick(label: string) {
  fireEvent.focus(delimiterCombo());
  const option = screen
    .getAllByRole("option")
    .find((o) => o.textContent === label);
  fireEvent.click(option!);
}

beforeEach(() => {
  vi.clearAllMocks();
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

describe("settings page delimiter control (design 018 §3.9)", () => {
  it("shows auto-detection when the switch is on", () => {
    renderSettings("auto");
    expect(delimiterCombo().value).toBe("Auto-detect");
  });

  it("shows the locked delimiter when detection is off", () => {
    renderSettings(";");
    expect(delimiterCombo().value).toBe("Semicolon (;)");
  });

  it("offers the five delimiters next to auto-detection", () => {
    const { container } = renderSettings("auto");
    fireEvent.focus(delimiterCombo());
    const labels = Array.from(
      container.querySelectorAll("[role='option']"),
    ).map((o) => o.textContent);
    expect(labels).toEqual([
      "Auto-detect",
      "Comma (,)",
      "Semicolon (;)",
      "Tab (\\t)",
      "Pipe (|)",
      "Caret (^)",
    ]);
  });

  it("reports a picked delimiter so the input node can follow", () => {
    const { onDelimiterModeChange } = renderSettings("auto");

    pick("Pipe (|)");
    expect(onDelimiterModeChange).toHaveBeenCalledWith("|");
  });

  it("turns detection back on from the picker", () => {
    const { onDelimiterModeChange } = renderSettings(";");

    pick("Auto-detect");
    expect(onDelimiterModeChange).toHaveBeenCalledWith("auto");
  });

  // The reset button moved to the dialog footer with the 030 layout; its effect
  // on the delimiter is asserted in `SettingsDialog.test.tsx`.
});
