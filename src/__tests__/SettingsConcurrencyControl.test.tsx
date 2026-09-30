import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { SettingsTabContent } from "@/components/setting/SettingsTabContent";
import type { DelimiterMode } from "@/types/xan";

/**
 * Concurrency limit control (design 028 §7.1).
 *
 * The settings page owns the value; the backend clamps it to 1..=16 on save, so
 * the input clamps too and never reports an invalid number to the caller.
 */
const aiConfig = {
  provider: "deepseek",
  model: "deepseek-chat",
  baseUrl: "",
  providerName: "",
  models: [],
} as any;

function renderSettings(maxConcurrentRuns: number) {
  const onMaxConcurrentRunsChange = vi.fn();
  const utils = render(
    <LanguageProvider>
      <SettingsTabContent
        activeTab="general"
        theme="light"
        onThemeChange={vi.fn()}
        delimiterMode={"auto" as DelimiterMode}
        onDelimiterModeChange={vi.fn()}
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
        maxConcurrentRuns={maxConcurrentRuns}
        onMaxConcurrentRunsChange={onMaxConcurrentRunsChange}
        onSave={vi.fn()}
        aiConfig={aiConfig}
        onAIConfigChange={vi.fn()}
        showToast={vi.fn()}
      />
    </LanguageProvider>,
  );
  const input = utils.container.querySelector(
    'input[type="number"]',
  ) as HTMLInputElement;
  return { ...utils, input, onMaxConcurrentRunsChange };
}

describe("settings concurrency limit (design 028 §7.1)", () => {
  it("shows the stored limit", () => {
    const { input } = renderSettings(6);
    expect(input).toBeTruthy();
    expect(input.value).toBe("6");
    expect(input.min).toBe("1");
    expect(input.max).toBe("16");
  });

  it("reports an edited value", () => {
    const { input, onMaxConcurrentRunsChange } = renderSettings(4);
    fireEvent.change(input, { target: { value: "8" } });
    expect(onMaxConcurrentRunsChange).toHaveBeenCalledWith(8);
  });

  it("clamps out-of-range input instead of passing it through", () => {
    const { input, onMaxConcurrentRunsChange } = renderSettings(4);

    fireEvent.change(input, { target: { value: "99" } });
    expect(onMaxConcurrentRunsChange).toHaveBeenLastCalledWith(16);

    fireEvent.change(input, { target: { value: "0" } });
    expect(onMaxConcurrentRunsChange).toHaveBeenLastCalledWith(1);
  });
});