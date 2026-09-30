import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { LanguageProvider } from "@/i18n";
import type { PipelineTab } from "@/types/xan";

/**
 * Concurrency gate (design 028 §7.1, limit = 4).
 *
 * `runPipeline` is mocked to never settle, so every started run keeps its slot:
 * the fifth tab must wait in the queue instead of spawning a fifth process
 * chain, and cancelling a queued run must drop it without touching a slot.
 */

const runPipelineMock = vi.fn(() => new Promise<void>(() => {}));

vi.mock("@/hooks/execution/runPipeline", () => ({
  runPipeline: (...args: unknown[]) => runPipelineMock(...(args as [])),
}));

// Imported after the mock so useExecution picks up the mocked runner.
const { useExecution } = await import("@/hooks/execution/useExecution");

function makeTab(id: string): PipelineTab {
  return {
    id,
    name: id,
    created: "",
    updated: "",
    inputFile: "input.csv",
    pipeline: [
      {
        id: `${id}-step`,
        command: {
          id: "sort",
          name: "sort",
          category: "x",
          description: "",
          parameters: [],
        } as never,
        parameters: {},
      },
    ],
    edges: [],
  };
}

const TABS = ["t1", "t2", "t3", "t4", "t5"].map(makeTab);

function renderExecution() {
  const setTabs = vi.fn();
  const props = {
    selectedTabId: "t1",
    defaultDelimiter: ",",
    getCurrentTab: () => TABS[0],
    getTabById: (id: string) => TABS.find((tab) => tab.id === id),
    setSelectedTabId: vi.fn(),
    showToast: vi.fn(),
    addLog: vi.fn(),
    setTabs,
    setShowLogPanel: vi.fn(),
    setShowChartPanel: vi.fn(),
    setTabChart: vi.fn(),
    formatDateTime: () => "",
    saveVersion: vi.fn(async () => undefined),
  };

  return renderHook(() => useExecution(props), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <LanguageProvider>{children}</LanguageProvider>
    ),
  });
}

describe("concurrency limit (design 028 §7.1)", () => {
  beforeEach(() => {
    runPipelineMock.mockClear();
  });

  it("starts at most 4 runs and queues the rest", async () => {
    const { result } = renderExecution();

    for (const tab of TABS) {
      await act(async () => {
        await result.current.runTab(tab.id);
      });
    }

    expect(runPipelineMock).toHaveBeenCalledTimes(4);
    // The first four took a slot and are being started by the (mocked) runner
    // — it is the runner that flips them to "running", which never happens here.
    expect(result.current.runs["t1"].state).toBe("preparing");
    expect(result.current.runs["t4"].state).toBe("preparing");
    // The fifth one waits its turn instead of starting.
    expect(result.current.runs["t5"].state).toBe("queued");
  });

  it("treats a queued tab as busy and lets its run be cancelled", async () => {
    const { result } = renderExecution();

    for (const tab of TABS) {
      await act(async () => {
        await result.current.runTab(tab.id);
      });
    }

    expect(result.current.isTabExecuting("t5")).toBe(true);

    await act(async () => {
      await result.current.cancelRun("t5");
    });
    // Dropped from the queue: no session, and no fifth process started.
    expect(result.current.runs["t5"]).toBeUndefined();
    expect(runPipelineMock).toHaveBeenCalledTimes(4);
  });
});