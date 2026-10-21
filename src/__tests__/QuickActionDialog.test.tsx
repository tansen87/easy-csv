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
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({
      type: "sort",
      params: { select: "name" },
    });
    expect(onApply.mock.calls[0][0].alias).toBeTruthy();
  });

  it("disables Apply until a column is selected", () => {
    const { onApply } = renderDialog({ col: undefined });
    const apply = screen.getByText("Apply") as HTMLButtonElement;
    expect(apply.disabled).toBe(true);

    fireEvent.click(screen.getByText("age"));
    expect((screen.getByText("Apply") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByText("Apply"));

    expect(onApply.mock.calls[0][0].params.select).toBe("age");
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

  it("scrolls the body and gives the filter dialog more height", () => {
    renderDialog({ kind: "filter" });
    const dialog = screen.getByRole("dialog") as HTMLElement;
    expect(dialog.getAttribute("style")).toContain("min(56vh, 560px)");

    const viewport = dialog.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    expect(viewport).toBeTruthy();
    expect(viewport.className).toContain("overflow-y-auto");
    const viewportStyle = viewport.getAttribute("style") ?? "";
    expect(viewportStyle).toContain("max-height");
    expect(viewportStyle).toContain("56vh");
    expect(viewportStyle).toContain("560px");
    expect(viewportStyle).toContain("min-height");
    expect(viewportStyle).toContain("33vh");
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

  it("switches the filter form between text and number", () => {
    renderDialog({ kind: "filter" });
    expect(screen.getByDisplayValue("name")).toBeTruthy();
    fireEvent.click(screen.getByText("Number"));
    expect(screen.getByPlaceholderText(/search number/i)).toBeTruthy();
  });
});
