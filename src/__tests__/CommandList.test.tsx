import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

import { LanguageProvider } from "@/i18n";
import { CommandList } from "@/modules/logs/CommandList";
import { xanCommands } from "@/data/commands";

/**
 * The catalog reads as a ledger: rail on the left, one 30px row per
 * operation, sticky group header, footer with counts. Vitest runs in English
 * (system language), so text assertions use the `en` values.
 */
function renderPanel(
  overrides: Partial<Parameters<typeof CommandList>[0]> = {},
) {
  const onCommandClick = vi.fn();
  const onHelpClick = vi.fn();
  const onSearchChange = vi.fn();
  const onClose = vi.fn();
  const props = {
    commands: xanCommands,
    onCommandClick,
    onHelpClick,
    searchQuery: "",
    onSearchChange,
    isVisible: true,
    onClose,
    ...overrides,
  };
  const utils = render(
    <LanguageProvider>
      <CommandList {...props} />
    </LanguageProvider>,
  );
  return { ...utils, onCommandClick, onHelpClick, onSearchChange, onClose };
}

describe("CommandList catalog (design 072)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders one row per command", () => {
    renderPanel();
    expect(screen.getAllByRole("option")).toHaveLength(xanCommands.length);
  });

  it("keeps a help button on every row", () => {
    renderPanel();
    expect(
      screen.getAllByRole("button", { name: /^Help for / }),
    ).toHaveLength(xanCommands.length);
  });

  it("reports the total and keeps no category rail", () => {
    renderPanel();
    expect(screen.getByText(/61 operations/)).toBeTruthy();
    // The 14-row category rail was removed (design 072 §12.3 #14): the list is
    // one column now, and the sticky group headers carry the counts instead.
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.getAllByRole("group")).toHaveLength(14);
  });

  it("adds the clicked operation", () => {
    const { onCommandClick } = renderPanel();
    fireEvent.click(screen.getByRole("option", { name: /dedup/ }));
    expect(onCommandClick).toHaveBeenCalledTimes(1);
    expect(onCommandClick.mock.calls[0][0].id).toBe("dedup");
  });

  it("opens the row's help without adding it", () => {
    const { onCommandClick, onHelpClick } = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Help for dedup" }));
    expect(onHelpClick).toHaveBeenCalledTimes(1);
    expect(onHelpClick.mock.calls[0][0].id).toBe("dedup");
    expect(onCommandClick).not.toHaveBeenCalled();
  });

  it("filters to the matching operation and updates the footer", () => {
    renderPanel({ searchQuery: "groupby" });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByText(/1 of 61/)).toBeTruthy();
  });

  it("shows a whole category when the query names it", () => {
    // Only `dedup` mentions "deduplicate" in its description, but the label
    // "Sort & deduplicate" matches too - so the whole group stays visible.
    renderPanel({ searchQuery: "deduplicate" });
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText(/3 of 61/)).toBeTruthy();
  });

  it("offers three real examples when nothing matches", () => {
    const { onSearchChange } = renderPanel({ searchQuery: "vlookup" });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching operation")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "dedupe" }));
    expect(onSearchChange).toHaveBeenCalledWith("dedupe");
  });

  it("closes on Escape and on the header button", () => {
    const { onClose } = renderPanel();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("adds with Enter and opens help with Shift+Enter", () => {
    const { onCommandClick, onHelpClick } = renderPanel();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onCommandClick.mock.calls[0][0].id).toBe("view");

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter", shiftKey: true });
    expect(onHelpClick.mock.calls[0][0].id).toBe("headers");
  });

  it("renders nothing while closed", () => {
    renderPanel({ isVisible: false });
    expect(screen.queryByTestId("command-list")).toBeNull();
  });
});
