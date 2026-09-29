import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { MergeExcelDialog } from "@/modules/dialogs/file/MergeExcelDialog";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { enDialog } from "@/i18n/translations/en/dialog";
import {
  EXCEL_MERGE_HISTORY_KEY,
  loadLastExcelMergeResult,
  type StoredExcelMergeResult,
} from "@/utils/excelMergeHistory";

/** English strings, so the assertions do not depend on the jsdom locale. */
function t(key: keyof typeof enDialog): string {
  return enDialog[key];
}

const mockInvoke = vi.mocked(invoke);
const mockOpen = vi.mocked(open);

const SCAN_RESULT = {
  files: [
    {
      path: "/data/a.xlsx",
      sheets: ["Q1", "Q2"],
      ok: true,
      error: null,
    },
  ],
  file_count: 1,
  sheet_names: ["Q1", "Q2"],
  warnings: [],
};

const MERGE_RESULT = {
  output_path: "/data/out/merged.csv",
  output_format: "csv",
  source_file_count: 2,
  sheet_count: 3,
  total_rows: 42,
  header: ["source", "id", "name"],
  skipped: ["c.xlsx (empty sheet)"],
  warnings: [],
  union_summary: {
    final_columns: ["source", "id", "name", "memo"],
    not_in_all_parts: [{ column: "memo", present_in: 1, total: 3 }],
    near_duplicate_columns: [["name", "Name"]],
  },
  elapsed_ms: 640,
};

const STORED: StoredExcelMergeResult = {
  outputPath: "/data/out/prev.xlsx",
  outputFormat: "xlsx",
  sourceFileCount: 2,
  sheetCount: 5,
  totalRows: 300,
  header: ["source", "id"],
  skipped: [],
  unionSummary: {
    finalColumns: ["source", "id", "memo"],
    notInAllParts: [{ column: "memo", presentIn: 1, total: 5 }],
    nearDuplicateColumns: [],
  },
  finishedAt: "2026-09-29T08:00:00.000Z",
  elapsedMs: 1200,
  sources: ["/data/in"],
  recursive: false,
  extensions: ["xlsx"],
  sheetMode: "all",
  sheetName: "",
  missingSheet: "error",
  align: "union",
  sourceColumn: "file_sheet",
  outputPathInput: "",
};

function mockBackend(
  overrides: {
    merge?: unknown;
    mergeError?: string;
    scan?: unknown;
    fileExists?: boolean;
  } = {},
) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "merge_excel_sources") {
      if (overrides.mergeError) throw overrides.mergeError;
      return overrides.merge ?? MERGE_RESULT;
    }
    if (cmd === "scan_excel_sources") return overrides.scan ?? SCAN_RESULT;
    if (cmd === "read_excel_header") return ["id", "name"];
    if (cmd === "file_exists") return overrides.fileExists ?? true;
    if (cmd === "reveal_paths") return undefined;
    return undefined;
  }) as unknown as typeof invoke);
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
  mockOpen.mockResolvedValue(null);
  mockBackend();
});

function renderDialog() {
  return render(
    <LanguageProvider>
      <MergeExcelDialog isOpen onClose={vi.fn()} />
    </LanguageProvider>,
  );
}

async function pickCombobox(name: string, optionLabel: string) {
  // The Select opens its listbox on focus (not on click).
  fireEvent.focus(screen.getByRole("combobox", { name }));
  fireEvent.click(await screen.findByRole("option", { name: optionLabel }));
}

describe("MergeExcelDialog", () => {
  it("sends the documented defaults (union / first sheet / no sheetIndex)", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    fireEvent.click(await screen.findByText(t("mergeExcelStart")));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "merge_excel_sources",
        expect.objectContaining({
          request: expect.objectContaining({
            roots: ["/data/a.xlsx"],
            recursive: false,
            sheetMode: "first",
            align: "union",
            outputFormat: "xlsx",
            outputShape: "single",
          }),
        }),
      );
    });
    const payload = mockInvoke.mock.calls.find(
      ([cmd]) => cmd === "merge_excel_sources",
    )?.[1] as { request: Record<string, unknown> };
    expect(payload.request).not.toHaveProperty("sheetIndex");
  });

  it("intercepts the merge when no source is selected", async () => {
    renderDialog();
    fireEvent.click(screen.getByText(t("mergeExcelStart")));
    expect(
      await screen.findByText(t("mergeExcelNoSources")),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "merge_excel_sources",
      expect.anything(),
    );
  });

  it("renders the name-mode controls only in name mode", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));

    // Card-based sheet selection: the name select exists only in name mode.
    expect(
      screen.queryByRole("combobox", { name: t("mergeExcelSheetByName") }),
    ).toBeNull();

    fireEvent.click(screen.getByText(t("mergeExcelSheetByName")));

    expect(
      await screen.findByRole("combobox", { name: t("mergeExcelSheetByName") }),
    ).toBeInTheDocument();

    // The missing-sheet policy lives in the advanced section (design 025 §3.7).
    fireEvent.click(screen.getByText(t("mergeExcelAdvanced")));
    expect(
      screen.getByRole("combobox", { name: t("mergeExcelMissingSheet") }),
    ).toBeInTheDocument();
  });

  it("blocks the merge with an empty sheet name instead of falling back", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    fireEvent.click(screen.getByText(t("mergeExcelSheetByName")));
    fireEvent.click(await screen.findByText(t("mergeExcelStart")));

    expect(
      await screen.findByText(t("mergeExcelSheetNameEmpty")),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "merge_excel_sources",
      expect.anything(),
    );
  });

  it("shows the scan preview once and never probes sheet headers", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));

    // The debounced auto-scan fires ~500ms after the sources change; the
    // preview line "workbooks: 1" marks its completion (the bare word
    // "workbooks" also occurs in the empty-state hint, so be specific).
    await screen.findAllByText(/Auto-scanned/);

    const scanCalls = mockInvoke.mock.calls.filter(
      ([cmd]) => cmd === "scan_excel_sources",
    );
    expect(scanCalls).toHaveLength(1);
  });

  it("excludes a workbook from the preview and the merge payload", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    await screen.findAllByText(/Auto-scanned/);

    // × removes the workbook: dimmed row + restore control.
    fireEvent.click(
      screen.getByRole("button", {
        name: `${t("mergeExcelExclude")}: /data/a.xlsx`,
      }),
    );
    expect(screen.getByText(t("mergeExcelExcluded"))).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `${t("mergeExcelRestore")}: /data/a.xlsx`,
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText(t("mergeExcelStart")));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "merge_excel_sources",
        expect.objectContaining({
          request: expect.objectContaining({
            exclude: ["/data/a.xlsx"],
          }),
        }),
      );
    });

    // ↩ restores the workbook.
    fireEvent.click(
      screen.getByRole("button", {
        name: `${t("mergeExcelRestore")}: /data/a.xlsx`,
      }),
    );
    expect(screen.queryByText(t("mergeExcelExcluded"))).toBeNull();
  });

  it("passes a backend error (strict headers) through to the banner", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    mockBackend({
      mergeError: 'Inconsistent headers (strict mode): expected ["id"]',
    });
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));

    // Strict alignment lives in the advanced section.
    fireEvent.click(screen.getByText(t("mergeExcelAdvanced")));
    await pickCombobox(t("mergeExcelAlign"), t("mergeExcelAlignStrict"));
    fireEvent.click(await screen.findByText(t("mergeExcelStart")));

    expect(
      await screen.findByText(/Inconsistent headers \(strict mode\)/),
    ).toBeInTheDocument();
  });

  it("shows the union widening and near-duplicate hints after a merge", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    fireEvent.click(await screen.findByText(t("mergeExcelStart")));

    expect(await screen.findByText(/memo/)).toBeInTheDocument();
    expect(screen.getByText(/Name/)).toBeInTheDocument();
  });

  it("notes the single-sheet limitation for xlsx output", async () => {
    seedStored({ outputFormat: "xlsx" });
    renderDialog();
    expect(await screen.findByText(/Sheet1/)).toBeInTheDocument();
  });

  it("shows the last result on open and reveals the output path", async () => {
    seedStored();
    renderDialog();
    expect(await screen.findByText("/data/out/prev.xlsx")).toBeInTheDocument();

    fireEvent.click(screen.getByText(t("openPath")));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: ["/data/out/prev.xlsx"],
      });
    });
  });

  it("greys out reveal when the stored output disappeared", async () => {
    seedStored();
    mockBackend({ fileExists: false });
    renderDialog();

    const reveal = await screen.findByText(t("openPath"));
    expect(reveal).toBeDisabled();
    expect(
      await screen.findByText(t("lastResultNoOutput")),
    ).toBeInTheDocument();
  });

  it("clears the stored record", async () => {
    seedStored();
    renderDialog();
    fireEvent.click(await screen.findByText(t("clearRecord")));
    expect(loadLastExcelMergeResult()).toBeNull();
  });

  it("requires an explicit sheet selection for by-sheet output", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    await screen.findAllByText(/Auto-scanned/);

    await pickCombobox(t("mergeExcelShape"), t("mergeExcelShapeBySheet"));

    // Nothing checked → intercepted, never a silent fallback to "all names".
    fireEvent.click(screen.getByText(t("mergeExcelStart")));
    expect(
      await screen.findByText(t("mergeExcelSheetFilterEmpty")),
    ).toBeInTheDocument();
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "merge_excel_sources",
      expect.anything(),
    );

    // Checking exactly one name sends exactly that filter (design 026 §4.1).
    fireEvent.click(screen.getByRole("checkbox", { name: "Q1" }));
    fireEvent.click(screen.getByText(t("mergeExcelStart")));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "merge_excel_sources",
        expect.objectContaining({
          request: expect.objectContaining({
            outputShape: "by_sheet",
            sheetNamesFilter: ["Q1"],
            outputDir: "",
          }),
        }),
      );
    });
  });

  it("locks xlsx output and hides alignment for the multi-sheet shape", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    await screen.findAllByText(/Auto-scanned/);

    await pickCombobox(t("mergeExcelShape"), t("mergeExcelShapeMultiSheet"));

    // The format select is replaced by a locked XLSX badge, alignment is
    // hidden (each output sheet is a single part), and the per-workbook
    // sheet-mode cards stay.
    expect(
      screen.queryByRole("combobox", { name: t("mergeExcelOutputFormat") }),
    ).toBeNull();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
    fireEvent.click(screen.getByText(t("mergeExcelAdvanced")));
    expect(
      screen.queryByRole("combobox", { name: t("mergeExcelAlign") }),
    ).toBeNull();
    expect(screen.getByText(t("mergeExcelSheetAll"))).toBeInTheDocument();

    fireEvent.click(screen.getByText(t("mergeExcelStart")));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "merge_excel_sources",
        expect.objectContaining({
          request: expect.objectContaining({
            outputShape: "multi_sheet",
            outputFormat: "xlsx",
          }),
        }),
      );
    });
  });

  it("lists by-sheet outputs and name conflicts in the result card", async () => {
    mockOpen.mockResolvedValue(["/data/a.xlsx"]);
    mockBackend({
      merge: {
        ...MERGE_RESULT,
        output_path: "/data/out/s1.xlsx",
        outputs: [
          {
            path: "/data/out/s1.xlsx",
            source_file_count: 2,
            sheet_count: 2,
            total_rows: 10,
            header: ["source", "id"],
          },
          {
            path: "/data/out/s2.xlsx",
            source_file_count: 2,
            sheet_count: 2,
            total_rows: 12,
            header: ["source", "id"],
          },
        ],
        name_mappings: [["S1", "S1_2"]],
      },
    });
    renderDialog();
    fireEvent.click(await screen.findByText(t("mergeExcelAddFiles")));
    await screen.findAllByText(/Auto-scanned/);
    await pickCombobox(t("mergeExcelShape"), t("mergeExcelShapeBySheet"));
    fireEvent.click(screen.getByRole("checkbox", { name: "Q1" }));
    fireEvent.click(screen.getByText(t("mergeExcelStart")));

    expect(await screen.findByText(/s1\.xlsx, s2\.xlsx/)).toBeInTheDocument();
    expect(
      await screen.findByText(/Name conflict: S1 → S1_2/),
    ).toBeInTheDocument();
  });

  it("notes the sheet naming rule for a multi-sheet result", async () => {
    seedStored({ outputShape: "multi_sheet", outputFormat: "xlsx" });
    renderDialog();
    expect(await screen.findByText(/multi-sheet workbook/)).toBeInTheDocument();
    expect(screen.queryByText(/Sheet1/)).toBeNull();
  });

  function seedStored(overrides: Partial<StoredExcelMergeResult> = {}): void {
    window.localStorage.setItem(
      EXCEL_MERGE_HISTORY_KEY,
      JSON.stringify({ ...STORED, ...overrides }),
    );
  }
});
