import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CsvToExcelDialog } from "@/modules/dialogs/file/CsvToExcelDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  CSV_TO_EXCEL_HISTORY_KEY,
  type StoredCsvToExcelResult,
} from "@/utils/csvToExcelHistory";

const mockInvoke = vi.mocked(invoke);

const MOCK_PROBE = {
  path: "/tmp/input.csv",
  delimiter: ",",
  source: "detected",
  confidence: "high",
  columns: 3,
  header: ["region", "order_id", "amount"],
  sample_rows: [["north", "1", "10"]],
  sampled_records: 12,
  truncated: false,
  quoting_used: true,
  candidates: [
    {
      delimiter: ",",
      header_fields: 3,
      fields: 3,
      consistent: true,
      score: 60,
    },
  ],
};

const MOCK_RESULT = {
  output_path: "/tmp/input.xlsx",
  sheet_count: 1,
  total_rows: 5,
  columns: 3,
  multi: false,
  chunk_size: 100000,
  delimiter: ",",
  elapsed_ms: 900,
};

function mockBackend(result: unknown = MOCK_RESULT, fileExists = true) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "probe_csv_file") return MOCK_PROBE;
    if (cmd === "csv_to_xlsx") return result;
    if (cmd === "file_exists") return fileExists;
    return undefined;
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredCsvToExcelResult> = {},
): StoredCsvToExcelResult {
  const stored: StoredCsvToExcelResult = {
    outputPath: "/tmp/prev.xlsx",
    totalRows: 400,
    sheetCount: 2,
    columns: 6,
    multi: true,
    chunkSize: 300,
    finishedAt: "2026-09-20T08:12:33.000Z",
    elapsedMs: 1500,
    inputFile: "/tmp/prev.csv",
    outDirInput: "/tmp/prev",
    delimiterMode: "auto",
    ignoreQuoting: false,
    flexible: false,
    skiprows: 0,
    ...overrides,
  };
  window.localStorage.setItem(CSV_TO_EXCEL_HISTORY_KEY, JSON.stringify(stored));
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
      <CsvToExcelDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
      />
    </LanguageProvider>,
  );
}

describe("CsvToExcelDialog", () => {
  it("converts to a single sheet and shows the result summary", async () => {
    renderDialog();

    const modeSelect = await screen.findByRole("combobox", {
      name: "Output shape",
    });
    expect(modeSelect).toHaveValue("Single sheet");

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "csv_to_xlsx",
        expect.objectContaining({
          path: "/tmp/input.csv",
          multi: false,
          chunkSize: 100000,
          skiprows: 0,
          quoting: true,
          flexible: false,
          delimiter: ",",
          outDir: null,
        }),
      );
    });
    expect(screen.getByRole("group", { name: "Data rows: 5" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Worksheets: 1" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Columns: 3" })).toBeTruthy();
  });

  it("sends multi + chunk size in split mode", async () => {
    renderDialog();

    const modeSelect = await screen.findByRole("combobox", {
      name: "Output shape",
    });
    fireEvent.focus(modeSelect);
    fireEvent.click(
      screen.getByRole("option", { name: "Split across sheets" }),
    );

    const chunkInput = screen.getByLabelText("Rows per sheet");
    expect(chunkInput).toHaveValue(100000);
    fireEvent.change(chunkInput, { target: { value: "2" } });

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "csv_to_xlsx",
        expect.objectContaining({ multi: true, chunkSize: 2 }),
      );
    });
  });

  it("blocks the run when no file is selected", async () => {
    renderDialog("");

    fireEvent.click(screen.getByRole("button", { name: "Convert" }));

    expect(screen.getByText("Please select an input file")).toBeTruthy();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "csv_to_xlsx",
      expect.anything(),
    );
  });

  it("disables opening the last output once it is gone", async () => {
    seedStoredResult();
    mockBackend(MOCK_RESULT, false);
    renderDialog();

    expect(await screen.findByText("Last conversion")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open path" })).toBeDisabled();
    });
  });

  it("back-fills the stored options on open", async () => {
    seedStoredResult();
    renderDialog();

    expect(screen.getByRole("combobox", { name: "Output shape" })).toHaveValue(
      "Split across sheets",
    );
    expect(screen.getByLabelText("Rows per sheet")).toHaveValue(300);
    expect(screen.getByLabelText("Skip first N rows")).toHaveValue(0);
  });

  it("clears the stored record on request", async () => {
    seedStoredResult();
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Clear record" }));

    expect(window.localStorage.getItem(CSV_TO_EXCEL_HISTORY_KEY)).toBeNull();
    expect(screen.queryByText("Last conversion")).toBeNull();
  });
});
