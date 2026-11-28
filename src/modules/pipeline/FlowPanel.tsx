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

/** Canvas-side handle used by the parameter popover's title-bar drag. */
export interface StepMoveApi {
  move: (stepId: string, position: { x: number; y: number }) => void;
  commit: () => void;
}
import { CoordinateGrid } from "@/modules/pipeline/CoordinateGrid";
import { useCanvasKeyboardPan } from "@/modules/pipeline/hooks/useCanvasKeyboardPan";
import { useCanvasSpaceKey } from "@/modules/pipeline/hooks/useCanvasSpaceKey";
import { useStepFocus } from "@/modules/pipeline/hooks/useStepFocus";
import { useStepClipboard } from "@/modules/pipeline/hooks/useStepClipboard";
import { useNodeHitTest } from "@/modules/pipeline/hooks/useNodeHitTest";

import { useCutTool } from "@/modules/pipeline/hooks/useCutTool";
import { useConnectGesture } from "@/modules/pipeline/hooks/useConnectGesture";
import { usePipelineLayout } from "@/modules/pipeline/hooks/usePipelineLayout";
import { createEdgeConfig } from "@/modules/pipeline/lib/layout";
import { CutVisualization } from "@/modules/pipeline/overlays/CutVisualization";
import { ConnectionVisualization } from "@/modules/pipeline/overlays/ConnectionVisualization";
import { GestureLegend } from "@/modules/pipeline/overlays/GestureLegend";
import {
  PipelineStep,
  PipelineEdge,
  DelimiterMode,
  DelimiterSource,
  TabularFormat,
} from "@/types/xan";
import { ContextMenu } from "@/components/menu/ContextMenu";
import {
  CanvasContextMenu,
  type CanvasMenuItem,
} from "@/components/menu/CanvasContextMenu";
import type { QuickActionRequest } from "@/types/dialog";
import {
  BoxSelect,
  Hand,
  ArrowLeftRight,
  MoreHorizontal,
  LayoutGrid,
  Maximize2,
  ZoomIn,
  Lock,
  Mouse,
} from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { modKeySymbol } from "@/utils/platform";
import { useLanguage } from "@/i18n";

/** Left-button tool: box select or pan, persisted across restarts. */
type CanvasLeftTool = "select" | "pan";
const LEFT_TOOL_STORAGE_KEY = "easy-csv-canvas-left-tool";
/** Swap left/right mouse buttons for every canvas gesture. */
const SWAP_MOUSE_STORAGE_KEY = "easy-csv-canvas-swap-buttons";
/** Canvas options persisted with the tool choices. */
const LOCK_CANVAS_STORAGE_KEY = "easy-csv-canvas-locked";
const GESTURE_LEGEND_STORAGE_KEY = "easy-csv-canvas-gesture-legend";

function readStoredFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Private mode / quota errors fall back to session-only.
  }
}

/** Drag captured on the right button while the buttons are swapped. */
type SwapDragState =
  | {
      kind: "node";
      nodeId: string;
      startClientX: number;
      startClientY: number;
      startPosition: { x: number; y: number };
      moved: boolean;
    }
  | {
      kind: "select";
      startClientX: number;
      startClientY: number;
      additive: boolean;
    };

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
  /** Basename of the input file, shown in the table node footer. */
  inputFileName?: string;
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string | string[], extraEdgeIds?: string[]) => void;
  // Canvas context-menu entries report *what* was clicked (column + transform
  // kind + right-click coordinates); HomeView opens the anchored quick dialog.
  onQuickAction: (request: QuickActionRequest) => void;
  onTableRename: (col: number, newName: string) => void;
  onSave: () => void;
  onTableDelete?: () => void;
  selectedStepId?: string;
  /** Step states of the current run, rendered on the cards (design 086). */
  executionStates?: Record<string, import("@/types/execution").StepExecutionStatus>;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
  onInputPositionChange?: (position: { x: number; y: number }) => void;
  savedEdges?: PipelineEdge[];
  savedInputPosition?: { x: number; y: number };
  reactFlowInstanceRef?: React.RefObject<any>;
  /**
   * Imperative handle for the anchored parameter popover: dragging its title
   * bar moves the step card itself, so the card and the popover stay together.
   * `commit` persists the final positions the same way a node drag does.
   */
  stepMoveApiRef?: React.RefObject<StepMoveApi | null>;
  pipelineSavedAt?: number;
  doubleClickFitView?: boolean;
  onSavePipeline?: () => void;
  onSaveIntermediate?: (stepId: string) => void;
  /** Run this step and everything downstream on an exported CSV (design 078). */
  onRunFromStep?: (stepId: string) => void;
  /** Delimiter the input file was read with, plus how it was resolved. */
  delimiter?: string;
  delimiterMode?: DelimiterMode;
  delimiterSource?: DelimiterSource;
  delimiterConfidence?: "high" | "low" | "none";
  /** Input file format; non-CSV inputs show a read-only badge. */
  inputFormat?: TabularFormat;
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
  /** `"auto"` re-detects the delimiter, any other value locks it. */
  onDelimiterChange?: (mode: DelimiterMode) => void;
}

export function FlowPanel({
  steps,
  headers,
  rows,
  columnWidths,
  inputFileName,
  onStepsChange,
  onStepClick,
  onStepAliasUpdate,
  onStepRemove,
  onQuickAction,
  onTableRename,
  onSave,
  onTableDelete,
  selectedStepId,
  executionStates,
  onEdgesChange,
  onInputPositionChange,
  savedEdges,
  savedInputPosition,
  reactFlowInstanceRef,
  stepMoveApiRef,
  pipelineSavedAt,
  doubleClickFitView = true,
  onSaveIntermediate,
  onRunFromStep,
  delimiter,
  delimiterMode,
  delimiterSource,
  delimiterConfidence,
  inputFormat,
  sourceTable,
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
  // Steps fading out before they are removed from the pipeline (200ms).
  const [deletingNodeIds, setDeletingNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Left-button tool: box select (default, matches the old behaviour) or pan
  // the view. Persisted so the canvas keeps the chosen hand across restarts.
  const [leftTool, setLeftTool] = useState<CanvasLeftTool>(() => {
    try {
      return localStorage.getItem(LEFT_TOOL_STORAGE_KEY) === "pan"
        ? "pan"
        : "select";
    } catch {
      return "select";
    }
  });
  const chooseLeftTool = useCallback((tool: CanvasLeftTool) => {
    setLeftTool(tool);
    try {
      localStorage.setItem(LEFT_TOOL_STORAGE_KEY, tool);
    } catch {
      // Private mode / quota errors fall back to session-only.
    }
  }, []);

  // Swap left/right buttons: left handles the right-click mode, right handles
  // the left tool. Persisted with the tool choice.
  const [swapMouseButtons, setSwapMouseButtons] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SWAP_MOUSE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleSwapMouseButtons = useCallback(() => {
    setSwapMouseButtons((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SWAP_MOUSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Private mode / quota errors fall back to session-only.
      }
      return next;
    });
    setCanvasMenu(null);
    setTableContextMenu(null);
  }, []);

  // Canvas options: read-only lock and gesture legend.
  const [locked, setLocked] = useState(() =>
    readStoredFlag(LOCK_CANVAS_STORAGE_KEY),
  );
  const [showGestureLegend, setShowGestureLegend] = useState(() =>
    readStoredFlag(GESTURE_LEGEND_STORAGE_KEY),
  );
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  const [zoomPct, setZoomPct] = useState(100);
  const [canvasToolsOpen, setCanvasToolsOpen] = useState(false);
  const canvasToolsRef = useRef<HTMLDivElement>(null);

  const toggleLocked = useCallback(() => {
    setLocked((prev) => {
      storeFlag(LOCK_CANVAS_STORAGE_KEY, !prev);
      return !prev;
    });
  }, []);
  const toggleGestureLegend = useCallback(() => {
    setShowGestureLegend((prev) => {
      storeFlag(GESTURE_LEGEND_STORAGE_KEY, !prev);
      return !prev;
    });
  }, []);
  const [canvasMenu, setCanvasMenu] = useState<{
    x: number;
    y: number;
    stepId: string | null;
  } | null>(null);

  const handleContextMenu = useCallback(
    (stepId: string, x: number, y: number, openMenu?: boolean) => {
      // Swapped buttons: the right button drives the left tool, so node
      // context menus must not open from it. Locked canvas is read-only.
      if (swapMouseButtons || locked) return;
      // Only the card's ⋯ (and Shift+F10, which routes here through the same
      // state) opens the step menu; a plain right click no longer does.
      if (openMenu) setCanvasMenu({ x, y, stepId });
    },
    [swapMouseButtons, locked],
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
      if (swapMouseButtons || locked) return;
      setTableContextMenu({ x, y, col });
    },
    [swapMouseButtons, locked],
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
  // Latest nodes for the swapped-button drag handlers, which read state from
  // event callbacks rather than from the render closure.
  const nodesRef = useRef<Node[]>(nodes);
  nodesRef.current = nodes;
  /** Last position requested by the parameter popover's title-bar drag. */
  const stepMovePendingRef = useRef<{
    stepId: string;
    position: { x: number; y: number };
  } | null>(null);
  // Set after persistNodePositions is defined; the layout hook calls it when a
  // forced "tidy" layout produces new positions.
  const persistNodePositionsRef = useRef<(nodeList: Node[]) => void>(() => {});

  // Latest edges for gesture callbacks that read state from events.
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  // Shared ReactFlow instance handle (set in onInit below)
  const reactFlowInstance = useRef<any>(null);

  // Canvas hit-testing shared by the connect gesture and menus
  const { getNodeRect, getNodeAtPosition } = useNodeHitTest({
    nodes,
    reactFlowWrapper,
    reactFlowInstance,
  });

  // Design 073: the command field owns step search; the canvas only listens for
  // "focus this step" and flashes the highlight.
  const { highlightedNodeId } = useStepFocus({ nodes, reactFlowInstance });

  // Cut-to-delete gesture (right button on blank/table). The right-click menu
  // mode is gone, so cutting is always available; nodes still connect instead.
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

  // Right-click connect gesture - owned by useConnectGesture
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

  // Copy/paste clipboard - owned by useStepClipboard
  const { clipboardRef, copySteps, handleCopySelected, handlePasteClipboard } =
    useStepClipboard({
      steps,
      edges,
      selectedNodeIds,
      clearSelection: () => setSelectedNodeIds(new Set()),
      onStepsChange,
      onEdgesChange,
    });

  // Layout reconciliation - owned by usePipelineLayout
  usePipelineLayout({
    hasTable,
    steps,
    headers,
    rows,
    columnWidths,
    inputFileName,
    savedEdges,
    savedInputPosition,
    delimiter,
    delimiterMode,
    delimiterSource,
    delimiterConfidence,
    inputFormat,
    sourceTable,
    selectedStepId,
    executionStates,
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
    layoutResetKey,
    locked,
    onLayoutApplied: (list) => persistNodePositionsRef.current(list),
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

  // Space is React Flow's temporary pan key; the custom mouse handlers below
  // must stand down while it is held.
  const spaceDown = useCanvasSpaceKey();

  // Canvas pan via WASD only (see docs/design/013_canvas-keyboard-pan.md)
  useCanvasKeyboardPan(reactFlowInstance, true);

  const persistNodePositions = useCallback(
    (nodeList: Node[]) => {
      const positionMap = new Map<string, { x: number; y: number }>();
      nodeList.forEach((node) => {
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
  persistNodePositionsRef.current = persistNodePositions;

  // Dragging the parameter popover's title bar moves the step card through the
  // same node state a canvas drag uses, then persists on release. The last
  // requested position is remembered so the commit cannot race a pending
  // render (pointerup may arrive before the last state flush).
  if (stepMoveApiRef) {
    stepMoveApiRef.current = {
      move: (stepId, position) => {
        stepMovePendingRef.current = { stepId, position };
        setNodes((prev) =>
          prev.map((node) =>
            node.id === stepId ? { ...node, position } : node,
          ),
        );
      },
      commit: () => {
        const pending = stepMovePendingRef.current;
        stepMovePendingRef.current = null;
        const latest = pending
          ? nodesRef.current.map((node) =>
              node.id === pending.stepId
                ? { ...node, position: pending.position }
                : node,
            )
          : nodesRef.current;
        persistNodePositionsRef.current(latest);
      },
    };
  }

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      persistNodePositions(draggedNodes);
    },
    [persistNodePositions],
  );

  // Swapped buttons: the right button drives the left tool. Capture before
  // React Flow so a right-drag on a node moves it instead of panning.
  const swapDragRef = useRef<SwapDragState | null>(null);
  const [swapSelectRect, setSwapSelectRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const handleSwapMouseDownCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!swapMouseButtons || locked || e.button !== 2 || spaceDown) return;
      const clickedNode = getNodeAtPosition(e.clientX, e.clientY);
      if (!clickedNode) {
        // Pan tool: React Flow owns the right-drag pan.
        if (leftTool !== "select") return;
        const wrapper = reactFlowWrapper.current;
        if (!wrapper) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = wrapper.getBoundingClientRect();
        swapDragRef.current = {
          kind: "select",
          startClientX: e.clientX,
          startClientY: e.clientY,
          additive: e.shiftKey,
        };
        setSwapSelectRect({
          left: e.clientX - rect.left,
          top: e.clientY - rect.top,
          width: 0,
          height: 0,
        });
        return;
      }

      const node = nodesRef.current.find((n) => n.id === clickedNode);
      if (!node) return;
      e.preventDefault();
      e.stopPropagation();
      swapDragRef.current = {
        kind: "node",
        nodeId: clickedNode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPosition: { ...node.position },
        moved: false,
      };
      setNodes((nds) =>
        nds.map((n) =>
          n.id === clickedNode
            ? { ...n, selected: true }
            : e.shiftKey
              ? n
              : { ...n, selected: false },
        ),
      );
      setSelectedNodeIds((prev) => {
        const next = e.shiftKey ? new Set(prev) : new Set<string>();
        if (clickedNode !== "table-node") next.add(clickedNode);
        return next;
      });
    },
    [
      swapMouseButtons,
      locked,
      spaceDown,
      leftTool,
      getNodeAtPosition,
      setNodes,
      reactFlowWrapper,
    ],
  );

  // Right button = connect on a step card, cut (划 line) on blank/table. The
  // menu mode is gone, so cutting needs no switch; starting in the capture
  // phase keeps it out of the nodes' own mouse handling.
  const handlePrimaryCapture = useCallback(
    (e: React.MouseEvent) => {
      handleSwapMouseDownCapture(e);
      if (swapMouseButtons || spaceDown || locked || e.button !== 2) return;
      // Ignore overlays (rail, menus): only the canvas itself cuts or connects.
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".react-flow")) return;

      // The input table owns its right-click (column actions). Bail out before
      // preventDefault/stopPropagation so that event still reaches the header /
      // cell, and so no blade follows the pointer while the menu is open.
      const clickedNode = getNodeAtPosition(e.clientX, e.clientY);
      if (clickedNode === "table-node") return;

      e.preventDefault();
      e.stopPropagation();

      if (clickedNode) {
        startConnect(clickedNode);
      } else {
        startCut(e);
      }
    },
    [
      handleSwapMouseDownCapture,
      swapMouseButtons,
      spaceDown,
      locked,
      getNodeAtPosition,
      startConnect,
      startCut,
    ],
  );

  // Swapped layout: the left button is the primary one and does the same
  // connect / cut work; the right button drives the select/pan tool above.
  const handlePrimaryStart = useCallback(
    (e: React.MouseEvent) => {
      if (!swapMouseButtons || spaceDown || locked || e.button !== 0) return;

      const clickedNode = getNodeAtPosition(e.clientX, e.clientY);
      // Same rule as the right button: the input table never starts a gesture.
      if (clickedNode === "table-node") return;

      e.preventDefault();
      e.stopPropagation();

      if (clickedNode) {
        startConnect(clickedNode);
      } else {
        startCut(e);
      }
    },
    [
      swapMouseButtons,
      spaceDown,
      locked,
      getNodeAtPosition,
      startConnect,
      startCut,
    ],
  );

  // Primary button move - only the swapped drag (cut / connect follow the
  // pointer through window listeners below so they survive leaving the canvas).
  const handlePrimaryMove = useCallback(
    (e: React.MouseEvent) => {
      const drag = swapDragRef.current;
      if (drag) {
        if (drag.kind === "select") {
          const wrapper = reactFlowWrapper.current;
          if (!wrapper) return;
          const rect = wrapper.getBoundingClientRect();
          setSwapSelectRect({
            left: Math.min(drag.startClientX, e.clientX) - rect.left,
            top: Math.min(drag.startClientY, e.clientY) - rect.top,
            width: Math.abs(e.clientX - drag.startClientX),
            height: Math.abs(e.clientY - drag.startClientY),
          });
          return;
        }

        const dx = e.clientX - drag.startClientX;
        const dy = e.clientY - drag.startClientY;
        if (!drag.moved && Math.hypot(dx, dy) < 3) return;
        drag.moved = true;
        const zoom = reactFlowInstance.current?.getZoom?.() ?? 1;
        const position = {
          x: drag.startPosition.x + dx / zoom,
          y: drag.startPosition.y + dy / zoom,
        };
        setNodes((nds) =>
          nds.map((n) => (n.id === drag.nodeId ? { ...n, position } : n)),
        );
        return;
      }
    },
    [setNodes, reactFlowWrapper],
  );

  // Primary button release - only the swapped drag; cut / connect finish on
  // the window listener.
  const handlePrimaryEnd = useCallback(
    (e: React.MouseEvent) => {
      const drag = swapDragRef.current;
      if (drag) {
        swapDragRef.current = null;
        e.preventDefault();
        e.stopPropagation();

        if (drag.kind === "select") {
          const instance = reactFlowInstance.current;
          if (instance) {
            const topLeft = instance.screenToFlowPosition({
              x: Math.min(drag.startClientX, e.clientX),
              y: Math.min(drag.startClientY, e.clientY),
            });
            const bottomRight = instance.screenToFlowPosition({
              x: Math.max(drag.startClientX, e.clientX),
              y: Math.max(drag.startClientY, e.clientY),
            });
            const selected = new Set<string>(
              drag.additive ? selectedNodeIds : [],
            );
            nodesRef.current.forEach((node) => {
              const rect = getNodeRect(node);
              if (
                rect.x < bottomRight.x &&
                rect.x + rect.width > topLeft.x &&
                rect.y < bottomRight.y &&
                rect.y + rect.height > topLeft.y
              ) {
                selected.add(node.id);
              }
            });
            setNodes((nds) =>
              nds.map((n) => ({ ...n, selected: selected.has(n.id) })),
            );
            setSelectedNodeIds(
              new Set([...selected].filter((id) => id !== "table-node")),
            );
          }
          setSwapSelectRect(null);
          return;
        }

        if (drag.moved) {
          const zoom = reactFlowInstance.current?.getZoom?.() ?? 1;
          const position = {
            x: drag.startPosition.x + (e.clientX - drag.startClientX) / zoom,
            y: drag.startPosition.y + (e.clientY - drag.startClientY) / zoom,
          };
          const nextNodes = nodesRef.current.map((n) =>
            n.id === drag.nodeId ? { ...n, position } : n,
          );
          setNodes(nextNodes);
          persistNodePositions(nextNodes);
        }
        return;
      }
    },
    [
      selectedNodeIds,
      getNodeRect,
      setNodes,
      persistNodePositions,
      reactFlowInstance,
    ],
  );

  // Cut / connect follow the pointer on `window`: fast strokes, crossing nodes
  // and releasing outside the canvas no longer break the gesture ("断触").
  useEffect(() => {
    if (!isCutting && !isConnecting) return;

    const onMove = (event: MouseEvent) => {
      if (isCutting) {
        moveCut(event);
      } else {
        moveConnect(event);
      }
    };
    const onUp = () => {
      if (isCutting) {
        finishCut();
      } else {
        finishConnect();
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isCutting, isConnecting, moveCut, moveConnect, finishCut, finishConnect]);

  // Prevent default right-click menu on panel
  // Right-click no longer opens anything here; the native menu is suppressed
  // so the canvas keeps its custom gestures.
  const handlePanelContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => closeTableContextMenu();
    if (tableContextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [tableContextMenu, closeTableContextMenu]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes],
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

  /** Fade, then remove, an explicit set of steps (menu + keyboard share it). */
  const deleteSteps = useCallback(
    (ids: string[]) => {
      if (locked || ids.length === 0 || deleteTimerRef.current) return;
      const extraEdgeIds = edges
        .filter(
          (e) =>
            e.source &&
            e.target &&
            !ids.includes(e.source) &&
            !ids.includes(e.target),
        )
        .map((e) => e.id);
      setSelectedNodeIds(new Set());
      setDeletingNodeIds(new Set(ids));
      // Let the 200ms fade play before the step leaves the pipeline.
      deleteTimerRef.current = setTimeout(() => {
        deleteTimerRef.current = null;
        onStepRemove(ids, extraEdgeIds);
        setDeletingNodeIds(new Set());
      }, 220);
    },
    [edges, onStepRemove, locked],
  );

  const handleDeleteSelected = useCallback(() => {
    deleteSteps([...selectedNodeIds]);
  }, [deleteSteps, selectedNodeIds]);

  // Fade the nodes and the edges attached to them while the timer runs.
  useEffect(() => {
    if (deletingNodeIds.size === 0) return;
    setNodes((prev) =>
      prev.map((node) =>
        deletingNodeIds.has(node.id)
          ? { ...node, data: { ...node.data, isDeleting: true } }
          : node,
      ),
    );
    setEdges((prev) =>
      prev.map((edge) =>
        deletingNodeIds.has(edge.source) || deletingNodeIds.has(edge.target)
          ? { ...edge, className: "edge-deleting" }
          : edge,
      ),
    );
  }, [deletingNodeIds, setNodes, setEdges]);

  useEffect(
    () => () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    },
    [],
  );

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
        if (!locked) handlePasteClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDeleteSelected, handleCopySelected, handlePasteClipboard, locked]);

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

  // Canvas menu actions
  const handleTidyCanvas = useCallback(() => {
    setCanvasToolsOpen(false);
    setLayoutResetKey((key) => key + 1);
  }, []);
  const handleFitCanvas = useCallback(() => {
    setCanvasToolsOpen(false);
    reactFlowInstance.current?.fitView({ padding: 0.3, duration: 300 });
  }, []);
  const handleZoomReset = useCallback(() => {
    setCanvasToolsOpen(false);
    reactFlowInstance.current?.zoomTo(1, { duration: 200 });
  }, []);

  // Close the canvas menu on an outside click or Escape.
  useEffect(() => {
    if (!canvasToolsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!canvasToolsRef.current?.contains(event.target as globalThis.Node)) {
        setCanvasToolsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCanvasToolsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canvasToolsOpen]);

  // Canvas context menu items (right-click menu mode / card ⋯, design 078).
  // Built on every render so the paste disabled state reflects the current
  // clipboard and the step entries only show when a step is under the cursor.
  const canvasMenuItems: CanvasMenuItem[] = [
    ...(canvasMenu?.stepId && onRunFromStep && !locked
      ? [
          {
            key: "run-from-step",
            label: t.runFromStep,
            onSelect: () => onRunFromStep(canvasMenu.stepId!),
          } as CanvasMenuItem,
        ]
      : []),
    ...(canvasMenu?.stepId && onSaveIntermediate && !locked
      ? [
          {
            key: "save-intermediate",
            label: t.saveIntermediateAsInput,
            onSelect: () => onSaveIntermediate(canvasMenu.stepId!),
          } as CanvasMenuItem,
        ]
      : []),
    ...(canvasMenu?.stepId && !locked
      ? [
          {
            key: "copy-step",
            label: t.copyStep,
            separatorBefore: true,
            onSelect: () => copySteps([canvasMenu.stepId!]),
          } as CanvasMenuItem,
        ]
      : []),
    {
      key: "paste",
      label: canvasMenu?.stepId ? t.pasteStep : t.paste,
      disabled: !clipboardRef.current || locked,
      onSelect: handlePasteClipboard,
    },
    ...(canvasMenu?.stepId && !locked
      ? [
          {
            key: "delete-step",
            label: t.deleteStep,
            danger: true,
            onSelect: () => deleteSteps([canvasMenu.stepId!]),
          } as CanvasMenuItem,
        ]
      : []),
  ];

  // Shift+F10 opens the same step menu from the keyboard (design 078), so the
  // entry is reachable without the mouse and without switching modes.
  useEffect(() => {
    if (locked) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F10" || !event.shiftKey || !selectedStepId) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const node = document.querySelector(
        `.react-flow__node[data-id="${selectedStepId}"]`,
      );
      if (!node) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      setCanvasMenu({
        x: rect.right,
        y: rect.top + 48,
        stepId: selectedStepId,
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, selectedStepId]);

  // Multi-select tray (design 082): the centre of the bottom edge is where a
  // task bar belongs. The gesture hints moved to the bottom-right corner as
  // flat text and yield while the tray is visible, so the two never compete.
  const showSelectionTray =
    selectedNodeIds.size >= 2 &&
    !locked &&
    !isCutting &&
    !isConnecting &&
    !swapSelectRect;

  return (
    <div
      ref={reactFlowWrapper}
      className={`relative h-full w-full ${leftTool === "pan" ? "canvas-pan-tool" : ""} ${isCutting ? "canvas-cutting" : ""}`}
      onMouseDownCapture={handlePrimaryCapture}
      onMouseDown={handlePrimaryStart}
      onMouseMove={handlePrimaryMove}
      onMouseUp={handlePrimaryEnd}
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
        // Left drag follows the left tool: box select, or pan the view.
        // Swapped: the right button drives the left tool.
        panOnDrag={
          leftTool === "pan" ? (swapMouseButtons ? [1, 2] : [0, 1]) : [1]
        }
        panActivationKeyCode="Space"
        selectionOnDrag={!swapMouseButtons && leftTool === "select"}
        selectionKeyCode={swapMouseButtons ? null : "Shift"}
        // Swapped mode moves nodes with a custom right-drag; the lock also
        // disables every direct move.
        nodesDraggable={!swapMouseButtons && !locked}
        selectionMode={SelectionMode.Partial}
        zoomOnDoubleClick={!doubleClickFitView}
        onDoubleClick={handleCanvasDoubleClick}
        onMove={(_, viewport) => {
          if (canvasToolsOpen) setZoomPct(Math.round(viewport.zoom * 100));
        }}
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

      {/* Swapped buttons: right-drag box selection */}
      {swapSelectRect && (
        <div
          className="pointer-events-none absolute z-20 rounded-[2px] border border-dashed border-primary/70 bg-primary/[0.08]"
          style={{
            left: swapSelectRect.left,
            top: swapSelectRect.top,
            width: swapSelectRect.width,
            height: swapSelectRect.height,
          }}
        />
      )}

      {tableContextMenu && (
        <ContextMenu
          contextMenu={{
            x: tableContextMenu.x,
            y: tableContextMenu.y,
            row: null,
            col: tableContextMenu.col,
          }}
          headers={headers}
          onClose={closeTableContextMenu}
          onSelect={onQuickAction}
        />
      )}

      {/* Cut blade while the right button is drawing on blank canvas */}
      <CutVisualization
        isCutting={isCutting}
        isClosingCut={isClosingCut}
        cutPath={cutPath}
      />

      {/* Connection visualization line */}
      <ConnectionVisualization
        isConnecting={isConnecting}
        connectPreviewD={connectPreviewD}
        connectStartAnchor={connectStartAnchor}
        connectEndAnchor={connectEndAnchor}
        connectTargetNode={connectTargetNode}
      />

      {/* Canvas tools: a persistent rail with the left-button tool (select /
          pan), the button swap and the canvas menu. */}
      <div
        className="absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-0.5 rounded-[9px] border border-border bg-card p-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none"
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      >
        <Tooltip
          content={swapMouseButtons ? t.rightToolSelect : t.leftToolSelect}
          side="right"
        >
          <button
            type="button"
            onClick={() => chooseLeftTool("select")}
            aria-pressed={leftTool === "select"}
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-[5px] transition-colors ${
              leftTool === "select"
                ? "bg-canvas-ink-soft text-canvas-ink"
                : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            <BoxSelect className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip
          content={swapMouseButtons ? t.rightToolPan : t.leftToolPan}
          side="right"
        >
          <button
            type="button"
            onClick={() => chooseLeftTool("pan")}
            aria-pressed={leftTool === "pan"}
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-[5px] transition-colors ${
              leftTool === "pan"
                ? "bg-canvas-ink-soft text-canvas-ink"
                : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <span className="mx-auto my-0.5 h-px w-[18px] bg-border/60" />
        <Tooltip
          content={
            swapMouseButtons ? t.restoreMouseButtons : t.swapMouseButtons
          }
          side="right"
        >
          <button
            type="button"
            onClick={toggleSwapMouseButtons}
            aria-pressed={swapMouseButtons}
            className={`flex h-[26px] w-[26px] items-center justify-center rounded-[5px] transition-colors ${
              swapMouseButtons
                ? "bg-canvas-ink-soft text-canvas-ink"
                : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <span className="mx-auto my-0.5 h-px w-[18px] bg-border/60" />
        <div className="relative" ref={canvasToolsRef}>
          <Tooltip content={t.canvasTools} side="right">
            <button
              type="button"
              onClick={() => {
                if (!canvasToolsOpen) {
                  setZoomPct(
                    Math.round(
                      (reactFlowInstance.current?.getZoom?.() ?? 1) * 100,
                    ),
                  );
                }
                setCanvasToolsOpen((open) => !open);
              }}
              aria-haspopup="menu"
              aria-expanded={canvasToolsOpen}
              className={`relative flex h-[26px] w-[26px] items-center justify-center rounded-[5px] transition-colors ${
                canvasToolsOpen
                  ? "bg-canvas-ink-soft text-canvas-ink"
                  : "text-muted-foreground hover:bg-accent/60"
              }`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
              {(locked || showGestureLegend) && (
                <span className="absolute right-[3px] top-[3px] h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          </Tooltip>

          {canvasToolsOpen && (
            <div
              role="menu"
              className="absolute bottom-0 left-[34px] z-40 w-[236px] rounded-[10px] border border-border bg-card p-1.5 shadow-[0_12px_28px_-14px_rgba(0,0,0,0.22)] dark:shadow-none"
            >
              <div className="px-2 pb-0.5 pt-1 font-mono text-[9px] text-muted-foreground/60">
                {t.canvasActions}
              </div>
              <button
                type="button"
                role="menuitem"
                disabled={locked}
                onClick={handleTidyCanvas}
                className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-xs text-foreground transition-colors hover:bg-foreground/8 disabled:opacity-35"
              >
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.tidyCanvas}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleFitCanvas}
                className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-xs text-foreground transition-colors hover:bg-foreground/8"
              >
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.fitCanvas}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleZoomReset}
                className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-xs text-foreground transition-colors hover:bg-foreground/8"
              >
                <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.zoomReset}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
                  {zoomPct}%
                </span>
              </button>

              <div className="my-1 border-t border-border/50" />
              <div className="px-2 pb-0.5 pt-1 font-mono text-[9px] text-muted-foreground/60">
                {t.canvasSwitches}
              </div>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={locked}
                onClick={() => {
                  if (!locked) {
                    setCanvasMenu(null);
                    setTableContextMenu(null);
                  }
                  toggleLocked();
                }}
                className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-xs text-foreground transition-colors hover:bg-foreground/8"
              >
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.lockCanvas}</span>
                <span
                  className={`relative ml-auto h-[14px] w-[24px] shrink-0 rounded-full transition-colors ${
                    locked ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-background transition-[left] ${
                      locked ? "left-[12px]" : "left-[2px]"
                    }`}
                  />
                </span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showGestureLegend}
                onClick={toggleGestureLegend}
                className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-xs text-foreground transition-colors hover:bg-foreground/8"
              >
                <Mouse className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t.showGestureHints}</span>
                <span
                  className={`relative ml-auto h-[14px] w-[24px] shrink-0 rounded-full transition-colors ${
                    showGestureLegend ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-background transition-[left] ${
                      showGestureLegend ? "left-[12px]" : "left-[2px]"
                    }`}
                  />
                </span>
              </button>
            </div>
          )}
        </div>
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

      {/* Multi-select tray (design 082). Bottom-centre so it never fights the
          tab strip or the menu-bar search, stacked above the gesture legend,
          and pointer-transparent except its buttons so a marquee / cut / pan
          started under it still works. Hidden while a canvas gesture runs. */}
      {showSelectionTray && (
        <div
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
          style={{ bottom: "calc(var(--bottom-dock-height, 0px) + 8px)" }}
        >
          <div className="quick-enter pointer-events-none flex h-7 items-center rounded-md border border-border bg-card px-0.5">
            <span className="flex items-baseline gap-1 px-1.5">
              <span className="font-mono text-[11px] font-medium tabular-nums text-foreground">
                {selectedNodeIds.size}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {t.selectionUnit}
              </span>
            </span>
            <span className="h-3.5 w-px bg-border/70" />
            <button
              type="button"
              onClick={handleCopySelected}
              className="pointer-events-auto ml-0.5 flex h-[22px] items-center gap-1.5 rounded-[4px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {t.copy}
              <kbd className="rounded-[3px] border border-border bg-background px-1 py-0.5 font-mono text-[9px] leading-none text-muted-foreground/70">
                {modKeySymbol()} C
              </kbd>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="pointer-events-auto flex h-[22px] items-center gap-1.5 rounded-[4px] px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              {t.deleteSteps}
              <kbd className="rounded-[3px] border border-border bg-background px-1 py-0.5 font-mono text-[9px] leading-none text-muted-foreground/70">
                Del
              </kbd>
            </button>
          </div>
        </div>
      )}

      {showGestureLegend && !showSelectionTray && (
        <GestureLegend
          leftTool={leftTool}
          swapMouseButtons={swapMouseButtons}
          locked={locked}
        />
      )}

      {/* Canvas status indicator - bottom-left; rides above the log drawer
          through the height the drawer publishes on `:root`. */}
      <div
        className="absolute left-3 z-50 flex items-center gap-3 text-[11px] text-muted-foreground/60 select-none pointer-events-none"
        style={{ bottom: "calc(var(--bottom-dock-height, 0px) + 8px)" }}
        data-tick={tick}
      >
        <span className="flex items-center gap-1">
          <span className="font-medium tabular-nums">{steps.length}</span>
          <span>{steps.length === 1 ? "step" : "steps"}</span>
        </span>
        <span className="w-px h-3 bg-border/40" />
        {isDirty ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-warning/70 inline-block" />
            <span>{t.unsaved}</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-success/60 inline-block" />
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
