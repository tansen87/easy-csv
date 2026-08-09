import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CommandPalette, type PaletteItem } from "@/components/CommandPalette";
import { FileText, FolderOpen, Play } from "lucide-react";

function makeItems(): PaletteItem[] {
  return [
    {
      id: "open",
      label: "Open",
      description: "CSV, Excel, JSON",
      icon: FolderOpen,
      group: "Actions",
      shortcut: "Ctrl+O",
      onSelect: vi.fn(),
    },
    {
      id: "execute",
      label: "Execute",
      icon: Play,
      group: "Actions",
      shortcut: "Ctrl+R",
      onSelect: vi.fn(),
    },
    {
      id: "select-cmd",
      label: "select",
      description: "Select columns from a CSV file",
      icon: FileText,
      group: "Commands",
      keywords: "Add, transform, drop and move columns",
      onSelect: vi.fn(),
    },
    {
      id: "hidden",
      label: "Hidden",
      group: "Actions",
      disabled: true,
      onSelect: vi.fn(),
    },
  ];
}

const renderPalette = (
  items: PaletteItem[],
  overrides: Partial<React.ComponentProps<typeof CommandPalette>> = {},
) =>
  render(
    <LanguageProvider>
      <CommandPalette isOpen onClose={vi.fn()} items={items} {...overrides} />
    </LanguageProvider>,
  );

const findButton = (container: HTMLElement, label: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent || "").includes(label),
  ) as HTMLButtonElement;

describe("CommandPalette", () => {
  it("renders groups and items when open", () => {
    const { container } = renderPalette(makeItems());
    expect(container.textContent).toContain("Actions");
    expect(container.textContent).toContain("Commands");
    expect(container.textContent).toContain("Open");
    expect(container.textContent).toContain("select");
  });

  it("hides disabled items", () => {
    const { container } = renderPalette(makeItems());
    const buttons = Array.from(container.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent || "");
    expect(labels.some((l) => l.includes("Hidden"))).toBe(false);
  });

  it("filters items by query", () => {
    const { container } = renderPalette(makeItems());
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "select" } });

    const buttons = Array.from(container.querySelectorAll("button"));
    const labels = buttons.map((b) => b.textContent || "");
    expect(labels.some((l) => l.includes("Open"))).toBe(false);
    expect(labels.some((l) => l.includes("select"))).toBe(true);
  });

  it("matches against keywords and shortcuts", () => {
    const { container } = renderPalette(makeItems());
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "drop and move" } });
    expect(container.querySelectorAll("button").length).toBe(1);

    fireEvent.change(input, { target: { value: "Ctrl+R" } });
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain("Execute");
  });

  it("navigates with ArrowDown and selects with Enter", () => {
    const items = makeItems();
    renderPalette(items);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    // First item is "Open", second is "Execute" (disabled item is filtered out)
    expect(items[1].onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not let hover hijack the selection while using the keyboard", () => {
    const items = makeItems();
    const { container } = renderPalette(items);

    // Navigate to the third item with the keyboard
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(items[2].onSelect).toHaveBeenCalledTimes(1);

    // Hovering a middle item while in keyboard mode must not change selection
    fireEvent.mouseEnter(findButton(container, "Open"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(items[2].onSelect).toHaveBeenCalledTimes(2);
  });

  it("re-enables hover selection after the mouse moves", () => {
    const items = makeItems();
    const { container } = renderPalette(items);

    fireEvent.keyDown(window, { key: "ArrowDown" });

    fireEvent.mouseMove(container.querySelector('[role="dialog"]')!);
    fireEvent.mouseEnter(findButton(container, "Open"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(items[0].onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects first item with Enter by default", () => {
    const items = makeItems();
    renderPalette(items);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(items[0].onSelect).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    renderPalette(makeItems(), { onClose });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes and selects on click", () => {
    const items = makeItems();
    const onClose = vi.fn();
    const { container } = renderPalette(items, { onClose });
    fireEvent.click(findButton(container, "select"));
    expect(items[2].onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns null when closed", () => {
    const { container } = renderPalette(makeItems(), { isOpen: false });
    expect(container.querySelector("input")).toBeNull();
  });
});
