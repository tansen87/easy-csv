import { Node, Edge, MarkerType } from "reactflow";
import dagre from "dagre";
import { PipelineStep, PipelineEdge } from "@/types/xan";

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
  onTableDelete?: () => void
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
    });
  }

  steps.forEach((step) => {
    dagreGraph.setNode(step.id, { width: 240, height: 90 });
    nodes.push({
      id: step.id,
      type: "pipelineStep",
      position: step.position || { x: 0, y: 0 },
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

  // 辅助函数: 创建连线
  const createEdge = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    let sourceHandle: string;
    let targetHandle: string;

    if (sourceNode && targetNode) {
      const sourceX = sourceNode.position.x;
      const targetX = targetNode.position.x;

      if (sourceX <= targetX) {
        // 源在左,目标在右
        if (sourceId === 'table-node') {
          sourceHandle = 'table-right-source';
        } else {
          sourceHandle = 'right-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-left-target';
        } else {
          targetHandle = 'left-target';
        }
      } else {
        // 源在右,目标在左
        if (sourceId === 'table-node') {
          sourceHandle = 'table-left-source';
        } else {
          sourceHandle = 'left-source';
        }

        if (targetId === 'table-node') {
          targetHandle = 'table-right-target';
        } else {
          targetHandle = 'right-target';
        }
      }
    } else {
      // 默认值
      sourceHandle = sourceId === 'table-node' ? 'table-right-source' : 'right-source';
      targetHandle = targetId === 'table-node' ? 'table-left-target' : 'left-target';
    }

    const edgeConfig: any = {
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
    };

    return edgeConfig as Edge;
  };

  if (savedEdges && savedEdges.length > 0) {
    savedEdges.forEach((edge) => {
      edges.push(createEdge(edge.source, edge.target));
      if (edge.source !== "table-node" && edge.target !== "table-node") {
        dagreGraph.setEdge(edge.source, edge.target);
      }
    });
  } else if (hasTable && steps.length > 0) {
    edges.push(createEdge("table-node", steps[0].id));
    dagreGraph.setEdge("table-node", steps[0].id);
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
    for (let col = 0; col < Math.ceil(steps.length / MAX_STEPS_PER_COLUMN) + 2; col++) {
      for (let row = 0; row < MAX_STEPS_PER_COLUMN; row++) {
        const posKey = `${col}-${row}`;
        if (!occupiedPositions.has(posKey)) {
          occupiedPositions.add(posKey);
          return { x: col * COLUMN_WIDTH, y: row * ROW_HEIGHT };
        }
      }
    }

    const totalNodes = nodes.filter(n => n.id !== "table-node").length;
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

// 根据源和目标位置创建 edge 配置（供 FlowPanel 内部使用）
export function createEdgeConfig(
  sourceId: string,
  targetId: string,
  sourceNode?: { position: { x: number } },
  targetNode?: { position: { x: number } },
): any {
  let sourceHandle: string;
  let targetHandle: string;

  if (sourceNode && targetNode) {
    const sourceX = sourceNode.position.x;
    const targetX = targetNode.position.x;

    if (sourceX <= targetX) {
      if (sourceId === 'table-node') {
        sourceHandle = 'table-right-source';
      } else {
        sourceHandle = 'right-source';
      }

      if (targetId === 'table-node') {
        targetHandle = 'table-left-target';
      } else {
        targetHandle = 'left-target';
      }
    } else {
      if (sourceId === 'table-node') {
        sourceHandle = 'table-left-source';
      } else {
        sourceHandle = 'left-source';
      }

      if (targetId === 'table-node') {
        targetHandle = 'table-right-target';
      } else {
        targetHandle = 'right-target';
      }
    }
  } else {
    sourceHandle = sourceId === 'table-node' ? 'table-right-source' : 'right-source';
    targetHandle = targetId === 'table-node' ? 'table-left-target' : 'left-target';
  }

  return {
    id: `e-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    sourceHandle,
    targetHandle,
    type: 'default',
    animated: false,
    data: { curvature: 0.5 },
    style: { stroke: 'var(--flow-line-color)', strokeWidth: 1.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'var(--flow-line-color)',
    },
  };
}
