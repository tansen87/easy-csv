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
    });
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it("copies one issue-ready line with version, Tauri and OS", async () => {
    renderDialog();

    // The action waits for the build facts before it can say anything useful.
    await waitFor(() => expect(screen.getByText("0.8.4")).toBeTruthy());

    fireEvent.click(screen.getByLabelText(t.aboutCopyInfo));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "easy-csv 0.8.4 · Tauri 2.9.0 · Windows · x64",
      ),
    );
    expect(screen.getByText(t.aboutCopied)).toBeTruthy();
  });
});
