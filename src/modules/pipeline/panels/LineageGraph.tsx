import { useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  MarkerType,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { StepLineage } from "@/types/xan";

const TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  string: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  number: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  date: { bg: "#f3e8ff", text: "#6b21a8", border: "#d8b4fe" },
  boolean: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
};

interface LineageGraphProps {
  lineageData: StepLineage[];
  highlightedColumn?: string | null;
  onColumnClick?: (columnName: string) => void;
}

function ColumnNode({ data }: { data: any }) {
  const colors = TYPE_COLORS[data.type] || TYPE_COLORS.string;
  const isHighlighted = data.isHighlighted;
  const isDimmed = data.isDimmed;

  return (
    <div
      className="px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1.5px solid ${isHighlighted ? "#3b82f6" : colors.border}`,
        opacity: isDimmed ? 0.3 : 1,
        boxShadow: isHighlighted ? "0 0 0 2px rgba(59,130,246,0.3)" : "none",
        minWidth: 100,
        maxWidth: 220,
      }}
      onClick={() => data.onColumnClick?.(data.label)}
    >
      <div className="truncate leading-relaxed">{data.label}</div>
      <div className="text-[10px] opacity-60 mt-1">{data.type}</div>
    </div>
  );
}

function StepNode({ data }: { data: any }) {
  const isDimmed = data.isDimmed;

  return (
    <div
      className="px-4 py-3 rounded-lg text-xs transition-all"
      style={{
        backgroundColor: isDimmed ? "#f1f5f9" : "#f8fafc",
        border: `1.5px solid ${isDimmed ? "#e2e8f0" : "#cbd5e1"}`,
        opacity: isDimmed ? 0.3 : 1,
        minWidth: 140,
      }}
    >
      <div className="font-semibold text-slate-800 truncate">
        {data.commandName}
      </div>
      <div className="text-[10px] text-slate-500 mt-1.5">
        {data.inputRowCount} → {data.outputRowCount} rows
      </div>
      {data.transformations.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-1 truncate">
          {data.transformations[0].description}
        </div>
      )}
    </div>
  );
}

const lineageNodeTypes = {
  columnNode: ColumnNode,
  stepNode: StepNode,
};

const COL_W = 100;
const COL_GAP = 5;
const COL_H = 44;
const STEP_W = 160;
const STEP_H = 70;
const ROW_GAP = 30;

export function LineageGraph({
  lineageData,
  highlightedColumn,
  onColumnClick,
}: LineageGraphProps) {
  const { nodes, edges } = useMemo(() => {
    if (lineageData.length === 0) return { nodes: [], edges: [] };

    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    let edgeId = 0;

    const highlightSet = new Set<string>();
    if (highlightedColumn) {
      lineageData.forEach((step) => {
        step.inputSchema.forEach((col) => {
          if (col.name === highlightedColumn)
            highlightSet.add(`${step.stepId}-in-${col.name}`);
        });
        step.outputSchema.forEach((col) => {
          if (col.name === highlightedColumn)
            highlightSet.add(`${step.stepId}-out-${col.name}`);
        });
      });
    }

    const hasHighlight = highlightSet.size > 0;

    // Layout: column rows alternate with step rows
    lineageData.forEach((step, stepIndex) => {
      const inputCols = step.inputSchema;
      const outputCols = step.outputSchema;

      const inputRowY = stepIndex * (STEP_H + ROW_GAP + COL_H + ROW_GAP);
      const stepRowY = inputRowY + COL_H + ROW_GAP;
      const outputRowY = stepRowY + STEP_H + ROW_GAP;

      // Create input column nodes (horizontal row)
      const inputTotalW =
        inputCols.length * COL_W + Math.max(0, inputCols.length - 1) * COL_GAP;
      const inputStartX = -inputTotalW / 2;

      inputCols.forEach((col, i) => {
        const nodeId = `input-${step.stepId}-${col.name}`;
        const x = inputStartX + i * (COL_W + COL_GAP);
        nodeMap.set(nodeId, {
          id: nodeId,
          type: "columnNode",
          position: { x, y: inputRowY },
          data: {
            label: col.name,
            type: col.type,
            isHighlighted:
              highlightSet.has(nodeId) ||
              (!hasHighlight && highlightedColumn === col.name),
            isDimmed:
              hasHighlight &&
              !highlightSet.has(nodeId) &&
              highlightedColumn !== col.name,
            onColumnClick,
          },
        });
      });

      // Create step node (centered)
      nodeMap.set(`step-${step.stepId}`, {
        id: `step-${step.stepId}`,
        type: "stepNode",
        position: { x: -STEP_W / 2, y: stepRowY },
        data: {
          commandName: step.commandName,
          inputRowCount: step.inputRowCount,
          outputRowCount: step.outputRowCount,
          transformations: step.transformations,
          isDimmed:
            hasHighlight &&
            !Array.from(highlightSet).some((id) => id.includes(step.stepId)),
        },
      });

      // Edges: input cols → step
      inputCols.forEach((col) => {
        const inputColId = `input-${step.stepId}-${col.name}`;
        const isEdgeHighlighted = highlightSet.has(inputColId);
        edgeList.push({
          id: `e-${inputColId}-step-${step.stepId}-${edgeId++}`,
          source: inputColId,
          target: `step-${step.stepId}`,
          type: "smoothstep",
          animated: isEdgeHighlighted,
          style: {
            stroke: isEdgeHighlighted
              ? "#3b82f6"
              : hasHighlight
                ? "#cbd5e1"
                : "#94a3b8",
            strokeWidth: isEdgeHighlighted ? 2 : 1,
            opacity: hasHighlight && !isEdgeHighlighted ? 0.3 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isEdgeHighlighted
              ? "#3b82f6"
              : hasHighlight
                ? "#cbd5e1"
                : "#94a3b8",
          },
        });
      });

      // Create output column nodes (horizontal row)
      const outputTotalW =
        outputCols.length * COL_W +
        Math.max(0, outputCols.length - 1) * COL_GAP;
      const outputStartX = -outputTotalW / 2;

      outputCols.forEach((col, i) => {
        const nodeId = `output-${step.stepId}-${col.name}`;
        const x = outputStartX + i * (COL_W + COL_GAP);
        nodeMap.set(nodeId, {
          id: nodeId,
          type: "columnNode",
          position: { x, y: outputRowY },
          data: {
            label: col.name,
            type: col.type,
            isHighlighted:
              highlightSet.has(nodeId) ||
              (!hasHighlight && highlightedColumn === col.name),
            isDimmed:
              hasHighlight &&
              !highlightSet.has(nodeId) &&
              highlightedColumn !== col.name,
            onColumnClick,
          },
        });
      });

      // Edges: step → output cols
      outputCols.forEach((col) => {
        const outputColId = `output-${step.stepId}-${col.name}`;
        const isEdgeHighlighted = highlightSet.has(outputColId);
        edgeList.push({
          id: `e-step-${step.stepId}-${outputColId}-${edgeId++}`,
          source: `step-${step.stepId}`,
          target: outputColId,
          type: "smoothstep",
          animated: isEdgeHighlighted,
          style: {
            stroke: isEdgeHighlighted
              ? "#3b82f6"
              : hasHighlight
                ? "#cbd5e1"
                : "#94a3b8",
            strokeWidth: isEdgeHighlighted ? 2 : 1,
            opacity: hasHighlight && !isEdgeHighlighted ? 0.3 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isEdgeHighlighted
              ? "#3b82f6"
              : hasHighlight
                ? "#cbd5e1"
                : "#94a3b8",
          },
        });
      });

      // Connect output cols to next step's input cols (if not last step)
      if (stepIndex < lineageData.length - 1) {
        const nextStep = lineageData[stepIndex + 1];
        outputCols.forEach((col) => {
          const outputColId = `output-${step.stepId}-${col.name}`;
          const nextInputColId = `input-${nextStep.stepId}-${col.name}`;
          if (nodeMap.has(nextInputColId)) {
            const isEdgeHighlighted =
              highlightSet.has(outputColId) && highlightSet.has(nextInputColId);
            edgeList.push({
              id: `e-${outputColId}-${nextInputColId}-${edgeId++}`,
              source: outputColId,
              target: nextInputColId,
              type: "smoothstep",
              animated: isEdgeHighlighted,
              style: {
                stroke: isEdgeHighlighted
                  ? "#3b82f6"
                  : hasHighlight
                    ? "#cbd5e1"
                    : "#94a3b8",
                strokeWidth: isEdgeHighlighted ? 2 : 1,
                opacity: hasHighlight && !isEdgeHighlighted ? 0.3 : 1,
              },
            });
          }
        });
      }
    });

    return { nodes: Array.from(nodeMap.values()), edges: edgeList };
  }, [lineageData, highlightedColumn, onColumnClick]);

  if (lineageData.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={lineageNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        panOnDrag={true}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#e2e8f0"
        />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            if (node.type === "stepNode") return "#94a3b8";
            const type = node.data?.type;
            if (type === "number") return "#86efac";
            if (type === "date") return "#d8b4fe";
            if (type === "boolean") return "#fcd34d";
            return "#93c5fd";
          }}
          style={{ width: 160, height: 100 }}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
