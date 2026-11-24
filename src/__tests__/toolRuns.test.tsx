import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ToolRunProvider,
  useToolRun,
  useToolRuns,
  type ToolRuns,
} from "@/hooks/useToolRuns";

/**
 * Design 077 · option C. Each tool dialog reports its own start/finish; the app
 * shell keeps the table so the Tools menu — and any dialog reopened mid-run —
 * can see that a run is still in flight.
 */
function Harness({ onRuns }: { onRuns: (runs: ToolRuns) => void }) {
  const { runs, actions } = useToolRuns();
  onRuns(runs);
  return (
    <ToolRunProvider runs={runs} actions={actions}>
      <Reporter tool="mergeExcel" />
      <Reporter tool="csvToExcel" />
    </ToolRunProvider>
  );
}

function Reporter({ tool }: { tool: "mergeExcel" | "csvToExcel" }) {
  const { begin, end, running } = useToolRun(tool);
  return (
    <div data-testid={`reporter-${tool}`} data-running={String(running)}>
      <button type="button" onClick={begin}>
        start-{tool}
      </button>
      <button type="button" onClick={end}>
        stop-{tool}
      </button>
    </div>
  );
}

const renderHarness = () => {
  const seen: ToolRuns[] = [];
  render(<Harness onRuns={(runs) => seen.push(runs)} />);
  return () => seen[seen.length - 1];
};

const reporter = (tool: string) => screen.getByTestId(`reporter-${tool}`);

describe("useToolRuns (design 077)", () => {
  it("records a start time and forgets it when the run ends", () => {
    const latest = renderHarness();
    expect(latest()).toEqual({});

    fireEvent.click(screen.getByText("start-mergeExcel"));
    expect(typeof latest().mergeExcel).toBe("number");

    fireEvent.click(screen.getByText("stop-mergeExcel"));
    expect(latest()).toEqual({});
  });

  it("tracks two tools independently", () => {
    const latest = renderHarness();
    fireEvent.click(screen.getByText("start-mergeExcel"));
    fireEvent.click(screen.getByText("start-csvToExcel"));

    expect(Object.keys(latest()).sort()).toEqual(["csvToExcel", "mergeExcel"]);

    fireEvent.click(screen.getByText("stop-mergeExcel"));
    expect(Object.keys(latest())).toEqual(["csvToExcel"]);
  });

  it("keeps the first start time when a second start arrives", () => {
    const latest = renderHarness();
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    fireEvent.click(screen.getByText("start-mergeExcel"));
    vi.setSystemTime(9_000);
    fireEvent.click(screen.getByText("start-mergeExcel"));
    vi.useRealTimers();

    expect(latest().mergeExcel).toBe(1_000);
  });

  it("exposes the run state to the dialog so it can refuse a second start", () => {
    renderHarness();
    expect(reporter("mergeExcel")).toHaveAttribute("data-running", "false");

    fireEvent.click(screen.getByText("start-mergeExcel"));
    expect(reporter("mergeExcel")).toHaveAttribute("data-running", "true");
    // The other tool is untouched.
    expect(reporter("csvToExcel")).toHaveAttribute("data-running", "false");

    fireEvent.click(screen.getByText("stop-mergeExcel"));
    expect(reporter("mergeExcel")).toHaveAttribute("data-running", "false");
  });

  it("does nothing without a provider (dialogs render alone in tests)", () => {
    render(<Reporter tool="csvToExcel" />);
    fireEvent.click(screen.getByText("start-csvToExcel"));
    expect(reporter("csvToExcel")).toHaveAttribute("data-running", "false");
  });
});
