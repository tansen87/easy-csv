import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { Node } from "reactflow";

/**
 * Design 073: canvas search merged into the menu-bar command field. The palette
 * selects a step in the app layer; this event asks the canvas to centre it and
 * flash the highlight. Kept as a window event so `App` does not need a handle on
 * the ReactFlow instance.
 */
export const FOCUS_STEP_EVENT = "easy-csv:focus-step";

interface UseStepFocusArgs {
  nodes: Node[];
  reactFlowInstance: RefObject<any>;
}

/**
 * Jump to a pipeline step and highlight it for a moment. Replaces the old
 * Ctrl+F canvas search (`useCanvasSearch`), which owned its own overlay.
 */
export function useStepFocus({ nodes, reactFlowInstance }: UseStepFocusArgs) {
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const timerRef = useRef<number | null>(null);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    const onFocusStep = (event: Event) => {
      const stepId = (event as CustomEvent<string>).detail;
      const node = nodesRef.current.find((n) => n.id === stepId);
      if (!node || !reactFlowInstance.current) return;

      // Same framing the old search overlay used for step nodes.
      reactFlowInstance.current.setCenter(
        node.position.x + 110,
        node.position.y + 45,
        {
          zoom: Math.max(reactFlowInstance.current.getZoom(), 0.8),
          duration: 400,
        },
      );

      setHighlightedNodeId(stepId);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setHighlightedNodeId(null);
        timerRef.current = null;
      }, 1500);
    };

    window.addEventListener(FOCUS_STEP_EVENT, onFocusStep);
    return () => {
      window.removeEventListener(FOCUS_STEP_EVENT, onFocusStep);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [reactFlowInstance]);

  return { highlightedNodeId };
}
