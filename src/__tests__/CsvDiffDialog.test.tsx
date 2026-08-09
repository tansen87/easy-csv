import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import {
  CsvDiffDialog,
  CsvDiffResult,
} from "@/components/dialog/CsvDiffDialog";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);

const mockResult: CsvDiffResult = {
  headers_left: ["id", "name"],
  headers_right: ["id", "name"],
  key_cols: [0],
  equal_count: 1,
  added_count: 1,
  removed_count: 0,
  modified_count: 1,
  entries: [
    {
      status: "equal",
      left_line: 1,
      right_line: 1,
      left_cells: ["1", "Alice"],
      right_cells: ["1", "Alice"],
      changed_cols: [],
      count: 1,
    },
    {
      status: "modified",
      left_line: 2,
      right_line: 2,
      left_cells: ["2", "Bob"],
      right_cells: ["2", "Bobby"],
      changed_cols: [1],
      count: 1,
    },
    {
      status: "added",
      left_line: null,
      right_line: 3,
      left_cells: null,
      right_cells: ["3", "Carol"],
      changed_cols: [],
      count: 1,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "read_csv_file") {
      return Promise.resolve({ headers: ["id", "name"], rows: [] });
    }
    return Promise.resolve(mockResult);
  });
  // Radix ScrollArea requires ResizeObserver which is missing in jsdom
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

describe("CsvDiffDialog", () => {
  it("shows empty state when no result yet", () => {
    render(
      <LanguageProvider>
        <CsvDiffDialog isOpen onClose={vi.fn()} defaultDelimiter="," />
      </LanguageProvider>,
    );

    expect(screen.getByText("CSV Compare")).toBeInTheDocument();
    expect(
      screen.getByText("Select two CSV files and click Compare"),
    ).toBeInTheDocument();
  });

  it("invokes diff_csv_files with both files and renders summary", async () => {
    const { container } = render(
      <LanguageProvider>
        <CsvDiffDialog
          isOpen
          onClose={vi.fn()}
          defaultDelimiter=","
          initialFileA="/tmp/a.csv"
        />
      </LanguageProvider>,
    );

    const buttons = Array.from(container.querySelectorAll("button"));
    const browseButtons = buttons.filter((b) =>
      (b.textContent || "").includes("Browse"),
    );
    expect(browseButtons.length).toBe(2);
    fireEvent.click(browseButtons[1]);
    expect(mockOpen).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false }),
    );

    // Set file B path via the read-only input's onChange
    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[1], { target: { value: "/tmp/b.csv" } });
    fireEvent.click(screen.getByText("Compare"));

    expect(mockInvoke).toHaveBeenCalledWith("diff_csv_files", {
      fileA: "/tmp/a.csv",
      fileB: "/tmp/b.csv",
      delimiterA: ",",
      delimiterB: ",",
      keyColumns: null,
    });

    await screen.findByText(/Added/);
    expect(screen.getByText("≈ 1 identical rows")).toBeInTheDocument();
    expect(screen.getAllByText("Bobby").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Carol").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error when files are missing", () => {
    mockInvoke.mockResolvedValue(mockResult);

    render(
      <LanguageProvider>
        <CsvDiffDialog isOpen onClose={vi.fn()} defaultDelimiter="," />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText("Compare"));
    expect(screen.getByText("Please select both files")).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("handles invoke errors gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("Failed to parse CSV"));

    const { container } = render(
      <LanguageProvider>
        <CsvDiffDialog
          isOpen
          onClose={vi.fn()}
          defaultDelimiter=","
          initialFileA="/tmp/a.csv"
        />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[1], { target: { value: "/tmp/b.csv" } });
    fireEvent.click(screen.getByText("Compare"));

    expect(await screen.findByText(/Failed to parse CSV/)).toBeInTheDocument();
  });
});
