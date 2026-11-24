import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Which one-shot tools are running right now (design 077 · option C).
 *
 * Each tool dialog owns its own `isRunning` flag for its buttons, but a dialog
 * can be closed while the backend call keeps going — after that nothing on
 * screen says the work is still in flight. Lifting only the *start time* to the
 * app shell lets the Tools menu show a quiet elapsed readout next to the tool's
 * name, without moving any of the dialogs' logic.
 */
export type ToolId =
  | "csvDiff"
  | "csvEncoding"
  | "separateGoodBad"
  | "cleanChars"
  | "splitLines"
  | "enumerateByGroup"
  | "csvToExcel"
  | "mergeExcel";

/** Tool id → epoch ms when its current run started. */
export type ToolRuns = Partial<Record<ToolId, number>>;

export interface ToolRunActions {
  begin: (tool: ToolId) => void;
  end: (tool: ToolId) => void;
}

/** What a dialog gets back: zero-arg actions bound to its own tool, plus state. */
export interface ToolRunState {
  begin: () => void;
  end: () => void;
  /** True while *any* run of this tool is in flight — including one that
   *  outlived the dialog that started it. */
  running: boolean;
  /** Epoch ms of that run, so a reopened dialog resumes the same clock. */
  startedAt?: number;
}

interface ToolRunContextValue extends ToolRunActions {
  runs: ToolRuns;
}

/** State lives in the shell; dialogs get the two actions through context. */
export function useToolRuns() {
  const [runs, setRuns] = useState<ToolRuns>({});

  const begin = useCallback((tool: ToolId) => {
    setRuns((prev) =>
      // A second start while one is in flight must not restart the clock.
      prev[tool] !== undefined ? prev : { ...prev, [tool]: Date.now() },
    );
  }, []);

  const end = useCallback((tool: ToolId) => {
    setRuns((prev) => {
      if (prev[tool] === undefined) return prev;
      const next = { ...prev };
      delete next[tool];
      return next;
    });
  }, []);

  const actions = useMemo(() => ({ begin, end }), [begin, end]);
  return { runs, actions };
}

export type ToolRunsState = ReturnType<typeof useToolRuns>;

const ToolRunContext = createContext<ToolRunContextValue | null>(null);

export function ToolRunProvider({
  runs,
  actions,
  children,
}: {
  runs: ToolRuns;
  actions: ToolRunActions;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ runs, ...actions }), [runs, actions]);
  return (
    <ToolRunContext.Provider value={value}>{children}</ToolRunContext.Provider>
  );
}

/**
 * Inside a tool dialog: `const { begin, end } = useToolRun("mergeExcel")`, then
 * `begin()` before the invoke and `end()` in the `finally`. Without a provider
 * (unit tests render dialogs on their own) both are no-ops.
 */
export function useToolRun(tool: ToolId): ToolRunState {
  const context = useContext(ToolRunContext);
  const startedAt = context?.runs[tool];
  return useMemo(
    () => ({
      begin: () => context?.begin(tool),
      end: () => context?.end(tool),
      running: startedAt !== undefined,
      startedAt,
    }),
    [context, tool, startedAt],
  );
}
