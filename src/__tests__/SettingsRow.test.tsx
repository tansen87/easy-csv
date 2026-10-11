import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";

import { SettingsRow } from "@/components/setting/SettingsRow";

/**
 * One row = one setting (design 030 §4.2). The interesting part is the click
 * delegation: the whole row acts like its control, **except** that a click
 * landing on the control is left to the control itself (otherwise a checkbox
 * would toggle twice).
 */

function renderRow(overrides: Partial<React.ComponentProps<typeof SettingsRow>> = {}) {
  const onActivate = vi.fn();
  const utils = render(
    <SettingsRow
      id="tray"
      title="Tray"
      description="Minimize to tray on close"
      onActivate={onActivate}
      {...overrides}
    >
      <input type="checkbox" aria-label="Tray" />
    </SettingsRow>,
  );
  return { ...utils, onActivate };
}

const row = (container: HTMLElement) =>
  container.querySelector('[data-settings-row="tray"]') as HTMLElement;

describe("SettingsRow", () => {
  it("is the row contract: id, data attribute and focus target", () => {
    const { container } = renderRow();

    const node = row(container);
    expect(node).toBeTruthy();
    expect(node.id).toBe("settings-row-tray");
    expect(node.getAttribute("tabindex")).toBe("-1");
    expect(node.textContent).toContain("Tray");
    expect(node.textContent).toContain("Minimize to tray on close");
  });

  it("runs the row action when the row itself is clicked", () => {
    const { onActivate, container } = renderRow();

    fireEvent.click(screen.getByText("Minimize to tray on close"));

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(row(container).className).toContain("cursor-pointer");
  });

  it("leaves clicks that land on the control to the control", () => {
    const { onActivate } = renderRow();

    fireEvent.click(screen.getByRole("checkbox", { name: "Tray" }));

    // Not toggled twice: the checkbox handled it, so the row must not also run.
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("is inert without a row action — destructive rows rely on this", () => {
    const { container } = renderRow({ onActivate: undefined });

    fireEvent.click(screen.getByText("Minimize to tray on close"));

    expect(row(container).className).not.toContain("cursor-pointer");
    expect(row(container).className).not.toContain("hover:bg-accent/40");
  });

  it("wraps search hits in <mark>, leaving the rest as plain text", () => {
    // Title only, so the count is unambiguous.
    const { container } = renderRow({ highlight: "tr", description: undefined });

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Tr");
    expect(container.textContent).toBe("Tray");
  });

  it("highlights the description too", () => {
    const { container } = renderRow({ highlight: "minimize" });

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Minimize");
  });

  it("renders no <mark> when the highlight does not apply", () => {
    const { container } = renderRow({ highlight: "zzz" });
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
