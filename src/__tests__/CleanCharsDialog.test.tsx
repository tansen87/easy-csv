import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { CleanCharsDialog } from "@/modules/dialogs/file/CleanCharsDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  CLEAN_CHARS_HISTORY_KEY,
  type StoredCleanCharsResult,
} from "@/utils/cleanCharsHistory";

const mockInvoke = vi.mocked(invoke);

const MOCK_PROBE = {
  path: "/tmp/input.csv",
  delimiter: ",",
  source: "detected",
  confidence: "high",
  columns: 4,
  header: ["id", "name", "city", "note"],
  sample_rows: [["1", "tom", "bj", "hi"]],
  sampled_records: 12,
  truncated: false,
  quoting_used: false,
  candidates: [],
};

const MOCK_RESULT = {
  output_path: "/tmp/input_clean.csv",
  rows: 9,
  removed_chars: 12,
  replaced_chars: 3,
  unclosed_lines: 0,
  elapsed_ms: 120,
};

function mockBackend(result: unknown = MOCK_RESULT, fileExists = true) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "probe_csv_file") return MOCK_PROBE;
    if (cmd === "clean_special_chars") return result;
    if (cmd === "file_exists") return fileExists;
    return undefined;
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredCleanCharsResult> = {},
): StoredCleanCharsResult {
  const stored: StoredCleanCharsResult = {
    outputPath: "/tmp/prev_clean.csv",
    rows: 12,
    removedChars: 30,
    replacedChars: 4,
    unclosedLines: 0,
    finishedAt: "2026-11-19T06:32:00.000Z",
    elapsedMs: 620,
    inputFile: "/tmp/input.csv",
    removeCr: true,
    mergeBlankLines: true,
    tabToSpace: true,
    removeQuotes: true,
    customChars: "",
    mergeQuotedNewlines: false,
    ...overrides,
  };
  window.localStorage.setItem(CLEAN_CHARS_HISTORY_KEY, JSON.stringify(stored));
  return stored;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mockBackend();
});

function renderDialog(initialInputFile = "/tmp/input.csv") {
  return render(
    <LanguageProvider>
      <CleanCharsDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
      />
    </LanguageProvider>,
  );
}

describe("CleanCharsDialog", () => {
  it("defaults to the four character options with the output next to the input", () => {
    renderDialog();

    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    // cr, blank lines, tab, quote, then the quoted-newline merge option.
    expect(checkboxes).toHaveLength(5);
    expect(checkboxes.slice(0, 4).every((box) => box.checked)).toBe(true);
    expect(checkboxes[4].checked).toBe(false);

    expect(screen.getByDisplayValue("/tmp/input_clean.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean" })).toBeEnabled();
  });

  it("passes the selected options to the backend", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Clean" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("clean_special_chars", {
        path: "/tmp/input.csv",
        outPath: "/tmp/input_clean.csv",
        removeCr: true,
        mergeBlankLines: true,
        tabToSpace: true,
        removeQuotes: true,
        customChars: "",
        mergeQuotedNewlines: false,
      });
    });

    expect(await screen.findByText("/tmp/input_clean.csv")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("disables the primary action when nothing is selected", () => {
    renderDialog();

    const checkboxes = screen.getAllByRole("checkbox");
    for (const box of checkboxes) {
      if ((box as HTMLInputElement).checked) fireEvent.click(box);
    }

    expect(screen.getByRole("button", { name: "Clean" })).toBeDisabled();
    expect(
      screen.getByText("Select at least one thing to clean"),
    ).toBeInTheDocument();
  });

  it("restores the last result from storage", async () => {
    seedStoredResult();
    renderDialog();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("file_exists", {
        filePath: "/tmp/prev_clean.csv",
      });
    });
    expect(screen.getByText("/tmp/prev_clean.csv")).toBeInTheDocument();
    expect(screen.getByText("Last run")).toBeInTheDocument();
  });
});
