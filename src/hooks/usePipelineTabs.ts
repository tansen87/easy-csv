import { useCallback } from "react";
import type { PipelineEdge, PipelineStep, PipelineTab } from "@/types/xan";
import { resolveRunDelimiter } from "@/hooks/execution/resolveDelimiter";

interface UsePipelineTabsProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  defaultDelimiter: string;
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>;
  setSelectedTabId: React.Dispatch<React.SetStateAction<string>>;
  setUndoStack: React.Dispatch<
    React.SetStateAction<
      Array<{
        pipeline: PipelineStep[];
        edges: PipelineEdge[];
        inputPosition?: { x: number; y: number };
      }>
    >
  >;
  setRedoStack: React.Dispatch<
    React.SetStateAction<
      Array<{
        pipeline: PipelineStep[];
        edges: PipelineEdge[];
        inputPosition?: { x: number; y: number };
      }>
    >
  >;
  setSelectedStep: React.Dispatch<React.SetStateAction<PipelineStep | null>>;
  formatDateTime: (date: Date) => string;
}

/**
 * Cross-domain tab/pipeline state helpers shared by the fileIO and execution
 * hooks. Stateless (callbacks only) — safe to destructure once in the app
 * assembly layer and pass down.
 */
export function usePipelineTabs({
  tabs,
  selectedTabId,
  defaultDelimiter,
  setTabs,
  setSelectedTabId,
  setUndoStack,
  setRedoStack,
  setSelectedStep,
  formatDateTime,
}: UsePipelineTabsProps) {
  const getCurrentTab = useCallback(() => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  }, [tabs, selectedTabId]);

  const getCurrentPipeline = useCallback(() => {
    return getCurrentTab().pipeline;
  }, [getCurrentTab]);

  /** Keep "what you see is what runs" (design 018). Pure impl in execution/. */
  const resolveRunDelimiterForTab = useCallback(
    () => resolveRunDelimiter(getCurrentTab(), defaultDelimiter),
    [getCurrentTab, defaultDelimiter],
  );

  const updateTabPipeline = useCallback(
    (
      tabIdOrPipeline: string | PipelineStep[],
      newPipeline?: PipelineStep[],
      edges?: PipelineEdge[],
      inputPosition?: { x: number; y: number },
    ) => {
      const currentTab =
        typeof tabIdOrPipeline === "string"
          ? tabs.find((t) => t.id === tabIdOrPipeline)
          : tabs.find((t) => t.id === selectedTabId);

      const newPipelineToSet =
        typeof tabIdOrPipeline === "string"
          ? newPipeline!
          : (tabIdOrPipeline as PipelineStep[]);
      const isStateChanged =
        currentTab &&
        (JSON.stringify(currentTab.pipeline) !==
          JSON.stringify(newPipelineToSet) ||
          JSON.stringify(currentTab.edges) !==
            JSON.stringify(edges ?? currentTab.edges) ||
          JSON.stringify(currentTab.inputPosition) !==
            JSON.stringify(inputPosition ?? currentTab.inputPosition));

      if (currentTab && isStateChanged) {
        setUndoStack((prev) => [
          ...prev,
          {
            pipeline: currentTab.pipeline,
            edges: currentTab.edges || [],
            inputPosition: currentTab.inputPosition,
          },
        ]);
        setRedoStack([]);
      }

      if (typeof tabIdOrPipeline === "string" && newPipeline) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabIdOrPipeline
              ? {
                  ...tab,
                  pipeline: newPipeline,
                  edges: edges !== undefined ? edges : tab.edges,
                  inputPosition:
                    inputPosition !== undefined
                      ? inputPosition
                      : tab.inputPosition,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      } else {
        const pipeline = tabIdOrPipeline as PipelineStep[];
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === selectedTabId
              ? {
                  ...tab,
                  pipeline: pipeline,
                  edges: edges !== undefined ? edges : tab.edges,
                  inputPosition:
                    inputPosition !== undefined
                      ? inputPosition
                      : tab.inputPosition,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      }
    },
    [tabs, selectedTabId, setUndoStack, setRedoStack, setTabs, formatDateTime],
  );

  const addNewTab = useCallback((): string => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: PipelineTab = {
      id: newTabId,
      name: `Tab${tabs.length + 1}`,
      pipeline: [],
      created: formatDateTime(new Date()),
      updated: formatDateTime(new Date()),
    };
    setTabs((prev) => [...prev, newTab]);
    setSelectedTabId(newTabId);
    setSelectedStep(null);
    return newTabId;
  }, [tabs.length, setTabs, setSelectedTabId, setSelectedStep, formatDateTime]);

  return {
    getCurrentTab,
    getCurrentPipeline,
    resolveRunDelimiter: resolveRunDelimiterForTab,
    updateTabPipeline,
    addNewTab,
  };
}
