import React, { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeChange,
  applyNodeChanges,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Trash2, Download, Upload, Layers, Plus, Edit3, Check } from "lucide-react";
import { PipelineStep, PipelineTab } from "@/types/xan";

interface PipelineStepNodeData {
  step: PipelineStep;
  onStepClick: (step: PipelineStep) => void;
  onStepRemove: (stepId: string) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
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
      className={`w-[280px] cursor-pointer transition-all duration-200 hover:shadow-lg ${
        selected
          ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/50 shadow-md ring-2 ring-primary/20"
          : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-primary/30"
      }`}
      onClick={() => data.onStepClick(data.step)}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary/25 to-primary/10 rounded-lg flex items-center justify-center text-xs font-bold text-primary/80 border border-primary/20">
            {data.index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 px-2 text-sm border rounded bg-background w-28 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAliasSave();
                    }}
                    className="w-6 h-6 bg-green-500/10 hover:bg-green-500/20 rounded flex items-center justify-center transition-colors"
                  >
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="font-semibold text-sm truncate flex-1">
                    {data.step.alias || data.step.command.name}
                  </div>
                  {data.step.alias && (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                      {data.step.command.name}
                    </span>
                  )}
                </>
              )}
            </div>
            {activeParams.length > 0 && (
              <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1 mt-1.5">
                {activeParams.slice(0, 3).map(([key, value]) => (
                  <span
                    key={key}
                    className="bg-muted/70 px-1.5 py-0.5 rounded border border-border/40"
                  >
                    <span className="text-muted-foreground/80">{key}=</span>
                    <span className="font-medium">{String(value).slice(0, 12)}</span>
                  </span>
                ))}
                {activeParams.length > 3 && (
                  <span className="text-muted-foreground/60">+{activeParams.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="absolute -top-3 -right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isEditing && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 bg-background border shadow-sm hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Edit3 className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 bg-background border shadow-sm hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            data.onStepRemove(data.step.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}

const nodeTypes = {
  pipelineStep: PipelineStepNode,
};

interface PipelineFlowProps {
  steps: PipelineStep[];
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string) => void;
  selectedStepId?: string;
  onClear: () => void;
  onExportWorkspace?: () => void;
  onImportWorkspace?: () => void;
  tabs: PipelineTab[];
  selectedTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onRemoveTab: (tabId: string) => void;
  onRemoveAllTabsExcept: (keepTabId: string) => void;
  onRenameTab: (tabId: string, newName: string) => void;
}

function getLayoutedElements(
  steps: PipelineStep[],
  onStepClick: (step: PipelineStep) => void,
  onStepRemove: (stepId: string) => void,
  onStepAliasUpdate: (stepId: string, alias: string) => void,
  selectedStepId?: string
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  const nodes: Node[] = steps.map((step, index) => {
    dagreGraph.setNode(step.id, { width: 300, height: 100 });
    return {
      id: step.id,
      type: "pipelineStep",
      position: { x: 0, y: 0 },
      data: {
        step,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        isSelected: selectedStepId === step.id,
        index,
      },
      selected: selectedStepId === step.id,
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({
      id: `e-${steps[i].id}-${steps[i + 1].id}`,
      source: steps[i].id,
      target: steps[i + 1].id,
      type: "smoothstep",
      animated: false,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(var(--primary))",
      },
    });
    dagreGraph.setEdge(steps[i].id, steps[i + 1].id);
  }

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 150,
      y: nodeWithPosition.y - 50,
    };
  });

  return { nodes, edges };
}

export function PipelineFlow({
  steps,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  selectedStepId,
  onClear,
  onExportWorkspace,
  onImportWorkspace,
  tabs,
  selectedTabId,
  onTabChange,
  onAddTab,
  onRemoveTab,
  onRemoveAllTabsExcept,
  onRenameTab,
}: PipelineFlowProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState<string>("");

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      getLayoutedElements(
        steps,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        selectedStepId
      ),
    [steps, selectedStepId]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  React.useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      steps,
      onStepClick,
      onStepRemove,
      onStepAliasUpdate,
      selectedStepId
    );
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [steps, selectedStepId, onStepClick, onStepRemove, onStepAliasUpdate, setNodes, setEdges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      const positionChanges = changes.filter(
        (c) => c.type === "position" && c.dragging === false
      );

      if (positionChanges.length > 0) {
        const positionMap = new Map<string, { x: number; y: number }>();
        changes.forEach((change) => {
          if (change.type === "position" && change.position) {
            positionMap.set(change.id, change.position);
          }
        });

        if (positionMap.size > 0) {
          const newSteps = [...steps];
          const updatedSteps = newSteps.map((step) => {
            const newPos = positionMap.get(step.id);
            if (newPos) {
              return { ...step, position: newPos };
            }
            return step;
          });

          onStepsChange(updatedSteps);
        }
      }
    },
    [steps, setNodes, onStepsChange]
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b bg-card/80">
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center border border-primary/20">
                <Layers className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Pipeline
                </h2>
                <p className="text-xs text-muted-foreground">
                  Drag nodes to reorder
                </p>
              </div>
            </div>
            <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
              <button
                onClick={onClear}
                disabled={steps.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:text-muted-foreground/30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                onClick={onImportWorkspace}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
              <button
                onClick={onExportWorkspace}
                disabled={steps.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:text-muted-foreground/30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            </div>
          </div>
        </div>
        <div className="border-t bg-background/50">
          <div className="p-2 flex flex-wrap items-center gap-2">
            <button
              onClick={onAddTab}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm border-dashed hover:bg-accent transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (tabs.length > 1) {
                  const currentTab = tabs.find((tab) => tab.id === selectedTabId);
                  if (currentTab) {
                    onRemoveAllTabsExcept(currentTab.id);
                  }
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm border-dashed hover:bg-accent transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedTabId === tab.id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "hover:bg-accent border border-transparent"
                }`}
              >
                {editingTabId === tab.id ? (
                  <div className="flex-1">
                    <input
                      type="text"
                      value={editingTabName}
                      onChange={(e) => setEditingTabName(e.target.value)}
                      onBlur={() => {
                        if (editingTabName.trim()) {
                          onRenameTab(tab.id, editingTabName.trim());
                        }
                        setEditingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingTabName.trim()) {
                            onRenameTab(tab.id, editingTabName.trim());
                          }
                          setEditingTabId(null);
                        } else if (e.key === "Escape") {
                          setEditingTabId(null);
                        }
                      }}
                      className="w-full px-2 py-0.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary h-6"
                      style={{ lineHeight: "1.2" }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => onTabChange(tab.id)}
                    className="flex-1 text-left truncate"
                  >
                    {tab.name}
                  </button>
                )}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingTabId(tab.id);
                      setEditingTabName(tab.name);
                    }}
                    className="p-1 rounded hover:bg-accent transition-colors"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  {tabs.length > 1 && (
                    <button
                      onClick={() => onRemoveTab(tab.id)}
                      className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {steps.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
                <Layers className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                No steps in pipeline
              </p>
              <p className="text-xs text-muted-foreground/70">
                Click commands from the left panel to add them
              </p>
            </div>
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            type: "smoothstep",
            style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
          <Controls className="bg-card border border-border rounded-lg shadow-md" />
        </ReactFlow>
      </div>
    </div>
  );
}
