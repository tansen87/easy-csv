import { Node, Edge, MarkerType } from "reactflow";
import dagre from "dagre";
import { PipelineStep, PipelineEdge } from "@/types/xan";

export interface RectLike {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface NodeRectSource {
  position: { x: number; y?: number };
  width?: number | null;
  height?: number | null;
}

const handlePrefix = (id: string) => (id === "table-node" ? "table-" : "");

const handleName = (id: string, side: string, role: "source" | "target") =>
  `${handlePrefix(id)}${side}-${role}`;

const toRect = (n?: NodeRectSource): RectLike | undefined => {
  if (!n) return undefined;
  return {
    x: n.position.x,
    y: n.position.y ?? 0,
    width: n.width ?? undefined,
    height: n.height ?? undefined,
  };
};

// 根据两个节点的相对位置,选择最合理的连接方向
export function resolveHandles(
  sourceId: string,
  targetId: string,
  sourceNode?: NodeRectSource,
  targetNode?: NodeRectSource,
): { sourceHandle: string; targetHandle: string } {
  const sourceRect = toRect(sourceNode);
  const targetRect = toRect(targetNode);

  // 无位置信息时退回默认:左右连接
  if (!sourceRect || !targetRect) {
    return {
      sourceHandle: handleName(sourceId, "right", "source"),
      targetHandle: handleName(targetId, "left", "target"),
    };
  }

  const sourceCenterX = sourceRect.x + (sourceRect.width ?? 0) / 2;
  const sourceCenterY = sourceRect.y + (sourceRect.height ?? 0) / 2;
  const targetCenterX = targetRect.x + (targetRect.width ?? 0) / 2;
  const targetCenterY = targetRect.y + (targetRect.height ?? 0) / 2;

  const dx = targetCenterX - sourceCenterX;
  const dy = targetCenterY - sourceCenterY;

  // 纵向位移占主导 → 走上下连接,避免绕线
  if (Math.abs(dy) >= Math.abs(dx)) {
    if (dy >= 0) {
      return {
        sourceHandle: handleName(sourceId, "bottom", "source"),
        targetHandle: handleName(targetId, "top", "target"),
      };
    }
    return {
      sourceHandle: handleName(sourceId, "top", "source"),
      targetHandle: handleName(targetId, "bottom", "target"),
    };
  }

  // 横向位移占主导 → 保持左右连接
  if (dx >= 0) {
    return {
      sourceHandle: handleName(sourceId, "right", "source"),
      targetHandle: handleName(targetId, "left", "target"),
    };
  }
  return {
    sourceHandle: handleName(sourceId, "left", "source"),
    targetHandle: handleName(targetId, "right", "target"),
  };
}

// 根据 handle 名返回对应边的中点
export function handleAnchor(
  rect: { x: number; y: number; width: number; height: number },
  handle: string,
): { x: number; y: number } {
  const { x, y, width, height } = rect;
  if (handle.includes("left")) return { x, y: y + height / 2 };
  if (handle.includes("right")) return { x: x + width, y: y + height / 2 };
  if (handle.includes("top")) return { x: x + width / 2, y };
  return { x: x + width / 2, y: y + height };
}

// 计算边的起点/终点几何(用于切割碰撞检测)
export function getEdgeEndpoints(
  sourceId: string,
  targetId: string,
  sourceRect: { x: number; y: number; width: number; height: number },
  targetRect: { x: number; y: number; width: number; height: number },
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const { sourceHandle, targetHandle } = resolveHandles(
    sourceId,
    targetId,
    {
      position: { x: sourceRect.x, y: sourceRect.y },
      width: sourceRect.width,
      height: sourceRect.height,
    },
    {
      position: { x: targetRect.x, y: targetRect.y },
      width: targetRect.width,
      height: targetRect.height,
    },
  );
  return {
    start: handleAnchor(sourceRect, sourceHandle),
    end: handleAnchor(targetRect, targetHandle),
  };
}

export function getLayoutedElements(
  hasTable: boolean,
  steps: PipelineStep[],
  headers: string[],
  rows: string[][],
  columnWidths: Record<number, number>,
  onStepClick: (step: PipelineStep) => void,
  onStepRemove: (stepId: string | string[]) => void,
  onStepAliasUpdate: (stepId: string, alias: string) => void,
  onContextMenu: (stepId: string, x: number, y: number) => void,
  onTableContextMenu: (col: number, x: number, y: number) => void,
  onTableRename: (col: number, newName: string) => void,
  onSave: () => void,
  selectedStepId?: string,
  savedEdges?: PipelineEdge[],
  savedInputPosition?: { x: number; y: number },
  highlightedNodeId?: string | null,
  onTableDelete?: () => void,
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 25, ranksep: 50 });

  const nodes: Node[] = [];

  if (hasTable) {
    dagreGraph.setNode("table-node", { width: 520, height: 260 });
    nodes.push({
      id: "table-node",
      type: "tableNode",
      position: savedInputPosition || { x: 0, y: 0 },
      data: {
        headers,
        rows,
        columnWidths,
        onContextMenu: onTableContextMenu,
        onRename: onTableRename,
        onSave,
        onDelete: onTableDelete,
      },
      selected: false,
      dragHandle: ".table-node-header",
      width: 520,
      height: 260,
    });
  }

  steps.forEach((step) => {
    dagreGraph.setNode(step.id, { width: 240, height: 90 });
    nodes.push({
      id: step.id,
      type: "pipelineStep",
      position: step.position || { x: 0, y: 0 },
      width: 240,
      height: 90,
      data: {
        step,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        onContextMenu,
        isSelected: selectedStepId === step.id,
        isHighlighted: highlightedNodeId === step.id,
      },
      selected: selectedStepId === step.id,
    });
  });

  const edges: Edge[] = [];

  const createEdge = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find((n) => n.id === sourceId);
    const targetNode = nodes.find((n) => n.id === targetId);

    const { sourceHandle, targetHandle } = resolveHandles(
      sourceId,
      targetId,
      sourceNode,
      targetNode,
    );

    return {
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
      type: "default",
      data: { curvature: 0.5 },
      animated: sourceId === "table-node",
      style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "var(--flow-line-color)",
      },
    } as Edge;
  };

  if (savedEdges && savedEdges.length > 0) {
    savedEdges.forEach((edge) => {
      edges.push(createEdge(edge.source, edge.target));
      if (edge.source !== "table-node" && edge.target !== "table-node") {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    });
  }

  dagre.layout(dagreGraph);

  const MAX_STEPS_PER_COLUMN = 5;
  const COLUMN_WIDTH = 220;
  const ROW_HEIGHT = 75;

  const occupiedPositions = new Set<string>();

  nodes.forEach((n) => {
    if (n.id !== "table-node") {
      const pos = `${Math.round(n.position.x / COLUMN_WIDTH)}-${Math.round(n.position.y / ROW_HEIGHT)}`;
      occupiedPositions.add(pos);
    }
  });

  const findFirstAvailablePosition = (): { x: number; y: number } => {
    for (
      let col = 0;
      col < Math.ceil(steps.length / MAX_STEPS_PER_COLUMN) + 2;
      col++
    ) {
      for (let row = 0; row < MAX_STEPS_PER_COLUMN; row++) {
        const posKey = `${col}-${row}`;
        if (!occupiedPositions.has(posKey)) {
          occupiedPositions.add(posKey);
          return { x: col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
        }
      }
    }

    const totalNodes = nodes.filter((n) => n.id !== "table-node").length;
    const column = Math.floor(totalNodes / MAX_STEPS_PER_COLUMN);
    const rowInColumn = totalNodes % MAX_STEPS_PER_COLUMN;
    const newPos = { x: column * COLUMN_WIDTH, y: rowInColumn * ROW_HEIGHT };
    occupiedPositions.add(`${column}-${rowInColumn}`);
    return newPos;
  };

  nodes.forEach((node) => {
    const step = steps.find((s) => s.id === node.id);
    if (step?.position) {
      node.position = step.position;
    } else if (node.id === "table-node") {
      node.position = savedInputPosition || { x: -500, y: 0 };
    } else {
      const stepIndex = steps.findIndex((s) => s.id === node.id);
      if (stepIndex === -1) {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (nodeWithPosition) {
          const width = nodeWithPosition.width || 200;
          const height = nodeWithPosition.height || 100;
          node.position = {
            x: nodeWithPosition.x - width / 2,
            y: nodeWithPosition.y - height / 2,
          };
        }
      } else if (!step?.position) {
        const availablePos = findFirstAvailablePosition();
        node.position = availablePos;
      }
    }
  });

  return { nodes, edges };
}

export function createEdgeConfig(
  sourceId: string,
  targetId: string,
  sourceNode?: NodeRectSource,
  targetNode?: NodeRectSource,
): any {
  const { sourceHandle, targetHandle } = resolveHandles(
    sourceId,
    targetId,
    sourceNode,
    targetNode,
  );

  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: "default",
    animated: false,
    data: { curvature: 0.5 },
    style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "var(--flow-line-color)",
    },
  };
}
