import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { translations } from "@/i18n/translations";
import { EmptyState, type RecentFile } from "@/modules/data-preview/EmptyState";

const t = translations.en;

const RECENT_FILES: RecentFile[] = Array.from({ length: 6 }, (_, index) => ({
  path: `D:/work/file-${index + 1}.csv`,
  name: `file-${index + 1}.csv`,
  openedAt: `2026-11-0${index + 1} 14:32:00`,
}));

function renderEmptyState(recentFiles: RecentFile[] = []) {
  const onOpenFile = vi.fn();
  const onImportPipeline = vi.fn();
  const onLoadDemo = vi.fn();
  const onOpenUrl = vi.fn();
  const onOpenRecentFile = vi.fn();

  const utils = render(
    <LanguageProvider>
      <EmptyState
        onOpenFile={onOpenFile}
        onImportPipeline={onImportPipeline}
        onLoadDemo={onLoadDemo}
        onOpenUrl={onOpenUrl}
        recentFiles={recentFiles}
        onOpenRecentFile={onOpenRecentFile}
      />
    </LanguageProvider>,
  );

  return {
    ...utils,
    onOpenFile,
    onImportPipeline,
    onLoadDemo,
    onOpenUrl,
    onOpenRecentFile,
  };
}

describe("EmptyState", () => {
  it("renders the product copy and exactly two main actions", () => {
    renderEmptyState();

    expect(screen.getByText(t.emptyTitle)).toBeTruthy();
    expect(screen.getByText(t.emptySubtitle)).toBeTruthy();
    expect(screen.getByText(t.emptyFormats)).toBeTruthy();

    expect(screen.getByRole("button", { name: t.openFile })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: t.onboardingSeeExample }),
    ).toBeTruthy();
  });

  it("wires the four entry points to their callbacks", () => {
    const handlers = renderEmptyState();

    fireEvent.click(screen.getByRole("button", { name: t.openFile }));
    expect(handlers.onOpenFile).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: t.onboardingSeeExample }),
    );
    expect(handlers.onLoadDemo).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: t.emptyImportFlow }));
    expect(handlers.onImportPipeline).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: t.starOnGitHub }));
    expect(handlers.onOpenUrl).toHaveBeenCalledWith(
      "https://github.com/tansen87/easy-csv",
    );
  });

  it("shows the sample table and its pipeline strip", () => {
    const { container } = renderEmptyState();

    // Eight real rows from the embedded sample file.
    expect(container.querySelectorAll("div.h-7").length).toBe(8);
    expect(screen.getByText("search")).toBeTruthy();
    expect(screen.getByText("dedup")).toBeTruthy();
    expect(screen.getByText("groupby")).toBeTruthy();
    expect(screen.getByText(t.emptyResultRows)).toBeTruthy();
    expect(screen.getByText(t.emptySampleCaption)).toBeTruthy();
    // The row with an empty amount from the sample.
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("2026-07-03")).toBeTruthy();
  });

  it("numbers recent files and keeps at most five", () => {
    const { container } = renderEmptyState(RECENT_FILES);

    expect(screen.getByText(t.recentFiles)).toBeTruthy();
    const rows = container.querySelectorAll("button.grid");
    expect(rows.length).toBe(5);

    expect(rows[0].textContent).toContain("file-1.csv");
    expect(rows[0].textContent).toContain("11-01 14:32");
    expect(rows[4].textContent).toContain("file-5.csv");
    expect(container.textContent).not.toContain("file-6.csv");
  });

  it("hides the recent block when there are no files", () => {
    const { container } = renderEmptyState();

    expect(screen.queryByText(t.recentFiles)).toBeNull();
    expect(container.querySelectorAll("button.grid").length).toBe(0);
  });

  it("no longer renders the old welcome-page copy", () => {
    const { container } = renderEmptyState();

    expect(container.textContent).not.toContain("Welcome to Easy CSV");
    expect(container.textContent).not.toContain("Recommended");
    expect(container.textContent).not.toContain("Open a file or import a flow");
  });
});
