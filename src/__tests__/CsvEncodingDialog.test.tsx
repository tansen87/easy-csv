import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CsvEncodingDialog } from "@/components/dialog/CsvEncodingDialog";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);
const mockSave = vi.mocked(save);

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

    fireEvent.click(screen.getByText("Convert"));

    expect(mockInvoke).toHaveBeenCalledWith("convert_csv_encoding", {
      inputPath: "/tmp/input.csv",
      outputPath: "/tmp/output_utf8.csv",
      sourceEncoding: "auto",
      targetEncoding: "utf-8",
    });

    await screen.findByText("Conversion successful");
    expect(screen.getByText(/1024 bytes → 512 bytes/)).toBeInTheDocument();
  });

  it("shows error when files are missing", () => {
    render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByText("Convert"));
    expect(
      screen.getByText("Select input and output files"),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("shows error when source and target encodings are the same", () => {
    const { container } = render(
      <LanguageProvider>
        <CsvEncodingDialog isOpen onClose={vi.fn()} />
      </LanguageProvider>,
    );

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "/tmp/input.csv" } });
    fireEvent.change(inputs[1], { target: { value: "/tmp/output.csv" } });

    // Open the source-encoding select and pick UTF-8 (matches the target default).
    const sourceCombo = container.querySelectorAll("[role='combobox']")[0];
    fireEvent.focus(sourceCombo);
    const option = Array.from(
      container.querySelectorAll("[role='option']"),
    ).find((o) => o.textContent === "UTF-8");
    fireEvent.click(option!);

    fireEvent.click(screen.getByText("Convert"));
    expect(
      screen.getByText("Source and target encodings are the same"),
    ).toBeInTheDocument();
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

    fireEvent.click(screen.getByText("Convert"));
    expect(
      await screen.findByText(/Failed to write output file/),
    ).toBeInTheDocument();
  });
});
