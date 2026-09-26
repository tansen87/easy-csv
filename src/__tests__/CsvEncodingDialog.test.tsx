import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CsvEncodingDialog } from "@/modules/dialogs/file/CsvEncodingDialog";
import type { CsvEncodingResult } from "@/modules/dialogs/file/CsvEncodingDialog";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  ENCODING_HISTORY_KEY,
  saveLastEncodingResult,
  type StoredEncodingResult,
} from "@/utils/encodingHistory";

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);
const mockSave = vi.mocked(save);

/** `file_exists` is the only read the dialog does besides the conversion itself. */
function mockBackend(fileExists = true) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "file_exists") return fileExists;
    return {
      output_path: "/tmp/output_utf8.csv",
      bytes_read: 1024,
      bytes_written: 512,
      elapsed_ms: 420,
    };
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredEncodingResult> = {},
): StoredEncodingResult {
  const stored: StoredEncodingResult = {
    outputPath: "/tmp/prev_utf8.csv",
    bytesRead: 2048,
    bytesWritten: 1024,
    finishedAt: "2026-09-21T08:12:33.000Z",
    elapsedMs: 1500,
    inputFile: "/tmp/prev.csv",
    sourceEncoding: "gbk",
    targetEncoding: "utf-8",
    ...overrides,
  };
  saveLastEncodingResult(stored);
  return stored;
}

function pickEncoding(
  container: HTMLElement,
  comboIndex: number,
  label: string,
) {
  const combo = container.querySelectorAll("[role='combobox']")[comboIndex];
  fireEvent.focus(combo);
  const option = Array.from(container.querySelectorAll("[role='option']")).find(
    (o) => o.textContent === label,
  );
  fireEvent.click(option!);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockOpen.mockResolvedValue("/tmp/input.csv");
  mockSave.mockResolvedValue("/tmp/output_utf8.csv");
  // `vi.clearAllMocks()` keeps implementations, so reset the backend explicitly.
  mockBackend();
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

describe("CsvEncodingDialog", () => {
  it("shows the empty-state hint when open", () => {
    render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    expect(screen.getByText("CSV Encoding")).toBeInTheDocument();
    expect(screen.getByText(/Choose an input file/)).toBeInTheDocument();
  });

  it("only enables Convert when encodings differ", () => {
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const convertButton = screen.getByRole("button", { name: "Convert" });
    expect(convertButton).toBeDisabled();

    pickEncoding(container, 0, "GBK / GB2312");
    expect(convertButton).toBeEnabled();
  });

  it("invokes convert_csv_encoding and renders result", async () => {
    mockInvoke.mockResolvedValue({
      output_path: "/tmp/output_utf8.csv",
      bytes_read: 1024,
      bytes_written: 512,
    });

    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output_utf8.csv" } });
    pickEncoding(container, 0, "GBK / GB2312");

    fireEvent.click(screen.getByText("Convert"));

    expect(mockInvoke).toHaveBeenCalledWith("convert_csv_encoding", {
      inputPath: "/tmp/input.csv",
      outputPath: "/tmp/output_utf8.csv",
      sourceEncoding: "gbk",
      targetEncoding: "utf-8",
    });

    await screen.findByText("Conversion successful");
    expect(screen.getByText(/1024 bytes → 512 bytes/)).toBeInTheDocument();
    expect(screen.getByText("/tmp/output_utf8.csv")).toBeInTheDocument();
  });

  it("shows error when files are missing", () => {
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    pickEncoding(container, 0, "GBK / GB2312");
    fireEvent.click(screen.getByText("Convert"));
    expect(
      screen.getByText("Select input and output files"),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("disables Convert and shows a hint when source and target encodings are the same", () => {
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output.csv" } });

    // Open the source-encoding select and pick UTF-8 (matches the target default).
    pickEncoding(container, 0, "UTF-8");

    expect(
      screen.getByText("Source and target encodings are the same"),
    ).toBeInTheDocument();
    const convertButton = screen.getByRole("button", { name: "Convert" });
    expect(convertButton).toBeDisabled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("handles invoke errors gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("Failed to write output file"));

    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output.csv" } });
    pickEncoding(container, 0, "GBK / GB2312");

    fireEvent.click(screen.getByText("Convert"));
    expect(
      await screen.findByText(/Failed to write output file/),
    ).toBeInTheDocument();
  });

  it("toasts the outcome when the dialog is closed during conversion", async () => {
    let resolveInvoke: (v: CsvEncodingResult) => void = () => {};
    mockInvoke.mockImplementation(
      () =>
        new Promise<CsvEncodingResult>((resolve) => {
          resolveInvoke = resolve;
        }),
    );
    const showToast = vi.fn();

    const { container, rerender } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} onShowToast={showToast} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output_utf8.csv" } });
    pickEncoding(container, 0, "GBK / GB2312");
    fireEvent.click(screen.getByText("Convert"));

    rerender(
      <LanguageProvider>
        <CsvEncodingDialog
          isOpen={false}
          onClose={vi.fn()}
          onShowToast={showToast}
        />
      </LanguageProvider>,
    );

    resolveInvoke({
      output_path: "/tmp/output_utf8.csv",
      bytes_read: 1024,
      bytes_written: 512,
    });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Conversion successful"),
        "success",
      ),
    );
  });

  it("toasts errors when the dialog is closed during conversion", async () => {
    let rejectInvoke: (e: Error) => void = () => {};
    mockInvoke.mockImplementation(
      () =>
        new Promise<CsvEncodingResult>((_, reject) => {
          rejectInvoke = reject;
        }),
    );
    const showToast = vi.fn();

    const { container, rerender } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} onShowToast={showToast} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output.csv" } });
    pickEncoding(container, 0, "GBK / GB2312");
    fireEvent.click(screen.getByText("Convert"));

    rerender(
      <LanguageProvider>
        <CsvEncodingDialog
          isOpen={false}
          onClose={vi.fn()}
          onShowToast={showToast}
        />
      </LanguageProvider>,
    );

    rejectInvoke(new Error("Failed to write output file"));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Failed to write output file"),
        "error",
      ),
    );
  });
});

describe("CsvEncodingDialog last result", () => {
  it("restores the previous conversion and pre-fills the form on open", async () => {
    seedStoredResult();
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("Last conversion");
    });
    expect(container.textContent).toContain("Finished at");
    expect(container.textContent).toContain("2026-09-21");
    expect(container.textContent).toContain("Took 1.5 s");
    expect(container.textContent).toContain("GBK / GB2312 → UTF-8");
    expect(container.textContent).toContain("/tmp/prev_utf8.csv");

    // The options that produced the record are restored too.
    const inputs = container.querySelectorAll("input");
    expect(inputs[0]).toHaveValue("/tmp/prev.csv");
    expect(inputs[1]).toHaveValue("/tmp/prev_utf8.csv");
    const combos = screen.getAllByRole("combobox");
    expect(combos[0]).toHaveValue("GBK / GB2312");
    expect(combos[1]).toHaveValue("UTF-8");

    expect(
      screen.getByRole("button", { name: "Clear record" }),
    ).toBeInTheDocument();
  });

  it("ignores the stored input file when the caller supplies one", async () => {
    seedStoredResult();
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog
          isOpen
          onClose={vi.fn()}
          initialInputFile="/tmp/tab.csv"
        />
      </LanguageProvider>,
    );

    // …while the record itself is still shown.
    await waitFor(() => {
      expect(container.textContent).toContain("Last conversion");
    });
    const inputs = container.querySelectorAll("input");
    expect(inputs[0]).toHaveValue("/tmp/tab.csv");
  });

  it("persists a successful run and keeps showing it after edits", async () => {
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output_utf8.csv" } });
    pickEncoding(container, 0, "GBK / GB2312");
    fireEvent.click(screen.getByText("Convert"));

    await waitFor(() => {
      expect(container.textContent).toContain("Conversion successful");
    });
    expect(container.textContent).toContain("Took 420 ms");
    expect(container.textContent).toContain("/tmp/output_utf8.csv");

    const raw = window.localStorage.getItem(ENCODING_HISTORY_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      outputPath: "/tmp/output_utf8.csv",
      bytesRead: 1024,
      bytesWritten: 512,
      inputFile: "/tmp/input.csv",
      sourceEncoding: "gbk",
      targetEncoding: "utf-8",
    });

    // Editing an option clears the error but must not wipe the result.
    fireEvent.change(inputs[0], { target: { value: "/tmp/other.csv" } });
    expect(container.textContent).toContain("/tmp/output_utf8.csv");
    expect(container.textContent).toContain("Last conversion");
  });

  it("clears the stored record", async () => {
    seedStoredResult();
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("Last conversion");
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear record" }));

    expect(window.localStorage.getItem(ENCODING_HISTORY_KEY)).toBeNull();
    expect(container.textContent).toContain("Choose an input file");
  });

  it("opens the output location in the file manager", async () => {
    seedStoredResult();
    render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeEnabled());
    fireEvent.click(openPath);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: ["/tmp/prev_utf8.csv"],
      });
    });
  });

  it("disables opening once the output file is gone", async () => {
    seedStoredResult();
    mockBackend(false);
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeDisabled());
    expect(container.textContent).toContain("Output file no longer exists");
  });
});
