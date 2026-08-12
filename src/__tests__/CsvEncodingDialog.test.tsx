import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CsvEncodingDialog } from "@/components/dialog/CsvEncodingDialog";
import type { CsvEncodingResult } from "@/components/dialog/CsvEncodingDialog";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);
const mockSave = vi.mocked(save);

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
  mockOpen.mockResolvedValue("/tmp/input.csv");
  mockSave.mockResolvedValue("/tmp/output_utf8.csv");
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
