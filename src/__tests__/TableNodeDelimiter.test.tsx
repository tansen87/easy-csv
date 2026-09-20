import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReactFlowProvider } from "reactflow";
import { LanguageProvider } from "@/i18n";
import {
  TableNode,
  type TableNodeData,
} from "@/modules/pipeline/nodes/TableNode";

// Design 018 §3.7: the input node shows the delimiter the file was read with,
// how it was resolved, and lets the user override it (auto / locked).
function makeData(overrides: Partial<TableNodeData> = {}): TableNodeData {
  return {
    headers: ["a", "b"],
    rows: [["1", "2"]],
    columnWidths: {},
    onContextMenu: vi.fn(),
    onRename: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function renderNode(data: TableNodeData) {
  return render(
    <LanguageProvider>
      <ReactFlowProvider>
        <TableNode data={data} selected={false} />
      </ReactFlowProvider>
    </LanguageProvider>,
  );
}

function badge() {
  return screen.getByLabelText("Delimiter for this file");
}

beforeEach(() => {
  vi.clearAllMocks();
  // The node's scroll area needs ResizeObserver, which jsdom lacks.
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

describe("TableNode delimiter badge", () => {
  it("is hidden until a file was read", () => {
    renderNode(makeData());
    expect(
      screen.queryByLabelText("Delimiter for this file"),
    ).not.toBeInTheDocument();
  });

  it("shows the resolved delimiter with its confidence", () => {
    renderNode(
      makeData({
        delimiter: ";",
        delimiterMode: "auto",
        delimiterSource: "detected",
        delimiterConfidence: "high",
        onDelimiterChange: vi.fn(),
      }),
    );

    expect(badge()).toHaveTextContent(";");
    expect(badge()).toHaveAttribute(
      "title",
      expect.stringMatching(
        /Delimiter for this file: ; · Detected · high confidence/,
      ),
    );
    expect(badge()).not.toHaveAttribute("title", /Locked/);
  });

  it("flags a fallback and a locked choice", () => {
    const { unmount } = renderNode(
      makeData({
        delimiter: ",",
        delimiterMode: "auto",
        delimiterSource: "fallback",
        delimiterConfidence: "none",
        onDelimiterChange: vi.fn(),
      }),
    );
    expect(badge()).toHaveAttribute(
      "title",
      expect.stringMatching(/No delimiter detected/),
    );
    unmount();

    renderNode(
      makeData({
        delimiter: "|",
        delimiterMode: "|",
        delimiterSource: "forced",
        delimiterConfidence: "high",
        onDelimiterChange: vi.fn(),
      }),
    );
    expect(badge()).toHaveAttribute("title", expect.stringMatching(/Locked/));
  });

  it("opens a picker and reports a manual delimiter", () => {
    const onDelimiterChange = vi.fn();
    renderNode(
      makeData({
        delimiter: ";",
        delimiterMode: "auto",
        delimiterSource: "detected",
        delimiterConfidence: "high",
        onDelimiterChange,
      }),
    );

    fireEvent.click(badge());

    // The header-rename picker sits in the same row, so match by placeholder.
    const combo = screen.getByPlaceholderText("Delimiter") as HTMLInputElement;
    expect(combo.value).toBe("Auto-detect");

    fireEvent.focus(combo);
    const option = screen
      .getAllByRole("option")
      .find((o) => o.textContent === "Pipe (|)");
    fireEvent.click(option!);

    expect(onDelimiterChange).toHaveBeenCalledWith("|");
    // The picker closes and the compact badge comes back.
    expect(badge()).toBeInTheDocument();
  });

  it("can go back to auto-detection", () => {
    const onDelimiterChange = vi.fn();
    renderNode(
      makeData({
        delimiter: "|",
        delimiterMode: "|",
        delimiterSource: "forced",
        delimiterConfidence: "high",
        onDelimiterChange,
      }),
    );

    fireEvent.click(badge());
    const combo = screen.getByPlaceholderText("Delimiter") as HTMLInputElement;
    expect(combo.value).toBe("Pipe (|)");

    fireEvent.focus(combo);
    const option = screen
      .getAllByRole("option")
      .find((o) => o.textContent === "Auto-detect");
    fireEvent.click(option!);

    expect(onDelimiterChange).toHaveBeenCalledWith("auto");
  });
});
