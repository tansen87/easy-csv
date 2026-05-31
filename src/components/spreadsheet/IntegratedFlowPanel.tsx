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
  Handle,
  Position,
  Connection,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Table, X, Edit3, Check, Rows3, Settings } from "lucide-react";
import { PipelineStep } from "@/types/xan";
import { ContextMenu } from "./ContextMenu";

interface TableNodeData {
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onContextMenu: (col: number, x: number, y: number) => void;
  onRename: (col: number, newName: string) => void;
  onSave: () => void;
}

function TableNode({ data, selected }: { data: TableNodeData; selected: boolean }) {
  const { headers, rows, columnWidths, onContextMenu, onRename, onSave } = data;
  const [editingCol, setEditingCol] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showSaveButton, setShowSaveButton] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleStartEdit = (col: number, currentValue: string) => {
    setEditingCol(col);
    setEditValue(currentValue);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[col] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = col * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleHeaderSelect = (colIndex: number) => {
    setEditingCol(colIndex);
    setEditValue(headers[colIndex]);
    setShowSaveButton(true);
    if (scrollContainerRef.current) {
      const colWidth = columnWidths[colIndex] || 100;
      const containerWidth = scrollContainerRef.current.clientWidth;
      const targetScroll = colIndex * colWidth - containerWidth / 2 + colWidth / 2;
      scrollContainerRef.current.scrollLeft = Math.max(0, targetScroll);
    }
  };

  const handleFinishEdit = () => {
    if (editingCol !== null && editValue.trim() && editValue !== headers[editingCol]) {
      onRename(editingCol, editValue.trim());
    }
    setEditingCol(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishEdit();
    } else if (e.key === "Escape") {
      setEditingCol(null);
      setEditValue("");
    }
  };

  return (
    <Card
      className={`w-[500px] overflow-hidden transition-all duration-200 ${
        selected
          ? "border-primary/50 shadow-lg ring-2 ring-primary/20"
          : "border-border/60 hover:border-primary/30"
      }`}
    >
      <div className="px-3 py-2 bg-muted/50 border-b border-border/50 flex items-center gap-2">
        <div className="w-6 h-6 bg-gradient-to-br from-green-500/25 to-green-500/10 rounded flex items-center justify-center">
          <Table className="h-3 w-3 text-green-600" />
        </div>
        <span className="font-semibold text-sm">Input Data</span>
        <div className="flex-1">
          <SearchableSelect
            value=""
            onChange={(value) => {
              const colIndex = headers.indexOf(value);
              if (colIndex !== -1) {
                handleHeaderSelect(colIndex);
              }
            }}
            options={headers.map((h, _i) => ({ label: h, value: h }))}
            placeholder="Search header to edit..."
            size="sm"
          />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          5 rows x {headers.length} cols
        </span>
        {showSaveButton && (
          <button
            onClick={() => {
              onSave();
              setShowSaveButton(false);
            }}
            className="w-5 h-5 rounded-xl flex items-center justify-center border border-green-500"
          >
            <Check className="h-3 w-3 text-green-500" />
          </button>
        )}
      </div>
      <div className="h-[200px] overflow-auto" ref={scrollContainerRef}>
        <div style={{ minWidth: "max-content" }}>
          <table className="border-collapse">
            <colgroup>
              {headers.map((_, colIndex) => (
                <col key={colIndex} style={{ width: columnWidths[colIndex] || 100 }} />
              ))}
            </colgroup>
            <thead className="bg-muted/30 sticky top-0">
              <tr>
                {headers.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-border/30 px-2 py-1.5 text-xs font-semibold text-left truncate min-w-[100px]"
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onContextMenu(colIndex, e.clientX, e.clientY);
                    }}
                    onDoubleClick={() => handleStartEdit(colIndex, header)}
                  >
                    {editingCol === colIndex ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background px-1 py-0.5 text-xs border border-primary rounded"
                        autoFocus
                      />
                    ) : (
                      header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-muted/20">
                  {headers.map((_, colIndex) => (
                    <td
                      key={colIndex}
                      className="border border-border/30 px-2 py-1 text-xs truncate min-w-[100px]"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onContextMenu(colIndex, e.clientX, e.clientY);
                      }}
                    >
                      {row[colIndex] || ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

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
      className={`w-[220px] transition-all duration-200 hover:shadow-lg group relative ${
        selected
          ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/50 shadow-md ring-2 ring-primary/20"
          : "bg-card/95 hover:bg-accent/30 border-border/60 hover:border-primary/30"
      }`}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        data.onContextMenu(data.step.id, e.clientX, e.clientY);
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background" />
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-primary/25 to-primary/10 rounded-md flex items-center justify-center text-[10px] font-bold text-primary/80 border border-primary/20">
            {data.index + 1}
          </div>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onStepClick(data.step);
          }}
          className="w-5 h-5 bg-background border shadow-sm rounded flex items-center justify-center hover:bg-accent transition-colors"
        >
          <Settings className="h-2.5 w-2.5" />
        </button>
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
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary/50 !border-2 !border-background" />
    </Card>
  );
}

const nodeTypes = {
  tableNode: TableNode,
  pipelineStep: PipelineStepNode,
};

interface IntegratedFlowPanelProps {
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string) => void;
  onOpenFilterDialog: (col: number, x: number, y: number) => void;
  onOpenPivotDialog: (x: number, y: number) => void;
  onOpenDateTransformDialog: (col: number, x: number, y: number) => void;
  onOpenSliceDialog: (col: number, x: number, y: number, sliceType?: string) => void;
  onOpenReplaceDialog: (col: number, x: number, y: number) => void;
  onOpenWindowDialog: (col: number, x: number, y: number) => void;
  onOpenPadDialog: (col: number, x: number, y: number, padType: string) => void;
  onSort: (col: number, order: "asc" | "desc", numeric: boolean) => void;
  onDedup: (col: number) => void;
  onTranspose: (col: number) => void;
  onReverse: (col: number) => void;
  onTextTransform: (col: number, transformType: string) => void;
  onNumberTransform: (col: number, transformType: string) => void;
  onTableRename: (col: number, newName: string) => void;
  onSave: () => void;
  selectedStepId?: string;
}

function getLayoutedElements(
  hasTable: boolean,
  steps: PipelineStep[],
  headers: string[],
  rows: string[][],
  columnWidths: Record<number, number>,
  onStepClick: (step: PipelineStep) => void,
  onStepRemove: (stepId: string) => void,
  onStepAliasUpdate: (stepId: string, alias: string) => void,
  onContextMenu: (stepId: string, x: number, y: number) => void,
  onTableContextMenu: (col: number, x: number, y: number) => void,
  onTableRename: (col: number, newName: string) => void,
  onSave: () => void,
  selectedStepId?: string
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  const nodes: Node[] = [];

  if (hasTable) {
    dagreGraph.setNode("table-node", { width: 520, height: 260 });
    nodes.push({
      id: "table-node",
      type: "tableNode",
      position: { x: 0, y: 0 },
      data: {
        headers,
        rows,
        columnWidths,
        onContextMenu: onTableContextMenu,
        onRename: onTableRename,
        onSave,
      },
      selected: false,
    });
  }

  steps.forEach((step, index) => {
    dagreGraph.setNode(step.id, { width: 240, height: 90 });
    nodes.push({
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
        index,
      },
      selected: selectedStepId === step.id,
    });
  });

  const edges: Edge[] = [];

  if (hasTable && steps.length > 0) {
    edges.push({
      id: "table-to-first",
      source: "table-node",
      target: steps[0].id,
      type: "smoothstep",
      animated: true,
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(var(--primary))",
      },
    });
    dagreGraph.setEdge("table-node", steps[0].id);
  }

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
    const step = steps.find((s) => s.id === node.id);
    if (step?.position) {
      node.position = step.position;
    } else {
      const nodeWithPosition = dagreGraph.node(node.id);
      if (nodeWithPosition) {
        const width = nodeWithPosition.width || 200;
        const height = nodeWithPosition.height || 100;
        node.position = {
          x: nodeWithPosition.x - width / 2,
          y: nodeWithPosition.y - height / 2,
        };
      }
    }
  });

  return { nodes, edges };
}

export function IntegratedFlowPanel({
  steps,
  headers,
  rows,
  columnWidths,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  onOpenFilterDialog,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenSliceDialog,
  onOpenReplaceDialog,
  onOpenWindowDialog,
  onOpenPadDialog,
  onSort,
  onDedup,
  onTranspose,
  onReverse,
  onTextTransform,
  onNumberTransform,
  onTableRename,
  onSave,
  selectedStepId,
}: IntegratedFlowPanelProps) {
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

  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    col: number;
  } | null>(null);

  const closeTableContextMenu = useCallback(() => {
    setTableContextMenu(null);
  }, []);

  const handleTableContextMenu = useCallback((col: number, x: number, y: number) => {
    setTableContextMenu({ x, y, col });
  }, []);

  const handleTableRename = useCallback((col: number, newName: string) => {
    onTableRename(col, newName);
  }, [onTableRename]);

  const hasTable = headers.length > 0 && rows.length > 0;

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      getLayoutedElements(
        hasTable,
        steps,
        headers,
        rows,
        columnWidths,
        onStepClick,
        onStepRemove,
        onStepAliasUpdate,
        handleContextMenu,
        handleTableContextMenu,
        handleTableRename,
        onSave,
        selectedStepId
      ),
    [hasTable, steps, headers, rows, columnWidths, selectedStepId, handleContextMenu, handleTableContextMenu, handleTableRename, onSave]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      hasTable,
      steps,
      headers,
      rows,
      columnWidths,
      onStepClick,
      onStepRemove,
      onStepAliasUpdate,
      handleContextMenu,
      handleTableContextMenu,
      handleTableRename,
      onSave,
      selectedStepId
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      if (existingNode && existingNode.position) {
        return { ...newNode, position: existingNode.position };
      }
      return newNode;
    });

    setNodes(updatedNodes);
    setEdges(layoutedEdges);
  }, [hasTable, steps, headers, rows, columnWidths, selectedStepId, onStepClick, onStepRemove, onStepAliasUpdate, handleContextMenu, handleTableContextMenu, handleTableRename, onSave, setNodes, setEdges]);

  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
      closeTableContextMenu();
    };
    if (contextMenu || tableContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu, tableContextMenu, closeContextMenu, closeTableContextMenu]);

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

      const sortedSteps = [...updatedSteps].sort((a, b) => {
        const posA = a.position || { x: 0, y: 0 };
        const posB = b.position || { x: 0, y: 0 };
        if (Math.abs(posA.y - posB.y) < 50) {
          return posA.x - posB.x;
        }
        return posA.y - posB.y;
      });

      onStepsChange(sortedSteps);
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
      setEdges((eds) => [...eds, newEdge]);
    },
    [setEdges]
  );

  if (!hasTable && steps.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted/50 rounded-2xl flex items-center justify-center">
            <Rows3 className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground mb-1">
            No data to display
          </p>
          <p className="text-xs text-muted-foreground/70">
            Select a CSV file and add pipeline steps
          </p>
        </div>
      </div>
    );
  }

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
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "straight",
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      {tableContextMenu && (
        <ContextMenu
          contextMenu={{ x: tableContextMenu.x, y: tableContextMenu.y, row: null, col: tableContextMenu.col }}
          onClose={closeTableContextMenu}
          onOpenFilterDialog={onOpenFilterDialog}
          onOpenPivotDialog={onOpenPivotDialog}
          onOpenDateTransformDialog={onOpenDateTransformDialog}
          onOpenSliceDialog={onOpenSliceDialog}
          onOpenReplaceDialog={onOpenReplaceDialog}
          onOpenWindowDialog={onOpenWindowDialog}
          onOpenPadDialog={onOpenPadDialog}
          onSort={onSort}
          onDedup={onDedup}
          onTranspose={onTranspose}
          onReverse={onReverse}
          onTextTransform={onTextTransform}
          onNumberTransform={onNumberTransform}
        />
      )}
    </div>
  );
}
