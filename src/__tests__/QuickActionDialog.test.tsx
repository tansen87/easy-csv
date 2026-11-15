import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { QuickActionDialog } from "@/modules/dialogs/quick/QuickActionDialog";
import type { QuickActionRequest } from "@/modules/dialogs/quick/types";

const HEADERS = ["name", "age"];

function renderDialog(overrides: Partial<QuickActionRequest> = {}) {
  const onApply = vi.fn();
  const onAdvanced = vi.fn();
  const onClose = vi.fn();
  const request: QuickActionRequest = {
    kind: "sort",
    x: 120,
    y: 160,
    col: 0,
    headers: HEADERS,
    ...overrides,
  };

  const utils = render(
    <LanguageProvider>
      <QuickActionDialog
        request={request}
        onApply={onApply}
        onAdvanced={onAdvanced}
        onClose={onClose}
      />
    </LanguageProvider>,
  );

  return { ...utils, onApply, onAdvanced, onClose };
}

describe("QuickActionDialog", () => {
  it("renders a non-modal floating dialog without a backdrop", () => {
    const { container } = renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("false");
    expect(dialog.className).toContain("fixed");
    // No full-screen dimmer: the only fixed element is the dialog itself.
    expect(container.querySelectorAll(".fixed").length).toBe(1);
  });

  it("anchors at the right-click point", () => {
    renderDialog({ x: 120, y: 160 });
    const dialog = screen.getByRole("dialog") as HTMLElement;
    expect(dialog.style.left).toBe("120px");
    expect(dialog.style.top).toBe("160px");
    expect(dialog.getAttribute("style")).toContain("min(78vh, 680px)");
  });

  it("applies the prefilled column and reports the built command", () => {
    const { onApply } = renderDialog();
    fireEvent.click(screen.getByText("Add step"));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({
      type: "sort",
      params: { select: "name" },
    });
    expect(onApply.mock.calls[0][0].alias).toBeTruthy();
  });

  it("disables Add step until a column is selected", () => {
    const { onApply } = renderDialog({ col: undefined });
    const apply = screen.getByText("Add step") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);

    fireEvent.click(screen.getByText("age"));
    expect((screen.getByText("Add step") as HTMLButtonElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByText("Add step"));

    expect(onApply.mock.calls[0][0].params.select).toBe("age");
  });

  it("names the column in the header and states what will be added", () => {
    renderDialog();
    expect(screen.getByText("01 · name")).toBeTruthy();
    expect(screen.getByText("Will add")).toBeTruthy();
    expect(screen.getByText("sort")).toBeTruthy();
    expect(screen.getByText("name · Ascending")).toBeTruthy();
  });

  it("explains what is missing while the draft cannot be applied", () => {
    renderDialog({ col: undefined });
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(
      (screen.getByText("Add step") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("hands the current values over to the advanced form", () => {
    const { onAdvanced } = renderDialog();
    fireEvent.click(screen.getByText("Advanced"));
    expect(onAdvanced).toHaveBeenCalledTimes(1);
    expect(onAdvanced.mock.calls[0][0]).toMatchObject({
      type: "sort",
      params: { select: "name" },
    });
  });

  it("closes on Escape and on an outside click", () => {
    const { onClose } = renderDialog();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not close when clicking inside", () => {
    const { onClose } = renderDialog();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("caps the scroll body below the header and footer", () => {
    renderDialog({ kind: "filter" });
    const dialog = screen.getByRole("dialog") as HTMLElement;
    expect(dialog.getAttribute("style")).toContain("min(78vh, 680px)");

    const viewport = dialog.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    expect(viewport).toBeTruthy();
    expect(viewport.className).toContain("overflow-y-auto");
    const viewportStyle = viewport.getAttribute("style") ?? "";
    expect(viewportStyle).toContain("max-height");
    expect(viewportStyle).toContain("78vh");
    expect(viewportStyle).toContain("680px");
    // 112px = 40px header + 72px footer (design 055).
    expect(viewportStyle).toContain("112px");
    // Radix always mounts its vertical scrollbar on this viewport.
    expect(viewportStyle).toContain("overflow-y: scroll");
  });

  it("uses ScrollArea for the pivot column and row lists", () => {
    renderDialog({ kind: "pivot" });
    const dialog = screen.getByRole("dialog") as HTMLElement;
    const viewports = dialog.querySelectorAll(
      "[data-radix-scroll-area-viewport]",
    );
    // Shell body + "columns (pivot)" + "row (groupby)".
    expect(viewports.length).toBe(3);
    viewports.forEach((viewport) => {
      expect(viewport.getAttribute("style")).toContain("overflow-y: scroll");
    });
  });

  it("portals the select list out of the scroll body so it is never clipped", () => {
    renderDialog({ kind: "filter" });
    fireEvent.focus(screen.getAllByRole("combobox")[0]);

    const dialog = screen.getByRole("dialog");
    const list = screen.getByRole("listbox");
    expect(dialog.contains(list)).toBe(false);
    expect(document.body.contains(list)).toBe(true);
  });

  it("keeps the panel open when picking from a portaled select list", () => {
    const { onClose } = renderDialog({ kind: "filter" });
    fireEvent.focus(screen.getAllByRole("combobox")[0]);

    const option = screen.getByRole("option", { name: "age" });
    fireEvent.mouseDown(option);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(option);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("switches the filter form between text and number", () => {
    renderDialog({ kind: "filter" });
    expect(screen.getByDisplayValue("name")).toBeTruthy();
    fireEvent.click(screen.getByText("Number"));
    expect(screen.getByPlaceholderText(/search number/i)).toBeTruthy();
  });
});
