import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CommandPalette } from "@/modules/logs/CommandPalette";
import type { PaletteItem } from "@/modules/logs/lib/paletteTypes";
import { FileText, FolderOpen, Play } from "lucide-react";

function makeItems(): PaletteItem[] {
  return [
    {
      id: "open",
      label: "Open",
      description: "CSV, Excel, JSON",
      icon: FolderOpen,
      group: "Actions",
      source: "action",
      shortcut: "Ctrl+O",
      onSelect: vi.fn(),
    },
    {
      id: "execute",
      label: "Execute",
      icon: Play,
      group: "Actions",
      source: "action",
      shortcut: "Ctrl+R",
      onSelect: vi.fn(),
    },
    {
      id: "select-cmd",
      label: "select",
      description: "Select columns from a CSV file",
      icon: FileText,
      group: "Commands",
      category: "Add, transform, drop and move columns",
      source: "command",
      keywords: "Add, transform, drop and move columns",
      onHelp: vi.fn(),
      onSelect: vi.fn(),
    },
    {
      id: "hidden",
      label: "Hidden",
      group: "Actions",
      source: "action",
      disabled: true,
      onSelect: vi.fn(),
    },
  ];
}

/** Items whose scores collide, to pin the ranking and the tie-break order. */
function rankingItems(): PaletteItem[] {
  return [
    {
      id: "open-file",
      label: "打开文件",
      group: "Actions",
      source: "action",
      onSelect: vi.fn(),
    },
    {
      id: "cmd-filter",
      label: "filter",
      description: "根据表达式结果筛选 CSV 行",
      group: "Commands",
      source: "command",
      onSelect: vi.fn(),
    },
    {
      id: "cmd-batch-filter",
      label: "batch-filter",
      description: "搜索多个值并输出单独文件",
      group: "Commands",
      source: "command",
      onSelect: vi.fn(),
    },
    {
      id: "recent-finance",
      label: "finance_2025.csv",
      description: "D:\\data\\finance_2025.csv",
      group: "Recent files",
      source: "file",
      onSelect: vi.fn(),
    },
  ];
}

const rowTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll("button")).map(
    (b) => b.textContent ?? "",
  );

/**
 * Design 073 moved the query out of the panel (it lives in the menu bar), so
 * the tests drive it through a tiny controlled wrapper. `withInput` renders the
 * narrow-window query row, which is the only place an input exists.
 */
function Harness({
  items,
  isOpen = true,
  onClose = vi.fn(),
  withInput = true,
}: {
  items: PaletteItem[];
  isOpen?: boolean;
  onClose?: () => void;
  withInput?: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <LanguageProvider>
      <CommandPalette
        isOpen={isOpen}
        onClose={onClose}
        items={items}
        query={query}
        onQueryChange={setQuery}
        withInput={withInput}
        position={{ top: 42, left: 12, width: 620 }}
      />
    </LanguageProvider>
  );
}

const renderPalette = (
  items: PaletteItem[],
  overrides: Partial<React.ComponentProps<typeof Harness>> = {},
) => render(<Harness items={items} {...overrides} />);

const typeQuery = (container: HTMLElement, value: string) => {
  const input = container.querySelector("input") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
};

const findButton = (container: HTMLElement, label: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent || "").includes(label),
  ) as HTMLButtonElement;

describe("CommandPalette", () => {
  it("renders groups and items when open", () => {
    const { container } = renderPalette(makeItems());
    expect(container.textContent).toContain("Actions");
    expect(container.textContent).toContain("Columns");
    expect(container.textContent).toContain("Open");
    expect(container.textContent).toContain("select");
  });

  it("prints the ledger index on command category headers", () => {
    const { container } = renderPalette(makeItems());
    // "Add, transform, drop and move columns" is category 04 in the view table.
    expect(container.textContent).toContain("04");
    expect(container.textContent).toContain("Columns");
  });

  it("hides disabled items", () => {
    const { container } = renderPalette(makeItems());
    const labels = rowTexts(container);
    expect(labels.some((l) => l.includes("Hidden"))).toBe(false);
  });

  it("filters items by query", () => {
    const { container } = renderPalette(makeItems());
    typeQuery(container, "select");

    const labels = rowTexts(container);
    expect(labels.some((l) => l.includes("Open"))).toBe(false);
    expect(labels.some((l) => l.includes("select"))).toBe(true);
  });

  it("matches against keywords and shortcuts", () => {
    const { container } = renderPalette(makeItems());
    typeQuery(container, "drop and move");
    expect(container.querySelectorAll("button").length).toBe(1);

    typeQuery(container, "Ctrl+R");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain("Execute");
  });

  it("prints shortcut chips without a plus sign", () => {
    const { container } = renderPalette(makeItems());
    const caps = Array.from(container.querySelectorAll("kbd")).map(
      (k) => k.textContent,
    );
    // `Ctrl+O` is stored on the item; the chip must read `Ctrl O`.
    expect(caps).toContain("Ctrl O");
    expect(caps).toContain("Ctrl R");
    expect(caps.some((c) => (c ?? "").includes("+"))).toBe(false);
  });

  it("matches the displayed spelling of a shortcut too", () => {
    const { container } = renderPalette(makeItems());
    typeQuery(container, "ctrl r");
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toContain("Execute");
  });

  it("ranks by score: prefix beats substring, exact beats everything", () => {
    const { container } = renderPalette(rankingItems());
    typeQuery(container, "fi");

    const texts = rowTexts(container);
    // filter (prefix, command) → finance_2025.csv (prefix, file) → batch-filter (substring)
    expect(texts[0].startsWith("filter")).toBe(true);
    expect(texts[1].startsWith("finance_2025.csv")).toBe(true);
    expect(texts[2].startsWith("batch-filter")).toBe(true);
  });

  it("prefers the exact label match over a prefix one", () => {
    const items: PaletteItem[] = [
      {
        id: "a",
        label: "fill",
        group: "Commands",
        source: "command",
        onSelect: vi.fn(),
      },
      {
        id: "b",
        label: "fi",
        group: "Commands",
        source: "command",
        onSelect: vi.fn(),
      },
    ];
    const { container } = renderPalette(items);
    typeQuery(container, "fi");
    expect(rowTexts(container)[0].startsWith("fi")).toBe(true);
  });

  it("matches Chinese labels by pinyin initials", () => {
    const { container } = renderPalette(rankingItems());
    typeQuery(container, "dk");

    const texts = rowTexts(container);
    expect(texts.length).toBe(1);
    expect(texts[0]).toContain("打开文件");
  });

  it("highlights the matched run of the label", () => {
    const { container } = renderPalette(rankingItems());
    typeQuery(container, "fi");

    const bold = container.querySelector("button b");
    expect(bold).not.toBeNull();
    expect(bold?.textContent).toBe("fi");
    // The label itself is untouched apart from the wrapper element.
    expect(rowTexts(container)[0].startsWith("filter")).toBe(true);
  });

  it("navigates with ArrowDown and selects with Enter", () => {
    const items = makeItems();
    renderPalette(items);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter" });

    // First item is "Open", second is "Execute" (disabled item is filtered out)
    expect(items[1].onSelect).toHaveBeenCalledTimes(1);
  });

  it("wraps around at both ends", () => {
    const items = makeItems();
    renderPalette(items);

    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(items[2].onSelect).toHaveBeenCalledTimes(1); // last available row
  });

  it("ignores Enter while an IME composition is open", () => {
    const items = makeItems();
    renderPalette(items);
    fireEvent.keyDown(window, { key: "Enter", isComposing: true });
    expect(items[0].onSelect).not.toHaveBeenCalled();
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

  it("hands the selection back to the pointer once it actually moves", () => {
    const items = makeItems();
    const { container } = renderPalette(items);

    fireEvent.keyDown(window, { key: "ArrowDown" });

    // A pointer *move* over a row takes over (an enter alone does not).
    fireEvent.mouseMove(findButton(container, "Open"));
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

  it("clears the query before closing on Escape", () => {
    const onClose = vi.fn();
    const { container } = renderPalette(makeItems(), { onClose });
    typeQuery(container, "zzz");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

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

  it("shows a counted empty state that names the query", () => {
    const { container } = renderPalette(makeItems());
    typeQuery(container, "zzz");
    expect(container.querySelectorAll("button").length).toBe(0);
    expect(container.textContent).toContain("zzz");
  });

  it("has no query row in the wide (menu-bar) layout", () => {
    const { container } = renderPalette(makeItems(), { withInput: false });
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain("Open");
  });

  it("opens the selected command's docs with Shift+Enter", () => {
    const items = makeItems();
    const onClose = vi.fn();
    renderPalette(items, { onClose });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    fireEvent.keyDown(window, { key: "Enter", shiftKey: true });

    expect(items[2].onHelp).toHaveBeenCalledTimes(1);
    expect(items[2].onSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns null when closed", () => {
    const { container } = renderPalette(makeItems(), { isOpen: false });
    expect(container.firstChild).toBeNull();
  });
});
