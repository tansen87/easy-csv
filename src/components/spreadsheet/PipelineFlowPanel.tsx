import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  Background,
  ConnectionMode,
  MarkerType,
  Connection,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { X, Edit3, Check } from "lucide-react";
import { PipelineStep } from "@/types/xan";

interface PipelineStepNodeData {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepRemove: (stepId: string) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onContextMenu: (stepId: string, x: number, y: number) => void;
  isSelected: boolean;
  index: number;
}

function PipelineStepNode({
  data,
  selected,
}: {
  data: PipelineStepNodeData;
  selected: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.step.alias || "");

  const activeParams = useMemo(() => {
    return Object.entries(data.step.parameters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false
    );
  }, [data.step.parameters]);

  const handleAliasSave = () => {
    data.onStepAliasUpdate(data.step.id, editValue.trim());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAliasSave();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(data.step.alias || "");
    }
  };

  return (
    <Card
      className={`w-[220px] cursor-pointer transition-all duration-200 hover:shadow-lg group relative ${
        selected
          ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/50 shadow-md ring-2 ring-primary/20"
          : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-primary/30"
      }`}
      onClick={() => data.onStepClick(data.step)}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        data.onContextMenu(data.step.id, e.clientX, e.clientY);
      }}
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-6 px-1.5 text-xs border rounded bg-background w-20 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={handleKeyDown}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAliasSave();
                  }}
                  className="w-5 h-5 bg-green-500/10 hover:bg-green-500/20 rounded flex items-center justify-center transition-colors"
                >
                  <Check className="h-3 w-3 text-green-600" />
                </button>
              </div>
            ) : (
              <>
                <div className="font-semibold text-xs truncate">
                  {data.step.alias || data.step.command.name}
                </div>
                {data.step.alias && (
                  <span className="text-[9px] text-muted-foreground/70 bg-muted/60 px-1 py-0.5 rounded border border-border/40">
                    {data.step.command.name}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {activeParams.length > 0 && (
          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-0.5 mt-1.5">
            {activeParams.slice(0, 2).map(([key, value]) => (
              <span
                key={key}
                className="bg-muted/70 px-1 py-0.5 rounded border border-border/40"
              >
                <span className="text-muted-foreground/80">{key}=</span>
                <span className="font-medium">{String(value).slice(0, 8)}</span>
              </span>
            ))}
            {activeParams.length > 2 && (
              <span className="text-muted-foreground/60">+{activeParams.length - 2}</span>
            )}
          </div>
        )}
      </div>
      <div className="absolute -top-2 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-accent transition-colors"
          >
            <Edit3 className="h-2.5 w-2.5" />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onStepRemove(data.step.id);
          }}
          className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </Card>
  );
}

const nodeTypes = {
  pipelineStep: PipelineStepNode,
};

interface PipelineFlowPanelProps {
  steps: PipelineStep[];
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string) => void;
  selectedStepId?: string;
}

function getLayoutedElements(
  steps: PipelineStep[],
  onStepClick: (step: PipelineStep) => void,
  onStepRemove: (stepId: string) => void,
  onStepAliasUpdate: (stepId: string, alias: string) => void,
  onContextMenu: (stepId: string, x: number, y: number) => void,
  selectedStepId?: string
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 50, ranksep: 70 });

  const nodes: Node[] = steps.map((step) => {
    dagreGraph.setNode(step.id, { width: 240, height: 90 });
    return {
      id: step.id,
      type: "pipelineStep",
      position: { x: 0, y: 0 },
      data: {
        step,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        onContextMenu,
        isSelected: selectedStepId === step.id,
      },
      selected: selectedStepId === step.id,
    };
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const step = steps.find((s) => s.id === node.id);
    if (step?.position) {
      node.position = step.position;
    } else {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - 120,
        y: nodeWithPosition.y - 45,
      };
    }
  });

  return { nodes, edges: [] };
}

export function PipelineFlowPanel({
  steps,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  selectedStepId,
}: PipelineFlowPanelProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stepId: string;
  } | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((stepId: string, x: number, y: number) => {
    setContextMenu({ x, y, stepId });
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      getLayoutedElements(
        steps,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        handleContextMenu,
        selectedStepId
      ),
    [steps, selectedStepId, handleContextMenu]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: layoutedNodes } = getLayoutedElements(
      steps,
      onStepClick,
      onStepRemove,
      onStepAliasUpdate,
      handleContextMenu,
      selectedStepId
    );
    setNodes(layoutedNodes);
  }, [steps, selectedStepId, onStepClick, onStepRemove, onStepAliasUpdate, handleContextMenu, setNodes]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu, closeContextMenu]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, nodes: Node[]) => {
      const positionMap = new Map<string, { x: number; y: number }>();
      nodes.forEach((node) => {
        positionMap.set(node.id, node.position);
      });

      const updatedSteps = steps.map((step) => {
        const newPos = positionMap.get(step.id);
        if (newPos) {
          return { ...step, position: newPos };
        }
        return step;
      });

      onStepsChange(updatedSteps);
    },
    [steps, onStepsChange]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        id: `e-${connection.source}-${connection.target}`,
        source: connection.source || "",
        target: connection.target || "",
        type: "smoothstep",
        animated: false,
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--primary))",
        },
      };
      setEdges((eds) => {
        const newEdges = [...eds, newEdge];
        const graph = new Map<string, string[]>();
        const stepIds = steps.map((s) => s.id);

        stepIds.forEach((id) => graph.set(id, []));
        newEdges.forEach((edge) => {
          const targets = graph.get(edge.source) || [];
          targets.push(edge.target);
          graph.set(edge.source, targets);
        });

        const visited = new Set<string>();
        const result: string[] = [];

        const visit = (nodeId: string) => {
          if (visited.has(nodeId)) return;
          visited.add(nodeId);
          const neighbors = graph.get(nodeId) || [];
          neighbors.forEach((neighbor) => visit(neighbor));
          result.unshift(nodeId);
        };

        stepIds.forEach((id) => visit(id));

        const stepMap = new Map(steps.map((s) => [s.id, s]));
        const reorderedSteps = result
          .map((id) => stepMap.get(id))
          .filter((s): s is PipelineStep => s !== undefined);

        if (reorderedSteps.length === steps.length) {
          const orderChanged = reorderedSteps.some((s, i) => s.id !== steps[i].id);
          if (orderChanged) {
            onStepsChange(reorderedSteps);
          }
        }

        return newEdges;
      });
    },
    [steps, onStepsChange, setEdges]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
