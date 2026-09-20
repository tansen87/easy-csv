import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "@/i18n";
import { SeparateCSVDialog } from "@/components/dialog/SeparateCSVDialog";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverMock;
});

function renderDialog(initialInputFile = "/tmp/input.csv") {
  return render(
    <LanguageProvider>
      <SeparateCSVDialog
        isOpen
        onClose={vi.fn()}
        initialInputFile={initialInputFile}
      />
    </LanguageProvider>,
  );
}

describe("SeparateCSVDialog streaming option", () => {
  it("defaults to streaming off and passes streaming: false", async () => {
    mockInvoke.mockResolvedValue({
      good_path: "/tmp/input_good.csv",
      bad_path: "/tmp/input_bad.csv",
      good_rows: 3,
      bad_rows: 1,
      expected_columns: 2,
    });

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
    mockInvoke.mockResolvedValue({
      good_path: "/tmp/input_good.csv",
      bad_path: "/tmp/input_bad.csv",
      good_rows: 0,
      bad_rows: 0,
      expected_columns: 2,
    });

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
