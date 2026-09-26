import React, { useCallback, useState, useRef, useEffect } from "react";
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  Connection,
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/modules/pipeline/nodes";
import { CoordinateGrid } from "@/modules/pipeline/CoordinateGrid";
import { useCanvasKeyboardPan } from "@/modules/pipeline/hooks/useCanvasKeyboardPan";
import { useCanvasPointerHud } from "@/modules/pipeline/hooks/useCanvasPointerHud";
import { useCanvasSearch } from "@/modules/pipeline/hooks/useCanvasSearch";
import { useStepClipboard } from "@/modules/pipeline/hooks/useStepClipboard";
import { useNodeHitTest } from "@/modules/pipeline/hooks/useNodeHitTest";
import { useCutTool } from "@/modules/pipeline/hooks/useCutTool";
import { useConnectGesture } from "@/modules/pipeline/hooks/useConnectGesture";
import { usePipelineLayout } from "@/modules/pipeline/hooks/usePipelineLayout";
import { createEdgeConfig } from "@/modules/pipeline/lib/layout";
import { SearchOverlay } from "@/modules/pipeline/overlays/SearchOverlay";
import { CutVisualization } from "@/modules/pipeline/overlays/CutVisualization";
import { ConnectionVisualization } from "@/modules/pipeline/overlays/ConnectionVisualization";
import { KeyIndicatorOverlay } from "@/modules/pipeline/overlays/KeyIndicatorOverlay";
import {
  PipelineStep,
  PipelineEdge,
  DelimiterMode,
  DelimiterSource,
} from "@/types/xan";
import { ContextMenu } from "@/components/menu/ContextMenu";
import {
  CanvasContextMenu,
  type CanvasMenuItem,
} from "@/components/menu/CanvasContextMenu";
import type {
  NumberTransformKind,
  PadKind,
  SliceKind,
  TextTransformKind,
} from "@/types/dialog";
import {
  Copy,
  Trash2,
  ClipboardPaste,
  Scissors,
  MousePointerClick,
  FileDown,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";

function formatRelativeTime(
  date: Date,
  t: { justNow: string; minutesAgo: string; hoursAgo: string; daysAgo: string },
): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return t.justNow;
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t.minutesAgo.replace("{n}", String(diffMin));
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t.hoursAgo.replace("{n}", String(diffHour));
  const diffDay = Math.floor(diffHour / 24);
  return t.daysAgo.replace("{n}", String(diffDay));
}

interface FlowPanelProps {
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  resultPreview?: import("@/types/execution").ResultPreview[];
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string | string[], extraEdgeIds?: string[]) => void;
  // Canvas context-menu entries. They report only *what* was clicked — the
  // column and, where relevant, the transform kind. Positioning is gone with
  // the floating dialogs (design 019 §3.1) since every entry now opens the
  // shared centered command dialog.
  onOpenFilterDialog: (col: number) => void;
  onOpenBatchFilter: () => void;
  onOpenPivotDialog: () => void;
  onOpenDateTransformDialog: (col: number) => void;
  onOpenSliceDialog: (col: number, sliceType: SliceKind) => void;
  onOpenReplaceDialog: (col: number) => void;
  onOpenWindowDialog: (col: number) => void;
  onOpenPadDialog: (col: number, padType: PadKind) => void;
  onOpenSortDialog: (col: number) => void;
  onOpenTextTransformDialog: (
    col: number,
    transformType: TextTransformKind,
  ) => void;
  onOpenNumberTransformDialog: (
    col: number,
    transformType: NumberTransformKind,
  ) => void;
  onTableRename: (col: number, newName: string) => void;
  onSave: () => void;
  onTableDelete?: () => void;
  selectedStepId?: string;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
  onInputPositionChange?: (position: { x: number; y: number }) => void;
  savedEdges?: PipelineEdge[];
  savedInputPosition?: { x: number; y: number };
  reactFlowInstanceRef?: React.RefObject<any>;
  pipelineSavedAt?: number;
  doubleClickFitView?: boolean;
  onSavePipeline?: () => void;
  onOpenCommandPalette?: () => void;
  onSaveIntermediate?: (stepId: string) => void;
  /** Delimiter the input file was read with, plus how it was resolved. */
  delimiter?: string;
  delimiterMode?: DelimiterMode;
  delimiterSource?: DelimiterSource;
  delimiterConfidence?: "high" | "low" | "none";
  /** `"auto"` re-detects the delimiter, any other value locks it. */
  onDelimiterChange?: (mode: DelimiterMode) => void;
}

export function FlowPanel({
  steps,
  headers,
  rows,
  columnWidths,
  resultPreview,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  onOpenFilterDialog,
  onOpenBatchFilter,
  onOpenPivotDialog,
  onOpenDateTransformDialog,
  onOpenSliceDialog,
  onOpenReplaceDialog,
  onOpenWindowDialog,
  onOpenPadDialog,
  onOpenSortDialog,
  onOpenTextTransformDialog,
  onOpenNumberTransformDialog,
  onTableRename,
  onSave,
  onTableDelete,
  selectedStepId,
  onEdgesChange,
  onInputPositionChange,
  savedEdges,
  savedInputPosition,
  reactFlowInstanceRef,
  pipelineSavedAt,
  doubleClickFitView = true,
  onOpenCommandPalette,
  onSaveIntermediate,
  delimiter,
  delimiterMode,
  delimiterSource,
  delimiterConfidence,
  onDelimiterChange,
}: FlowPanelProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  // Store callbacks in refs to avoid unnecessary re-layout
  const onStepClickRef = useRef(onStepClick);
  onStepClickRef.current = onStepClick;
  const onStepRemoveRef = useRef(onStepRemove);
  onStepRemoveRef.current = onStepRemove;
  const onStepAliasUpdateRef = useRef(onStepAliasUpdate);
  onStepAliasUpdateRef.current = onStepAliasUpdate;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onTableRenameRef = useRef(onTableRename);
  onTableRenameRef.current = onTableRename;
  const onTableDeleteRef = useRef(onTableDelete);
  onTableDeleteRef.current = onTableDelete;
  const onDelimiterChangeRef = useRef(onDelimiterChange);
  onDelimiterChangeRef.current = onDelimiterChange;

  // Save status tracking
  const savedStepsRef = useRef<string>(JSON.stringify(steps));
  const [lastSavedTime, setLastSavedTime] = useState<number>(
    () => pipelineSavedAt || Date.now(),
  );

  // When the pipelinSavedAt is updated (with a save notification from the parent component),
  // record the current snapshot
  useEffect(() => {
    if (pipelineSavedAt && pipelineSavedAt > lastSavedTime) {
      savedStepsRef.current = JSON.stringify(steps);
      setLastSavedTime(pipelineSavedAt);
    }
  }, [pipelineSavedAt]);

  // Refresh relative time display every 30 seconds
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const stepsJson = JSON.stringify(steps);
  const isDirty = stepsJson !== savedStepsRef.current;

  // Multi-select (drag) state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stepId: string;
  } | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Right-click interaction mode: "cut" keeps the cut-to-delete / connect
  // gesture; "menu" opens the canvas context menu instead (paste, more later).
  const [rightClickMode, setRightClickMode] = useState<"cut" | "menu">("cut");
  // The mode toggle renders as a small dot by default and expands into the
  // vertical bar when the mouse nears the right edge (D2 follow-up).
  const [modeBarHovered, setModeBarHovered] = useState(false);
  const [canvasMenu, setCanvasMenu] = useState<{
    x: number;
    y: number;
    stepId: string | null;
  } | null>(null);

  const handleContextMenu = useCallback(
    (stepId: string, x: number, y: number) => {
      // In menu mode, right-clicking a step node opens the canvas context menu
      // (with that step under the cursor). Nodes call this via their own
      // onContextMenu which stops propagation, so we route here explicitly.
      if (rightClickMode === "menu") {
        setCanvasMenu({ x, y, stepId });
      } else {
        setContextMenu({ x, y, stepId });
      }
    },
    [rightClickMode],
  );

  const [tableContextMenu, setTableContextMenu] = useState<{
    x: number;
    y: number;
    col: number;
  } | null>(null);

  const closeTableContextMenu = useCallback(() => {
    setTableContextMenu(null);
  }, []);

  const handleTableContextMenu = useCallback(
    (col: number, x: number, y: number) => {
      setTableContextMenu({ x, y, col });
    },
    [],
  );

  const handleTableRename = useCallback(
    (col: number, newName: string) => {
      onTableRename(col, newName);
    },
    [onTableRename],
  );
  const handleTableRenameRef = useRef(handleTableRename);
  handleTableRenameRef.current = handleTableRename;

  const hasTable = headers.length > 0 && rows.length > 0;

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  // Cutting function status (line delay 200ms), must read current state
  // instead of old snapshot when cutting in succession,
  // otherwise the last callback will use old array
  // Fully overwrite App's edges, add back the edges that were cut out.
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  // Shared ReactFlow instance handle (set in onInit below)
  const reactFlowInstance = useRef<any>(null);

  // Canvas hit-testing shared by the cut tool, connect gesture and menus
  const { getNodeRect, getNodeAtPosition } = useNodeHitTest({
    nodes,
    reactFlowWrapper,
    reactFlowInstance,
  });

  // Canvas Ctrl+F search (state, matching, jump-to-node)
  const {
    isSearchOpen,
    searchQuery,
    setSearchQuery,
    highlightedNodeId,
    searchInputRef,
    searchResults,
    handleSearchResultClick,
    closeSearch,
  } = useCanvasSearch({ steps, resultPreview, nodes, reactFlowInstance });

  // Cutting function status — owned by useCutTool
  const cut = useCutTool({
    nodes,
    edges,
    setNodes,
    setEdges,
    edgesRef,
    reactFlowWrapper,
    reactFlowInstance,
    getNodeRect,
    onStepRemove,
    onEdgesChange,
  });
  const { cutPath, isCutting, isClosingCut, startCut, moveCut, finishCut } =
    cut;

  // Right-click connect gesture — owned by useConnectGesture
  const connect = useConnectGesture({
    nodes,
    setEdges,
    reactFlowWrapper,
    reactFlowInstance,
    getNodeRect,
    getNodeAtPosition,
    onEdgesChange,
  });
  const {
    isConnecting,
    connectPreviewD,
    connectStartAnchor,
    connectEndAnchor,
    connectTargetNode,
    startConnect,
    moveConnect,
    finishConnect,
  } = connect;

  // Copy/paste clipboard — owned by useStepClipboard
  const { clipboardRef, handleCopySelected, handlePasteClipboard } =
    useStepClipboard({
      steps,
      edges,
      selectedNodeIds,
      clearSelection: () => setSelectedNodeIds(new Set()),
      onStepsChange,
      onEdgesChange,
    });

  // Layout reconciliation + result-preview injection — owned by usePipelineLayout
  usePipelineLayout({
    hasTable,
    steps,
    headers,
    rows,
    columnWidths,
    savedEdges,
    savedInputPosition,
    resultPreview,
    delimiter,
    delimiterMode,
    delimiterSource,
    delimiterConfidence,
    selectedStepId,
    highlightedNodeId,
    onStepClickRef,
    onStepRemoveRef,
    onStepAliasUpdateRef,
    onTableRenameRef,
    onSaveRef,
    onTableDeleteRef,
    onDelimiterChangeRef,
    handleContextMenu,
    handleTableContextMenu,
    nodes,
    setNodes,
    setEdges,
  });

  // Transient notice shown when a cyclic connection is rejected
  const [cycleNotice, setCycleNotice] = useState(false);
  const cycleNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const showCycleNotice = useCallback(() => {
    setCycleNotice(true);
    if (cycleNoticeTimerRef.current) clearTimeout(cycleNoticeTimerRef.current);
    cycleNoticeTimerRef.current = setTimeout(() => setCycleNotice(false), 3000);
  }, []);

  // Canvas HUD state (pressed keys / mouse buttons / Space) fed by the two canvas
  // hooks below. Only updated at key/mouse change points, see docs/design/014.
  const [panKeys, setPanKeys] = useState<string[]>([]);
  const [panShift, setPanShift] = useState(false);
  const [mouseButtons, setMouseButtons] = useState<number[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const handlePanKeysChange = useCallback((keys: string[], shift: boolean) => {
    setPanKeys(keys);
    setPanShift(shift);
  }, []);
  const handlePointerChange = useCallback(
    (buttons: number[], space: boolean) => {
      setMouseButtons(buttons);
      setSpaceDown(space);
    },
    [],
  );

  // Canvas pan via WASD / arrow keys (see docs/design/013_canvas-keyboard-pan.md)
  useCanvasKeyboardPan(reactFlowInstance, true, handlePanKeysChange);

  // Canvas mouse-button + Space tracker (see docs/design/014_canvas-key-indicator.md)
  useCanvasPointerHud(
    reactFlowWrapper as React.RefObject<HTMLElement>,
    handlePointerChange,
  );

  // Right-click - start connecting (on a step node) or cutting (blank/table)
  const handleCutStart = useCallback(
    (e: React.MouseEvent) => {
      // In "menu" mode right-click is reserved for the context menu.
      if (rightClickMode !== "cut") return;
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();

        const clickedNode = getNodeAtPosition(e.clientX, e.clientY);
        if (clickedNode && clickedNode !== "table-node") {
          startConnect(clickedNode);
        } else {
          startCut(e);
        }
      }
    },
    [rightClickMode, getNodeAtPosition, startConnect, startCut],
  );

  // Right-click move - connect or cut mode
  const handleCutMove = useCallback(
    (e: React.MouseEvent) => {
      // Reveal the mode toggle bar when the mouse nears the right edge.
      // Returns the previous state when unchanged so React skips re-renders.
      setModeBarHovered((prev) => {
        const near = e.clientX >= window.innerWidth - 56;
        return prev === near ? prev : near;
      });

      if (isConnecting) {
        moveConnect(e);
      } else if (isCutting && !isClosingCut) {
        moveCut(e);
      }
    },
    [isConnecting, isCutting, isClosingCut, moveConnect, moveCut],
  );

  // Right-click release - complete connecting or cutting
  const handleCutEnd = useCallback(
    (e: React.MouseEvent) => {
      if (isConnecting) {
        e.preventDefault();
        e.stopPropagation();
        finishConnect();
      } else if (isCutting) {
        e.preventDefault();
        e.stopPropagation();
        finishCut();
      }
    },
    [isConnecting, isCutting, finishConnect, finishCut],
  );

  // Prevent default right-click menu on panel
  const handlePanelContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (rightClickMode === "menu") {
        const nodeId = getNodeAtPosition(e.clientX, e.clientY);
        setCanvasMenu({
          x: e.clientX,
          y: e.clientY,
          stepId: nodeId && nodeId !== "table-node" ? nodeId : null,
        });
      }
    },
    [rightClickMode, getNodeAtPosition],
  );

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
    [setNodes],
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

      const inputPos = positionMap.get("table-node");
      if (inputPos && onInputPositionChange) {
        onInputPositionChange(inputPos);
      }
    },
    [steps, onStepsChange, onInputPositionChange],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updatedEdges = applyEdgeChanges(changes, eds);
        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = updatedEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesChange(pipelineEdges);
        }
        return updatedEdges;
      });
    },
    [setEdges, onEdgesChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Reject a connection that would introduce a cycle. Adding
      // source -> target closes a cycle iff target can already reach source.
      if (connection.source === connection.target) {
        showCycleNotice();
        return;
      }
      const adjacency = new Map<string, string[]>();
      edgesRef.current.forEach((edge) => {
        if (!edge.source || !edge.target) return;
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source)!.push(edge.target);
      });
      const stack = [connection.target];
      const seen = new Set<string>([connection.target]);
      let wouldCycle = false;
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === connection.source) {
          wouldCycle = true;
          break;
        }
        (adjacency.get(current) || []).forEach((next) => {
          if (!seen.has(next)) {
            seen.add(next);
            stack.push(next);
          }
        });
      }
      if (wouldCycle) {
        showCycleNotice();
        return;
      }

      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      const config = createEdgeConfig(
        connection.source,
        connection.target,
        sourceNode,
        targetNode,
      );

      const newEdge: Edge = config;

      setEdges((eds) => {
        const newEdges = [...eds, newEdge];
        const graph = new Map<string, string[]>();
        const stepIds = steps.map((s) => s.id);

        stepIds.forEach((id) => graph.set(id, []));
        newEdges.forEach((edge) => {
          if (stepIds.includes(edge.source) && stepIds.includes(edge.target)) {
            const targets = graph.get(edge.source) || [];
            targets.push(edge.target);
            graph.set(edge.source, targets);
          }
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
          const orderChanged = reorderedSteps.some(
            (s, i) => s.id !== steps[i].id,
          );
          if (orderChanged) {
            onStepsChange(reorderedSteps);
          }
        }

        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = newEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({
              id: e.id,
              source: e.source,
              target: e.target,
            }));
          onEdgesChange(pipelineEdges);
        }

        return newEdges;
      });
    },
    [steps, onStepsChange, setEdges, onEdgesChange, nodes, showCycleNotice],
  );

  // Multi-select (Shift+drag or click) → track selected node ids
  const handleSelectionChange = useCallback(
    ({ nodes: selNodes }: { nodes: Node[] }) => {
      setSelectedNodeIds(
        new Set(selNodes.map((n) => n.id).filter((id) => id !== "table-node")),
      );
    },
    [],
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    const ids = [...selectedNodeIds];
    const extraEdgeIds = edges
      .filter(
        (e) =>
          e.source &&
          e.target &&
          !ids.includes(e.source) &&
          !ids.includes(e.target),
      )
      .map((e) => e.id);
    onStepRemove(ids, extraEdgeIds);
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, edges, onStepRemove]);

  // Delete / Backspace / Ctrl+C / Ctrl+V keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleCopySelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected, handleCopySelected, handlePasteClipboard]);

  // Double-click blank canvas → fit view
  const handleCanvasDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (!doubleClickFitView) return;
      const target = event.target as HTMLElement;
      if (target.closest(".react-flow__node")) return;
      reactFlowInstance.current?.fitView({ padding: 0.3, duration: 300 });
    },
    [doubleClickFitView],
  );

  // Canvas context menu items (right-click menu mode). Built on every render
  // so the paste disabled state reflects the current clipboard and the save
  // entry only shows when the cursor is over a step node. Extend this list as
  // more menu features are added.
  const canvasMenuItems: CanvasMenuItem[] = [
    ...(canvasMenu?.stepId && onSaveIntermediate
      ? [
          {
            key: "save-intermediate",
            label: t.saveIntermediateAsInput,
            icon: FileDown,
            onSelect: () => onSaveIntermediate(canvasMenu.stepId!),
          } as CanvasMenuItem,
        ]
      : []),
    {
      key: "paste",
      label: t.paste,
      icon: ClipboardPaste,
      disabled: !clipboardRef.current,
      onSelect: handlePasteClipboard,
    },
  ];

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      onMouseDown={handleCutStart}
      onMouseMove={handleCutMove}
      onMouseUp={handleCutEnd}
      onMouseLeave={() => setModeBarHovered(false)}
      onContextMenu={handlePanelContextMenu}
    >
      {cycleNotice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md bg-destructive/90 text-destructive-foreground text-sm shadow-lg">
          {t.cycleRejected}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        onSelectionChange={handleSelectionChange}
        deleteKeyCode={null}
        // Left-drag on blank → box select; pan via Space+left or middle-button drag
        panOnDrag={[1]}
        panActivationKeyCode="Space"
        selectionOnDrag={true}
        selectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        zoomOnDoubleClick={!doubleClickFitView}
        onDoubleClick={handleCanvasDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "default",
          style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => {
          reactFlowInstance.current = instance;
          if (reactFlowInstanceRef) reactFlowInstanceRef.current = instance;
        }}
      >
        <CoordinateGrid />
      </ReactFlow>

      {/* Search overlay on canvas */}
      <SearchOverlay
        isOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClose={closeSearch}
        onEnter={(index) => {
          if (searchResults.length > 0) {
            const r = searchResults[Math.min(index, searchResults.length - 1)];
            handleSearchResultClick(r.step, r.isTableNode, r.resultId);
          }
        }}
        searchResults={searchResults}
        onResultClick={handleSearchResultClick}
        onOpenCommandPalette={onOpenCommandPalette || (() => {})}
        searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
      />

      {/* Cut visualization line */}
      <CutVisualization
        isCutting={isCutting}
        isClosingCut={isClosingCut}
        cutPath={cutPath}
      />

      {tableContextMenu && (
        <ContextMenu
          contextMenu={{
            x: tableContextMenu.x,
            y: tableContextMenu.y,
            row: null,
            col: tableContextMenu.col,
          }}
          onClose={closeTableContextMenu}
          onOpenFilterDialog={onOpenFilterDialog}
          onOpenBatchFilter={() => onOpenBatchFilter()}
          onOpenPivotDialog={onOpenPivotDialog}
          onOpenDateTransformDialog={onOpenDateTransformDialog}
          onOpenTextTransformDialog={onOpenTextTransformDialog}
          onOpenSliceDialog={onOpenSliceDialog}
          onOpenReplaceDialog={onOpenReplaceDialog}
          onOpenWindowDialog={onOpenWindowDialog}
          onOpenPadDialog={onOpenPadDialog}
          onOpenNumberTransformDialog={onOpenNumberTransformDialog}
          onOpenSortDialog={onOpenSortDialog}
        />
      )}

      {/* Connection visualization line */}
      <ConnectionVisualization
        isConnecting={isConnecting}
        connectPreviewD={connectPreviewD}
        connectStartAnchor={connectStartAnchor}
        connectEndAnchor={connectEndAnchor}
        connectTargetNode={connectTargetNode}
      />

      {/* Right-click interaction mode toggle: a small dot by default,
          expanding into the vertical bar when the mouse nears the right edge. */}
      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        {modeBarHovered ? (
          <div className="flex flex-col items-center gap-1 bg-card border border-border/70 rounded-lg shadow-lg p-1 animate-in fade-in zoom-in-95 duration-150">
            <Tooltip content={t.rightClickCutMode} side="left">
              <button
                onClick={() => {
                  setRightClickMode("cut");
                  setCanvasMenu(null);
                }}
                aria-pressed={rightClickMode === "cut"}
                className={`relative flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${
                  rightClickMode === "cut"
                    ? "bg-primary text-primary-foreground"
                    : "text-primary hover:bg-accent/60"
                }`}
              >
                <Scissors className="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content={t.rightClickMenuMode} side="left">
              <button
                onClick={() => {
                  setRightClickMode("menu");
                  setCanvasMenu(null);
                }}
                aria-pressed={rightClickMode === "menu"}
                className={`relative flex items-center justify-center h-7 w-7 rounded-lg transition-colors ${
                  rightClickMode === "menu"
                    ? "bg-primary text-primary-foreground"
                    : "text-primary hover:bg-accent/60"
                }`}
              >
                <MousePointerClick className="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            type="button"
            className="h-1.5 w-8 rounded-full bg-black/60 dark:bg-white/70 shadow cursor-pointer transition-all hover:scale-x-110 hover:bg-black/80 dark:hover:bg-white/90"
          />
        )}
      </div>

      {/* Canvas context menu (right-click menu mode) */}
      {canvasMenu && (
        <CanvasContextMenu
          x={canvasMenu.x}
          y={canvasMenu.y}
          items={canvasMenuItems}
          onClose={() => setCanvasMenu(null)}
        />
      )}

      {/* Multi-select floating action bar */}
      {selectedNodeIds.size > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-card border border-border/70 rounded-lg shadow-lg px-2 py-1.5">
          <span className="px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
            {selectedNodeIds.size}
          </span>
          <button
            onClick={handleCopySelected}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-accent/50 transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            {t.copy}
          </button>
          <button
            onClick={handleDeleteSelected}
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.deleteSteps}
          </button>
        </div>
      )}

      {/* Canvas key / mouse HUD - just above the status indicator */}
      <KeyIndicatorOverlay
        keys={panKeys}
        shift={panShift}
        buttons={mouseButtons}
        space={spaceDown}
        labels={{
          left: t.mouseLeft,
          middle: t.mouseMiddle,
          right: t.mouseRight,
        }}
      />

      {/* Canvas status indicator - Bottom-left */}
      <div
        className="absolute bottom-2 left-3 z-50 flex items-center gap-3 text-[11px] text-muted-foreground/60 select-none pointer-events-none"
        data-tick={tick}
      >
        <span className="flex items-center gap-1">
          <span className="font-medium tabular-nums">{steps.length}</span>
          <span>{steps.length === 1 ? "step" : "steps"}</span>
        </span>
        <span className="w-px h-3 bg-border/40" />
        {isDirty ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 inline-block" />
            <span>{t.unsaved}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 inline-block" />
            <span>{t.saved}</span>
          </>
        )}
        <span className="w-px h-3 bg-border/40" />
        <span>
          {formatRelativeTime(new Date(lastSavedTime), {
            justNow: t.justNow,
            minutesAgo: t.minutesAgo,
            hoursAgo: t.hoursAgo,
            daysAgo: t.daysAgo,
          })}
        </span>
      </div>
    </div>
  );
}
