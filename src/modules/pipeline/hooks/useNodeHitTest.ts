import { useCallback } from "react";
import type { RefObject } from "react";
import type { Node } from "reactflow";
import type { FlowRect } from "@/modules/pipeline/lib/layout";

interface UseNodeHitTestArgs {
  nodes: Node[];
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  reactFlowInstance: RefObject<any>;
}

/**
 * Canvas hit-testing shared by the cut tool, the connect gesture and the
 * right-click context menus: exact node rectangles (measured from the DOM
 * when available) and point-in-node lookup.
 */
export function useNodeHitTest({
  nodes,
  reactFlowWrapper,
  reactFlowInstance,
}: UseNodeHitTestArgs) {
  // Node → flow coordinate rectangle. First Prefer using rendered width/height,
  // fallback to node's own width/height, finally use default.
  const getNodeRect = useCallback(
    (node: Node): FlowRect => {
      const nodeData = node as any;
      const fallback: FlowRect = {
        x: node.position.x,
        y: node.position.y,
        width: nodeData.width || nodeData.measured?.width || 200,
        height: nodeData.height || nodeData.measured?.height || 80,
      };

      if (!reactFlowWrapper.current || !reactFlowInstance.current)
        return fallback;

      const el = reactFlowWrapper.current.querySelector(
        `.react-flow__node[data-id="${node.id}"]`,
      );
      if (!el) return fallback;

      const b = el.getBoundingClientRect();
      const topLeft = reactFlowInstance.current.screenToFlowPosition({
        x: b.left,
        y: b.top,
      });
      const bottomRight = reactFlowInstance.current.screenToFlowPosition({
        x: b.right,
        y: b.bottom,
      });

      return {
        x: topLeft.x,
        y: topLeft.y,
        width: Math.max(bottomRight.x - topLeft.x, 1),
        height: Math.max(bottomRight.y - topLeft.y, 1),
      };
    },
    [reactFlowWrapper, reactFlowInstance],
  );

  // Check if click position is on a node.
  const getNodeAtPosition = useCallback(
    (clientX: number, clientY: number): string | null => {
      if (!reactFlowWrapper.current || !reactFlowInstance.current) return null;

      const flowPos = reactFlowInstance.current.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      for (const node of nodes) {
        const rect = getNodeRect(node);

        if (
          flowPos.x >= rect.x &&
          flowPos.x <= rect.x + rect.width &&
          flowPos.y >= rect.y &&
          flowPos.y <= rect.y + rect.height
        ) {
          return node.id;
        }
      }
      return null;
    },
    [nodes, getNodeRect, reactFlowWrapper, reactFlowInstance],
  );

  return { getNodeRect, getNodeAtPosition };
}
