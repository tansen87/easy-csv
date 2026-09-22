import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { SplitLinesDialog } from "@/modules/dialogs/file/SplitLinesDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  SPLIT_LINES_HISTORY_KEY,
  type StoredSplitLinesResult,
} from "@/utils/splitLinesHistory";

const mockInvoke = vi.mocked(invoke);

const MOCK_RESULT = {
  output_dir: "/tmp/out",
  output_paths: [
    "/tmp/out/a_part1.csv",
    "/tmp/out/a_part2.csv",
    "/tmp/out/a_part3.csv",
  ],
  file_count: 3,
  lines_per_file: 2,
  total_rows: 5,
  header_written: true,
  elapsed_ms: 420,
};

function mockBackend(result: unknown = MOCK_RESULT, dirExists = true) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "split_lines") return result;
    if (cmd === "file_exists") return dirExists;
    return undefined;
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredSplitLinesResult> = {},
): StoredSplitLinesResult {
  const stored: StoredSplitLinesResult = {
    outputDir: "/tmp/prev",
    samplePaths: ["/tmp/prev/a_part1.csv"],
    fileCount: 4,
    totalRows: 400,
    headerWritten: true,
    finishedAt: "2026-09-20T08:12:33.000Z",
    elapsedMs: 1500,
    inputFile: "/tmp/prev.csv",
    outDirInput: "/tmp/prev",
    linesPerFile: 100,
    noHeaders: false,
    ...overrides,
  };
  window.localStorage.setItem(SPLIT_LINES_HISTORY_KEY, JSON.stringify(stored));
  return stored;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
  mockBackend();
});

function renderDialog(initialInputFile = "/tmp/input.csv") {
  return render(
    <LanguageProvider>
      <SplitLinesDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
      />
    </LanguageProvider>,
  );
}

describe("SplitLinesDialog options", () => {
  it("defaults to no-headers off and 100000 rows per file", async () => {
    renderDialog();

    const noHeadersBox = screen.getByLabelText(
      "No headers",
    ) as HTMLInputElement;
    expect(noHeadersBox.checked).toBe(false);
    expect(screen.getByRole("spinbutton")).toHaveValue(100000);

    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("split_lines", {
        path: "/tmp/input.csv",
        linesPerFile: 100000,
        outDir: null,
        noHeaders: false,
      });
    });
  });

  it("sends noHeaders: true and records it once the box is ticked", async () => {
    renderDialog();

    const noHeadersBox = screen.getByLabelText(
      "No headers",
    ) as HTMLInputElement;
    fireEvent.click(noHeadersBox);
    expect(noHeadersBox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "split_lines",
        expect.objectContaining({ noHeaders: true }),
      );
    });

    const raw = window.localStorage.getItem(SPLIT_LINES_HISTORY_KEY);
    expect(JSON.parse(raw as string)).toMatchObject({ noHeaders: true });
  });

  it("passes the rows-per-file field and the output directory through", async () => {
    renderDialog();

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "500" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("leave empty to use source file dir"),
      { target: { value: "/tmp/custom" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("split_lines", {
        path: "/tmp/input.csv",
        linesPerFile: 500,
        outDir: "/tmp/custom",
        noHeaders: false,
      });
    });
  });

  it("blocks the run when the file or the row count is missing", async () => {
    const { container } = renderDialog("");

    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Please select an input file");
    });

    fireEvent.change(screen.getByPlaceholderText("Input"), {
      target: { value: "/tmp/input.csv" },
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    await waitFor(() => {
      expect(container.textContent).toContain(
        "Lines per file must be an integer of at least 1",
      );
    });
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "split_lines",
      expect.anything(),
    );
  });
});

describe("SplitLinesDialog last result", () => {
  it("back-fills the stored options on open", async () => {
    seedStoredResult({ linesPerFile: 100, outDirInput: "/tmp/prev" });
    const { container } = renderDialog("/tmp/other.csv");

    // Let the output-directory existence check settle before asserting.
    await screen.findByRole("button", { name: "Open path" });

    expect(screen.getByRole("spinbutton")).toHaveValue(100);
    // The caller's file wins over the one stored in the record.
    expect(screen.getByPlaceholderText("Input")).toHaveValue("/tmp/other.csv");
    expect(
      screen.getByPlaceholderText("leave empty to use source file dir"),
    ).toHaveValue("/tmp/prev");
    expect(container.textContent).toContain("Last line split");
    expect(container.textContent).toContain("/tmp/prev/a_part1.csv");
  });

  it("persists a successful run and keeps showing it after edits", async () => {
    const { container } = renderDialog();

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Split" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Completed");
    });
    expect(container.textContent).toContain("Took 420 ms");
    expect(container.textContent).toContain("Files: 3");
    expect(container.textContent).toContain("Total rows: 5");
    expect(container.textContent).toContain("header copied");
    expect(container.textContent).toContain("/tmp/out/a_part3.csv");

    const raw = window.localStorage.getItem(SPLIT_LINES_HISTORY_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      outputDir: "/tmp/out",
      fileCount: 3,
      totalRows: 5,
      linesPerFile: 2,
      inputFile: "/tmp/input.csv",
      noHeaders: false,
    });

    // Editing an option clears the error but must not wipe the result.
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "3" },
    });
    expect(container.textContent).toContain("/tmp/out/a_part1.csv");
    expect(container.textContent).toContain("Last line split");
  });

  it("clears the stored record", async () => {
    seedStoredResult();
    const { container } = renderDialog();

    expect(container.textContent).toContain("Last line split");
    fireEvent.click(screen.getByRole("button", { name: "Clear record" }));

    expect(window.localStorage.getItem(SPLIT_LINES_HISTORY_KEY)).toBeNull();
    expect(container.textContent).toContain(
      "Pick a text file and a row count per file",
    );
  });

  it("opens the output directory in the file manager", async () => {
    seedStoredResult();
    renderDialog();

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeEnabled());
    fireEvent.click(openPath);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: ["/tmp/prev"],
      });
    });
  });

  it("disables opening once the output directory is gone", async () => {
    seedStoredResult();
    mockBackend(MOCK_RESULT, false);
    const { container } = renderDialog();

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeDisabled());
    expect(container.textContent).toContain("Output file no longer exists");
  });
});
