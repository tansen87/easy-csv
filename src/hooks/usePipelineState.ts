import { useState, useCallback } from "react";
import { PipelineStep, PipelineEdge, PipelineTab } from "@/types/xan";
import { formatDateTime } from "@/utils/format";

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => item === b[i]);
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

interface UndoEntry {
  pipeline: PipelineStep[];
  edges: PipelineEdge[];
  inputPosition?: { x: number; y: number };
}

export function usePipelineState(
  tabs: PipelineTab[],
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>,
  selectedTabId: string,
) {
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

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
        (!shallowEqual(currentTab.pipeline, newPipelineToSet) ||
          !shallowEqual(currentTab.edges, edges ?? currentTab.edges) ||
          !shallowEqual(
            currentTab.inputPosition,
            inputPosition ?? currentTab.inputPosition,
          ));

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
    [tabs, selectedTabId, setTabs],
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (!currentTab) return;

    const lastUndo = undoStack[undoStack.length - 1];

    setRedoStack((prev) => [
      ...prev,
      {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
      },
    ]);

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: lastUndo.pipeline,
              edges: lastUndo.edges,
              inputPosition: lastUndo.inputPosition,
              updatedAt: formatDateTime(new Date()),
            }
          : tab,
      ),
    );

    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, tabs, selectedTabId, setTabs]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (!currentTab) return;

    const lastRedo = redoStack[redoStack.length - 1];

    setUndoStack((prev) => [
      ...prev,
      {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
      },
    ]);

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: lastRedo.pipeline,
              edges: lastRedo.edges,
              inputPosition: lastRedo.inputPosition,
              updatedAt: formatDateTime(new Date()),
            }
          : tab,
      ),
    );

    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, tabs, selectedTabId, setTabs]);

  return {
    undoStack,
    redoStack,
    setUndoStack,
    setRedoStack,
    updateTabPipeline,
    undo,
    redo,
  };
}
