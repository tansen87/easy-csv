import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { HelpDialog } from "@/components/help/HelpDialog";

const content = [
  "First term here.",
  "",
  "Second paragraph with term again.",
  "",
  "Third one with term too.",
].join("\n");

const renderDialog = () =>
  render(
    <LanguageProvider>
      <HelpDialog
        isOpen
        onClose={vi.fn()}
        commandName="test"
        content={content}
      />
    </LanguageProvider>,
  );

describe("HelpDialog current match highlighting", () => {
  it("marks the first match as current, then moves on ArrowDown", () => {
    const { container } = renderDialog();
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "term" } });
    input.focus();

    let marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.length).toBe(3);

    let active = Array.from(
      container.querySelectorAll('[data-active-match="true"]'),
    );
    expect(active.length).toBe(1);
    expect(marks[0]).toBe(active[0]);
    expect(marks[0].classList.contains("bg-orange-500")).toBe(true);
    expect(marks[1].classList.contains("bg-orange-500")).toBe(false);

    fireEvent.keyDown(window, { key: "ArrowDown" });

    marks = Array.from(container.querySelectorAll("mark"));
    active = Array.from(container.querySelectorAll('[data-active-match="true"]'));
    expect(active.length).toBe(1);
    expect(marks[1]).toBe(active[0]);
    expect(marks[1].classList.contains("bg-orange-500")).toBe(true);
    expect(marks[0].classList.contains("bg-orange-500")).toBe(false);

    fireEvent.keyDown(window, { key: "ArrowDown" });

    active = Array.from(container.querySelectorAll('[data-active-match="true"]'));
    expect(active.length).toBe(1);
    expect(container.querySelectorAll("mark")[2]).toBe(active[0]);
  });

  it("removes all current styling when the query is cleared", () => {
    const { container } = renderDialog();
    const input = container.querySelector("input") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "term" } });
    input.focus();
    expect(container.querySelectorAll('[data-active-match="true"]').length).toBe(1);

    fireEvent.change(input, { target: { value: "" } });
    expect(container.querySelectorAll("mark").length).toBe(0);
  });
});
