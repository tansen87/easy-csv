import { Node, Edge, MarkerType, Position, getBezierPath } from "reactflow";
import dagre from "dagre";
import { PipelineStep, PipelineEdge } from "@/types/xan";

export interface RectLike {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

// handle 名 → React Flow Position(用于计算贝塞尔方向)
export function sideToPosition(handle: string): Position {
  if (handle.includes("left")) return Position.Left;
  if (handle.includes("right")) return Position.Right;
  if (handle.includes("top")) return Position.Top;
  return Position.Bottom;
}

// 反向方位(自由端点的 targetPosition 取源端反方向,曲线才自然)
export function oppositePosition(pos: Position): Position {
  switch (pos) {
    case Position.Left:
      return Position.Right;
    case Position.Right:
      return Position.Left;
    case Position.Top:
      return Position.Bottom;
    default:
      return Position.Top;
  }
}

// 右键手势期间,根据光标相对源节点中心的位置选择源端 handle。
// 光标仍在源节点内部时保持 right-source,防止起手瞬间误选上下方向。
export function pickStartHandle(
  sourceId: string,
  sourceRect: FlowRect,
  cursor: { x: number; y: number },
): string {
  const inside =
    cursor.x >= sourceRect.x &&
    cursor.x <= sourceRect.x + sourceRect.width &&
    cursor.y >= sourceRect.y &&
    cursor.y <= sourceRect.y + sourceRect.height;

  if (inside) {
    return handleName(sourceId, "right", "source");
  }

  const centerX = sourceRect.x + sourceRect.width / 2;
  const centerY = sourceRect.y + sourceRect.height / 2;
  const dx = cursor.x - centerX;
  const dy = cursor.y - centerY;

  if (Math.abs(dy) >= Math.abs(dx)) {
    return handleName(sourceId, dy >= 0 ? "bottom" : "top", "source");
  }
  return handleName(sourceId, dx >= 0 ? "right" : "left", "source");
}

const rectToNodeRect = (r: FlowRect): NodeRectSource => ({
  position: { x: r.x, y: r.y },
  width: r.width,
  height: r.height,
});

export interface ConnectPreviewTarget {
  id: string;
  rect: FlowRect;
}

export interface BuildConnectPreviewParams {
  sourceId: string;
  sourceRect: FlowRect;
  sourceHandle: string;
  cursor: { x: number; y: number };
  target?: ConnectPreviewTarget;
}

// 生成右键连线的贝塞尔预览路径(flow 坐标)。
// 悬停到合法目标节点时与最终边完全一致(resolveHandles + getBezierPath,curvature 0.25)。
export function buildConnectPreviewPath(params: BuildConnectPreviewParams): {
  d: string;
  sourceAnchor: { x: number; y: number };
  targetAnchor: { x: number; y: number };
} {
  const { sourceId, sourceRect, sourceHandle, cursor } = params;

  let sh = sourceHandle;
  let th: string | undefined;
  let targetX = cursor.x;
  let targetY = cursor.y;

  if (params.target) {
    const handles = resolveHandles(
      sourceId,
      params.target.id,
      rectToNodeRect(sourceRect),
      rectToNodeRect(params.target.rect),
    );
    sh = handles.sourceHandle;
    th = handles.targetHandle;
    const ta = handleAnchor(params.target.rect, th);
    targetX = ta.x;
    targetY = ta.y;
  }

  const sourceAnchor = handleAnchor(sourceRect, sh);
  const sourcePosition = sideToPosition(sh);
  const targetPosition = th
    ? sideToPosition(th)
    : oppositePosition(sourcePosition);

  const [d] = getBezierPath({
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.25,
  });

  return { d, sourceAnchor, targetAnchor: { x: targetX, y: targetY } };
}

// 把 getBezierPath 生成的 `M x,y C x,y x,y x,y` 按仿射变换逐点映射
// (用于把 flow 坐标下的预览曲线转换到覆盖层 wrapper 坐标系)
export function transformBezierPath(
  d: string,
  transform: (p: { x: number; y: number }) => { x: number; y: number },
): string {
  const m = d.match(
    /^M(-?[\d.]+),(-?[\d.]+) C(-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+)$/,
  );
  if (!m) return d;
  const nums = m.slice(1).map(Number);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < nums.length; i += 2) {
    pts.push(transform({ x: nums[i], y: nums[i + 1] }));
  }
  const [s, c1, c2, t] = pts;
  return `M${s.x},${s.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${t.x},${t.y}`;
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
      selectable: false,
      dragHandle: ".table-node-header",
      width: 520,
      height: 260,
    });
  }

  steps.forEach((step) => {
    // Estimate the node height, expanding it when an execution error is shown
    const errorLines = step.error
      ? Math.max(1, Math.ceil(step.error.length / 42))
      : 0;
    const nodeHeight = 90 + errorLines * 16;
    dagreGraph.setNode(step.id, { width: 240, height: nodeHeight });
    nodes.push({
      id: step.id,
      type: "pipelineStep",
      position: step.position || { x: 0, y: 0 },
      width: 240,
      height: nodeHeight,
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
