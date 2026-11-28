import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

import { LanguageProvider } from "@/i18n";
import { CsvDiffDialog } from "@/modules/dialogs/file/CsvDiffDialog";

/**
 * Design 085: the comparison is a workspace view, not a modal, and its top is
 * result-first (option D):
 * - before a compare the empty state **is** the settings form;
 * - afterwards the top collapses to one 36px sentence;
 * - settings reopen as a popover, which owns Escape while it is open.
 */
function renderDiff(onClose = vi.fn()) {
  const utils = render(
    <LanguageProvider>
      <CsvDiffDialog isOpen onClose={onClose} defaultDelimiter="," />
    </LanguageProvider>,
  );
  return { ...utils, onClose };
}

const resultFixture = {
  headers_left: ["customer", "amount"],
  headers_right: ["customer", "amount"],
  key_cols: [0],
  entries: [
    {
      status: "added" as const,
      left_line: null,
      right_line: 2,
      left_cells: null,
      right_cells: ["Aurora", "1200"],
      changed_cols: [],
      count: 1,
    },
  ],
  equal_count: 0,
  added_count: 1,
  removed_count: 0,
  modified_count: 0,
};

/** Pick both files, run the compare, and land on the summary state. */
async function compare() {
  const openMock = vi.mocked(open);
  const invokeMock = vi.mocked(invoke);
  openMock.mockResolvedValueOnce("D:/a.csv").mockResolvedValueOnce("D:/b.csv");
  invokeMock.mockImplementation((async (cmd: string) => {
    if (cmd === "read_csv_file") {
      return { headers: ["customer", "amount"], rows: [] };
    }
    if (cmd === "diff_csv_files") return resultFixture;
    return null;
  }) as typeof invoke);

  const buttons = screen.getAllByRole("button", { name: "Open" });
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  await screen.findByText("a.csv");
  fireEvent.click(screen.getByRole("button", { name: "Compare" }));
  await screen.findByText("b.csv");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CsvDiffDialog — workspace view (design 085)", () => {
  it("fills the area below the menu bar instead of floating over it", () => {
    renderDiff();

    const region = screen.getByRole("region");
    // 36px = the menu bar's height; the chrome layer must stay on top of it.
    expect(region.className).toContain("top-9");
    expect(region.className).toContain("z-floating");
    expect(region.className).not.toContain("fixed");
    // No modal semantics and no dimming layer: the menu bar is still live.
    expect(region.getAttribute("aria-modal")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(region.querySelector(".bg-black\\/20")).toBeNull();
  });

  it("turns the empty state into the settings form", () => {
    renderDiff();

    expect(
      screen.getByRole("heading", { name: "Compare Differences" }),
    ).toBeTruthy();
    // Two file slots and the one primary action, all on the same surface.
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Compare" })).toBeTruthy();
    // No permanent toolbar above it.
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("collapses the top to a one-line summary after a compare", async () => {
    renderDiff();
    await compare();

    // The settings form is gone; the summary carries the identity and counts.
    expect(
      screen.queryByRole("heading", { name: "Compare Differences" }),
    ).toBeNull();
    expect(screen.getByText("a.csv")).toBeTruthy();
    expect(screen.getByText("b.csv")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    // The table itself starts right below that line.
    expect(screen.getByText("customer")).toBeTruthy();
    expect(screen.getByText("Aurora")).toBeTruthy();
  });

  it("reopens the settings as a popover that owns Escape", async () => {
    const { onClose } = renderDiff();
    await compare();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryAllByRole("button", { name: "Open" })).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes the popover on a click outside it", async () => {
    renderDiff();
    await compare();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);

    fireEvent.pointerDown(document.body);
    await waitFor(() =>
      expect(screen.queryAllByRole("button", { name: "Open" })).toHaveLength(0),
    );
  });

  it("closes on Escape", () => {
    const { onClose } = renderDiff();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to an open menu above it", () => {
    const { onClose } = renderDiff();
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
    menu.remove();
  });
});
