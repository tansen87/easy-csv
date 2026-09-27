import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentProps } from "react";
import { LanguageProvider } from "@/i18n";
import { UpdateDialog } from "@/modules/dialogs/app/UpdateDialog";
import type { UpdateSession } from "@/services/update";
import type { UpdateProgressState } from "@/hooks/useUpdater";

vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));

const SESSION: UpdateSession = {
  available: true,
  version: "0.7.0",
  currentVersion: "0.6.0",
  notes: "## What changed\n\n- every single line of it",
  date: "2026-09-27",
  update: null,
};

/** 12 of 40 MiB → a stable 30% to assert on. */
const DOWNLOADING: UpdateProgressState = {
  phase: "downloading",
  downloaded: 12 * 1024 * 1024,
  total: 40 * 1024 * 1024,
};

function renderDialog(
  overrides: Partial<ComponentProps<typeof UpdateDialog>> = {},
) {
  const onClose = vi.fn();
  const view = render(
    <LanguageProvider>
      <UpdateDialog
        isOpen
        onClose={onClose}
        updateInfo={SESSION}
        installForm={null}
        isInstalling={false}
        progress={null}
        error={null}
        onInstall={vi.fn()}
        {...overrides}
      />
    </LanguageProvider>,
  );
  return { ...view, onClose };
}

/** The scrolling region is the one sized `h-[40vh]`. */
function scrollRegion(container: HTMLElement): Element | null {
  return container.querySelector('[class*="h-[40vh]"]');
}

describe("UpdateDialog progress placement", () => {
  it("keeps the progress in the header, out of the scrolling release notes", () => {
    const { container } = renderDialog({
      isInstalling: true,
      progress: DOWNLOADING,
    });

    const percent = screen.getByText("30%");
    const title = screen.getByRole("heading", { level: 3 });

    // Centred in the header row, i.e. a sibling of the title rather than part
    // of the body: release notes can be arbitrarily long and must not push the
    // progress out of view.
    expect(title.parentElement).toContainElement(percent);
    expect(scrollRegion(container)).not.toBeNull();
    expect(scrollRegion(container)).not.toContainElement(percent);
  });

  it("shows the byte counts next to the bar", () => {
    renderDialog({ isInstalling: true, progress: DOWNLOADING });

    expect(screen.getByText("12.0 MB / 40.0 MB")).toBeInTheDocument();
  });

  it("renders no progress while nothing is being installed", () => {
    const { container } = renderDialog();

    expect(container.textContent).not.toMatch(/%/);
    expect(scrollRegion(container)).not.toBeNull();
  });
});

describe("UpdateDialog cannot be dismissed mid-install", () => {
  it("ignores Escape while the installer owns the app", () => {
    const { onClose } = renderDialog({
      isInstalling: true,
      progress: DOWNLOADING,
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores a backdrop click while the installer owns the app", () => {
    const { container, onClose } = renderDialog({
      isInstalling: true,
      progress: DOWNLOADING,
    });
    const backdrop = container.firstElementChild?.firstElementChild;

    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("still closes on Escape when no install is running", () => {
    const { onClose } = renderDialog();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
