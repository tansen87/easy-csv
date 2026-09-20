import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { SeparateCSVDialog } from "@/modules/dialogs/file/SeparateCSVDialog";
import { invoke } from "@tauri-apps/api/core";
import {
  SEPARATE_HISTORY_KEY,
  type StoredSeparateResult,
} from "@/utils/separateHistory";

const mockInvoke = vi.mocked(invoke);

const MOCK_PROBE = {
  path: "/tmp/input.csv",
  delimiter: ",",
  source: "detected",
  confidence: "high",
  columns: 6,
  header: ["id", "name", "age", "city", "qty", "amount"],
  sample_rows: [["1", "tom", "20", "bj", "2", "3"]],
  sampled_records: 42,
  truncated: false,
  quoting_used: true,
  candidates: [
    {
      delimiter: ",",
      header_fields: 6,
      fields: 6,
      consistent: true,
      score: 101,
    },
  ],
};

const MOCK_RESULT = {
  good_path: "/tmp/input_good.csv",
  bad_path: "/tmp/input_bad.csv",
  good_rows: 3,
  bad_rows: 1,
  expected_columns: 6,
  elapsed_ms: 420,
};

function mockBackend(
  probe: unknown = MOCK_PROBE,
  result: unknown = MOCK_RESULT,
  probeRejects = false,
  fileExists = true,
) {
  mockInvoke.mockImplementation((async (cmd: string) => {
    if (cmd === "probe_csv_file") {
      if (probeRejects) throw new Error("boom");
      return probe;
    }
    if (cmd === "separate_csv") return result;
    if (cmd === "file_exists") return fileExists;
    return undefined;
  }) as unknown as typeof invoke);
}

function seedStoredResult(
  overrides: Partial<StoredSeparateResult> = {},
): StoredSeparateResult {
  const stored: StoredSeparateResult = {
    goodPath: "/tmp/prev_good.csv",
    badPath: "/tmp/prev_bad.csv",
    goodRows: 12,
    badRows: 3,
    expectedColumns: 6,
    finishedAt: "2026-09-20T08:12:33.000Z",
    elapsedMs: 1500,
    inputFile: "/tmp/input.csv",
    delimiter: ";",
    quoting: true,
    skiprows: 0,
    streaming: false,
    expectedColumnsInput: "",
    ...overrides,
  };
  window.localStorage.setItem(SEPARATE_HISTORY_KEY, JSON.stringify(stored));
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

function renderDialog(
  initialInputFile = "/tmp/input.csv",
  defaultDelimiter?: string,
  onDefaultDelimiterChange?: (delimiter: string) => void,
) {
  return render(
    <LanguageProvider>
      <SeparateCSVDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
        defaultDelimiter={defaultDelimiter}
        onDefaultDelimiterChange={onDefaultDelimiterChange}
      />
    </LanguageProvider>,
  );
}

describe("SeparateCSVDialog streaming option", () => {
  it("defaults to streaming off and passes streaming: false", async () => {
    renderDialog();

    const checkboxes = screen.getAllByRole("checkbox");
    const streamingBox = screen.getByLabelText(
      "Streaming (large files)",
    ) as HTMLInputElement;
    expect(streamingBox).toBeInTheDocument();
    expect(streamingBox.checked).toBe(false);
    // quoting is the first checkbox, streaming the second
    expect(checkboxes[1]).toBe(streamingBox);

    fireEvent.click(screen.getByRole("button", { name: "Separate" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "separate_csv",
        expect.objectContaining({
          path: "/tmp/input.csv",
          streaming: false,
        }),
      );
    });
  });

  it("sends streaming: true once the checkbox is ticked", async () => {
    renderDialog();

    const streamingBox = screen.getByLabelText(
      "Streaming (large files)",
    ) as HTMLInputElement;
    fireEvent.click(streamingBox);
    expect(streamingBox.checked).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Separate" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "separate_csv",
        expect.objectContaining({ streaming: true }),
      );
    });
  });

  it("resets streaming to off when the dialog is reopened", async () => {
    const { rerender } = renderDialog();

    const streamingBox = () =>
      screen.getByLabelText("Streaming (large files)") as HTMLInputElement;

    fireEvent.click(streamingBox());
    expect(streamingBox().checked).toBe(true);

    rerender(
      <LanguageProvider>
        <SeparateCSVDialog
          isOpen={false}
          onClose={vi.fn()}
          initialInputFile="/tmp/input.csv"
        />
      </LanguageProvider>,
    );
    rerender(
      <LanguageProvider>
        <SeparateCSVDialog
          isOpen
          onClose={vi.fn()}
          initialInputFile="/tmp/input.csv"
        />
      </LanguageProvider>,
    );

    expect(streamingBox().checked).toBe(false);
  });
});

describe("SeparateCSVDialog file info", () => {
  it("shows the first row's column count and a header preview", async () => {
    const { container } = renderDialog();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "probe_csv_file",
        expect.objectContaining({
          path: "/tmp/input.csv",
          delimiter: null,
          fallbackDelimiter: ",",
          skiprows: 0,
          quoting: true,
        }),
      );
    });

    await waitFor(() => {
      expect(container.textContent).toContain("First row: 6");
    });
    expect(container.textContent).toContain("id | name | age | city");
    expect(container.textContent).toContain("Detected");
    // expected-columns placeholder reflects the probed column count
    expect(
      screen.getByPlaceholderText(/Blank \(from header\) · 6/),
    ).toBeTruthy();
  });

  it("auto-applies a detected delimiter to the split", async () => {
    mockBackend({ ...MOCK_PROBE, delimiter: ";", confidence: "high" });
    const { container } = renderDialog();

    // The control stays on "Auto-detect"; the resolved delimiter is reported
    // next to it.
    await waitFor(() => {
      expect(container.textContent).toContain("Detected「;」");
    });
    expect(screen.getByRole("combobox")).toHaveValue("Auto-detect");

    fireEvent.click(screen.getByRole("button", { name: "Separate" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "separate_csv",
        expect.objectContaining({ delimiter: ";" }),
      );
    });
  });

  it("keeps a manually picked delimiter instead of the detected one", async () => {
    mockBackend({ ...MOCK_PROBE, delimiter: ";" });
    const { container } = renderDialog();

    await waitFor(() => {
      expect(container.textContent).toContain("Detected「;」");
    });

    // Pick comma explicitly.
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Comma (,)" }));
    expect(screen.getByRole("combobox")).toHaveValue("Comma (,)");

    fireEvent.click(screen.getByRole("button", { name: "Separate" }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "separate_csv",
        expect.objectContaining({ delimiter: "," }),
      );
    });
  });

  it("warns when no delimiter could be detected", async () => {
    mockBackend({
      ...MOCK_PROBE,
      delimiter: ",",
      source: "fallback",
      confidence: "none",
    });
    const { container } = renderDialog();

    await waitFor(() => {
      expect(container.textContent).toContain("No delimiter detected");
    });
    expect(container.textContent).toContain("First row: 6");
  });

  it("surfaces a probe error without blocking the split button", async () => {
    mockBackend(MOCK_PROBE, MOCK_RESULT, true);
    const { container } = renderDialog();

    await waitFor(() => {
      expect(container.textContent).toContain("Failed to read file info");
    });
    expect(screen.getByRole("button", { name: "Separate" })).toBeEnabled();
  });

  it("saves the effective delimiter as the app default", async () => {
    const onDefaultDelimiterChange = vi.fn();
    mockBackend({ ...MOCK_PROBE, delimiter: ";" });
    renderDialog("/tmp/input.csv", ",", onDefaultDelimiterChange);

    const saveAsDefault = await screen.findByRole("button", {
      name: "Set as default",
    });
    // Disabled until the detected delimiter differs from the app default.
    await waitFor(() => expect(saveAsDefault).toBeEnabled());
    fireEvent.click(saveAsDefault);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("set_default_delimiter", {
        delimiter: ";",
      });
    });
    expect(onDefaultDelimiterChange).toHaveBeenCalledWith(";");
  });
});

describe("SeparateCSVDialog last result", () => {
  it("restores the previous result and completion time on open", async () => {
    seedStoredResult();
    const { container } = renderDialog();

    await waitFor(() => {
      expect(container.textContent).toContain("Last run");
    });
    expect(container.textContent).toContain("Finished at");
    expect(container.textContent).toContain("2026-09-20");
    expect(container.textContent).toContain("/tmp/prev_good.csv");
    expect(container.textContent).toContain("/tmp/prev_bad.csv");
    expect(
      screen.getByRole("button", { name: "Clear record" }),
    ).toBeInTheDocument();
  });

  it("persists a successful run and keeps showing it after edits", async () => {
    const { container } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Separate" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Completed");
    });
    expect(container.textContent).toContain("Took 420 ms");
    expect(container.textContent).toContain("/tmp/input_good.csv");

    const raw = window.localStorage.getItem(SEPARATE_HISTORY_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({
      goodPath: "/tmp/input_good.csv",
      badPath: "/tmp/input_bad.csv",
      goodRows: 3,
      badRows: 1,
      streaming: false,
    });

    // Editing an option clears the error but must not wipe the result.
    fireEvent.change(screen.getByPlaceholderText(/Blank \(from header\)/), {
      target: { value: "5" },
    });
    expect(container.textContent).toContain("/tmp/input_good.csv");
    expect(container.textContent).toContain("Last run");
  });

  it("clears the stored record", async () => {
    seedStoredResult();
    const { container } = renderDialog();

    await waitFor(() => {
      expect(container.textContent).toContain("Last run");
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear record" }));

    expect(window.localStorage.getItem(SEPARATE_HISTORY_KEY)).toBeNull();
    expect(container.textContent).toContain(
      "Pick a CSV file and click Separate",
    );
  });

  it("opens the output location in the file manager", async () => {
    seedStoredResult();
    renderDialog();

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeEnabled());
    fireEvent.click(openPath);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reveal_paths", {
        paths: ["/tmp/prev_good.csv", "/tmp/prev_bad.csv"],
      });
    });
  });

  it("disables opening once both output files are gone", async () => {
    seedStoredResult();
    mockBackend(MOCK_PROBE, MOCK_RESULT, false, false);
    const { container } = renderDialog();

    const openPath = await screen.findByRole("button", { name: "Open path" });
    await waitFor(() => expect(openPath).toBeDisabled());
    expect(container.textContent).toContain("Output file no longer exists");
  });
});
