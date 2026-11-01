import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { EnumerateByGroupDialog } from "@/modules/dialogs/file/EnumerateByGroupDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  GROUP_ENUM_HISTORY_KEY,
  type StoredGroupEnumResult,
} from "@/utils/groupEnumHistory";

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
  output_path: "/tmp/input_group_enum.csv",
  total_rows: 5,
  group_count: 2,
  index_column: "group_index",
  group_by_column: "region",
  sorted: false,
  delimiter: ",",
  elapsed_ms: 420,
};

function mockBackend(result: unknown = MOCK_RESULT, fileExists = true) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "probe_csv_file") return MOCK_PROBE;
    if (cmd === "enumerate_by_group") return result;
    if (cmd === "file_exists") return fileExists;
    return undefined;
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredGroupEnumResult> = {},
): StoredGroupEnumResult {
  const stored: StoredGroupEnumResult = {
    outputPath: "/tmp/prev_group_enum.csv",
    totalRows: 400,
    groupCount: 4,
    indexColumn: "seq",
    groupColumn: "region",
    sorted: false,
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
  window.localStorage.setItem(GROUP_ENUM_HISTORY_KEY, JSON.stringify(stored));
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
      <EnumerateByGroupDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
      />
    </LanguageProvider>,
  );
}

describe("EnumerateByGroupDialog options", () => {
  it("auto-picks the first header as group column and the default index name", async () => {
    renderDialog();

    const groupSelect = await screen.findByRole("combobox", {
      name: "Group col",
    });
    await waitFor(() => expect(groupSelect).toHaveValue("region"));
    expect(screen.getByLabelText("Index column name")).toHaveValue(
      "group_index",
    );

    fireEvent.click(screen.getByRole("button", { name: "Number" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("enumerate_by_group", {
        path: "/tmp/input.csv",
        groupByColumn: "region",
        indexColumn: "group_index",
        sorted: false,
        skiprows: 0,
        quoting: true,
        flexible: false,
        delimiter: ",",
        outDir: null,
      });
    });
  });

  it("passes the contiguous-groups flag, a custom index name and out dir", async () => {
    renderDialog();

    await screen.findByRole("combobox", { name: "Group col" });
    fireEvent.click(screen.getByLabelText("Groups are already contiguous"));
    fireEvent.click(
      screen.getByLabelText("Allow rows with a different field count"),
    );
    fireEvent.change(screen.getByLabelText("Index column name"), {
      target: { value: "seq" },
    });
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Group col" })).toHaveValue(
        "region",
      );
    });
    fireEvent.change(
      screen.getByPlaceholderText("leave empty to use source file dir"),
      { target: { value: "/tmp/out" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Number" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "enumerate_by_group",
        expect.objectContaining({
          sorted: true,
          flexible: true,
          indexColumn: "seq",
          outDir: "/tmp/out",
        }),
      );
    });
  });

  it("blocks the run when the file or the group column is missing", async () => {
    const { container } = renderDialog("");

    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    await waitFor(() => {
      expect(container.textContent).toContain("Please select an input file");
    });
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "enumerate_by_group",
      expect.anything(),
    );
  });

  it("previews the real output file name", () => {
    const { container } = renderDialog("/data/orders.csv");
    expect(container.textContent).toContain("orders_group_enum.csv");
  });
});

describe("EnumerateByGroupDialog last result", () => {
  it("back-fills the stored options on open", async () => {
    seedStoredResult();
    const { container } = renderDialog("/tmp/other.csv");

    await screen.findByRole("button", { name: "Open path" });

    expect(screen.getByLabelText("Index column name")).toHaveValue("seq");
    // The caller's file wins over the one stored in the record.
    expect(screen.getByPlaceholderText("Input")).toHaveValue("/tmp/other.csv");
    expect(
      screen.getByPlaceholderText("leave empty to use source file dir"),
    ).toHaveValue("/tmp/prev");
    expect(container.textContent).toContain("Last group numbering");
    expect(container.textContent).toContain("/tmp/prev_group_enum.csv");
  });

  it("persists a successful run and keeps showing it after edits", async () => {
    const { container } = renderDialog();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Group col" })).toHaveValue(
        "region",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Number" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Completed");
    });
    expect(container.textContent).toContain("Took 420 ms");
    expect(screen.getByLabelText("Data rows: 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Groups: 2")).toBeInTheDocument();
    expect(container.textContent).toContain("/tmp/input_group_enum.csv");

    const raw = window.localStorage.getItem(GROUP_ENUM_HISTORY_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      outputPath: "/tmp/input_group_enum.csv",
      totalRows: 5,
      groupCount: 2,
      indexColumn: "group_index",
      groupColumn: "region",
      inputFile: "/tmp/input.csv",
      sorted: false,
    });

    // Editing an option clears the error but must not wipe the result.
    fireEvent.change(screen.getByLabelText("Index column name"), {
      target: { value: "row_no" },
    });
    expect(container.textContent).toContain("/tmp/input_group_enum.csv");
    expect(container.textContent).toContain("Last group numbering");
  });

  it("clears the stored record", async () => {
    seedStoredResult();
    const { container } = renderDialog();

    expect(container.textContent).toContain("Last group numbering");
    fireEvent.click(screen.getByRole("button", { name: "Clear record" }));

    expect(window.localStorage.getItem(GROUP_ENUM_HISTORY_KEY)).toBeNull();
    expect(container.textContent).toContain(
      "Pick a CSV file, choose the group column",
    );
  });

  it("disables opening once the output file is gone", async () => {
    seedStoredResult();
    mockBackend(MOCK_RESULT, false);
    const { container } = renderDialog();

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeDisabled());
    expect(container.textContent).toContain("Output file no longer exists");
  });
});
