import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import { AboutDialog } from "@/modules/dialogs/app/AboutDialog";

const t = translations.en;

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));

const writeText = vi.fn(async () => {});

function renderDialog() {
  return render(
    <LanguageProvider>
      <AboutDialog isOpen onClose={() => {}} />
    </LanguageProvider>,
  );
}

describe("AboutDialog copy version info", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({
      version: "0.8.4",
      tauriVersion: "2.9.0",
      platform: "windows",
      arch: "x86_64",
      osVersion: "Windows 11 Pro 24H2 (26100.2314)",
      webviewVersion: "131.0.2903.86",
    });
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("shows the WebView and OS rows and copies one fact per line", async () => {
    renderDialog();

    // The action waits for the build facts before it can say anything useful.
    await waitFor(() => expect(screen.getByText("0.8.4")).toBeTruthy());
    expect(screen.getByText("WebView2 131.0.2903.86")).toBeTruthy();
    expect(
      screen.getByText("Windows 11 Pro 24H2 (26100.2314) · x64"),
    ).toBeTruthy();

    fireEvent.click(screen.getByLabelText(t.aboutCopyInfo));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        [
          "easy-csv 0.8.4",
          "Tauri 2.9.0",
          "WebView2 131.0.2903.86",
          "Windows 11 Pro 24H2 (26100.2314) · x64",
        ].join("\n"),
      ),
    );
    expect(screen.getByText(t.aboutCopied)).toBeTruthy();
  });
});
