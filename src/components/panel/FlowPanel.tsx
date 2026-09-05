import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from "react";
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
import { nodeTypes } from "@/components/panel/nodes";
import { CoordinateGrid } from "@/components/panel/CoordinateGrid";
import {
  getLayoutedElements,
  createEdgeConfig,
  getEdgeEndpoints,
  pickStartHandle,
  buildConnectPreviewPath,
  transformBezierPath,
  FlowRect,
  ConnectPreviewTarget,
} from "@/components/panel/utils/layout";
import {
  getCutIntersectionPoints,
  generateCutClipPaths,
  calculateFallVector,
  pointToLineDistance,
  linesIntersect,
  lineIntersectsRect,
  CutPartInfo,
} from "@/components/panel/utils/cutGeometry";
import { SearchOverlay } from "@/components/panel/overlays/SearchOverlay";
import { CutVisualization } from "@/components/panel/overlays/CutVisualization";
import { ConnectionVisualization } from "@/components/panel/overlays/ConnectionVisualization";
import { PipelineStep, PipelineEdge } from "@/types/xan";
import { ContextMenu } from "@/components/menu/ContextMenu";
import { TextTransformType } from "@/components/dialog/TextTransformDialog";
import { NumberTransformType } from "@/components/dialog/NumberTransformDialog";
import { Copy, Trash2 } from "lucide-react";
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
  resultPreview?: import("@/hooks/MainMenuHooks").ResultPreview[];
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string | string[], extraEdgeIds?: string[]) => void;
  onOpenFilterDialog: (col: number, x: number, y: number) => void;
  onOpenBatchFilter: (x: number, y: number) => void;
  onOpenPivotDialog: (x: number, y: number) => void;
  onOpenDateTransformDialog: (col: number, x: number, y: number) => void;
  onOpenSliceDialog: (
    col: number,
    x: number,
    y: number,
    sliceType?: string,
  ) => void;
  onOpenReplaceDialog: (col: number, x: number, y: number) => void;
  onOpenWindowDialog: (col: number, x: number, y: number) => void;
  onOpenPadDialog: (col: number, x: number, y: number, padType: string) => void;
  onOpenSortDialog: (col: number, x: number, y: number) => void;
  onOpenTextTransformDialog: (
    col: number,
    x: number,
    y: number,
    transformType?: TextTransformType,
  ) => void;
  onOpenNumberTransformDialog: (
    col: number,
    x: number,
    y: number,
    transformType?: NumberTransformType,
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

  // Cutting function status
  const [cutPath, setCutPath] = useState<{ x: number; y: number }[]>([]);
  const [isCutting, setIsCutting] = useState(false);
  const [isClosingCut, setIsClosingCut] = useState(false);
  const [cutStartPoint, setCutStartPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Animation status of elements to be cut
  const [cutNodes, setCutNodes] = useState<Set<string>>(new Set());
  const [cutEdges, setCutEdges] = useState<Set<string>>(new Set());
  // Cut part information (used for free fall animation)
  const [cutParts, setCutParts] = useState<CutPartInfo[]>([]);
  // Real-time highlight status - display elements to be deleted
  const [pendingDeleteNodes, setPendingDeleteNodes] = useState<Set<string>>(
    new Set(),
  );
  const [pendingDeleteEdges, setPendingDeleteEdges] = useState<Set<string>>(
    new Set(),
  );

  // Result preview nodes the user dismissed (removed from the canvas)
  const [dismissedResults, setDismissedResults] = useState<Set<string>>(
    new Set(),
  );

  // When a fresh set of results arrives (new execution), clear previous
  // dismissal records so every new run shows its result nodes by default.
  useEffect(() => {
    if (resultPreview && resultPreview.length > 0) {
      setDismissedResults(new Set());
    }
  }, [resultPreview]);

  // Canvas search status
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Right-click connect function status
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSourceNode, setConnectSourceNode] = useState<string | null>(
    null,
  );
  const [connectPreviewD, setConnectPreviewD] = useState<string | null>(null);
  const [connectStartAnchor, setConnectStartAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectEndAnchor, setConnectEndAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [connectTargetNode, setConnectTargetNode] = useState<string | null>(
    null,
  );

  // Multi-select (drag) state
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );

  // Copy/paste clipboard
  const clipboardRef = useRef<{
    steps: PipelineStep[];
    edges: { source: string; target: string }[];
  } | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    stepId: string;
  } | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback(
    (stepId: string, x: number, y: number) => {
      setContextMenu({ x, y, stepId });
    },
    [],
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

  // Ctrl+F global shortcut (handled if HelpDialog is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+F regardless of case to avoid triggering browser search boxes
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "f") return;
      e.preventDefault();
      e.stopPropagation();
      // If the dialog box is open, do not open the search box
      // (handled if HelpDialog is open)
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) return;
      setIsSearchOpen(true);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus and select search input when it opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

  const hasTable = headers.length > 0 && rows.length > 0;

  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  // Cutting function status (line delay 200ms), must read current state
  // instead of old snapshot when cutting in succession,
  // otherwise the last callback will use old array
  // Fully overwrite App's edges, add back the edges that were cut out.
  const edgesRef = useRef<Edge[]>(edges);
  edgesRef.current = edges;

  // Re-compute layout when data changes (not callbacks)
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      hasTable,
      steps,
      headers,
      rows,
      columnWidths,
      onStepClickRef.current,
      onStepRemoveRef.current,
      onStepAliasUpdateRef.current,
      handleContextMenu,
      handleTableContextMenu,
      handleTableRenameRef.current,
      onSaveRef.current,
      selectedStepId,
      savedEdges,
      savedInputPosition,
      highlightedNodeId,
      onTableDeleteRef.current,
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      if (existingNode && existingNode.position) {
        return {
          ...newNode,
          position: existingNode.position,
          selected: existingNode.selected,
        };
      }
      return newNode;
    });

    // Inject result preview nodes (F1) to the right of the pipeline graph.
    // Preserve an existing result node's position so it isn't pushed around
    // when other nodes are dragged (which re-triggers this layout effect).
    const existingResultPos = new Map<string, { x: number; y: number }>();
    for (const n of nodes) {
      if (n.type === "resultTableNode" && n.position) {
        existingResultPos.set(n.id, n.position);
      }
    }
    const maxRight = updatedNodes.reduce(
      (m, n) => Math.max(m, (n.position?.x || 0) + (n.width || 0)),
      0,
    );
    let fallbackY = 20;
    const resultNodes = (resultPreview || [])
      .filter((r) => !dismissedResults.has(r.id))
      .map((r) => {
        const position = existingResultPos.get(r.id) || {
          x: maxRight + 60,
          y: fallbackY,
        };
        fallbackY += 260;
        return {
          id: r.id,
          type: "resultTableNode" as const,
          position,
          data: {
            headers: r.headers,
            rows: r.rows,
            label: r.label,
            totalRows: r.totalRows,
            truncated: r.truncated,
            onClose: () =>
              setDismissedResults((prev) => new Set(prev).add(r.id)),
          },
          selectable: false,
          draggable: true,
          dragHandle: ".result-node-header",
          width: 520,
          height: 220,
        };
      });

    setNodes([...updatedNodes, ...resultNodes]);
    setEdges(layoutedEdges);
  }, [
    hasTable,
    steps,
    headers,
    rows,
    columnWidths,
    savedEdges,
    savedInputPosition,
    resultPreview,
    dismissedResults,
  ]);

  // Apply selection/highlight as visual-only properties (no layout recompute)
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isSelected: node.id === selectedStepId,
          isHighlighted: node.id === highlightedNodeId,
        },
      })),
    );
  }, [selectedStepId, highlightedNodeId]);

  // Search results: match command name or alias
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: {
      step: PipelineStep | null;
      displayName: string;
      secondaryName: string | null;
      isTableNode?: boolean;
      resultId?: string;
    }[] = [];

    // Search "Input Data" node (not its column names)
    if ("input data".includes(query) || "input".includes(query)) {
      results.push({
        step: null,
        displayName: "Input Data",
        secondaryName: null,
        isTableNode: true,
      });
    }

    // Search result preview nodes (F1)
    for (const r of resultPreview || []) {
      if (r.label.toLowerCase().includes(query)) {
        results.push({
          step: null,
          displayName: r.label,
          secondaryName: null,
          resultId: r.id,
        });
      }
    }

    // Search pipeline steps
    for (const step of steps) {
      const name = step.command.name.toLowerCase();
      const alias = step.alias?.toLowerCase() || "";
      if (name.includes(query) || alias.includes(query)) {
        results.push({
          step,
          displayName: step.alias || step.command.name,
          secondaryName: step.alias ? step.command.name : null,
        });
      }
    }

    return results;
  }, [searchQuery, steps, resultPreview]);

  // Click search result: jump to node and highlight
  const reactFlowInstance = useRef<any>(null);

  const handleSearchResultClick = useCallback(
    (step: PipelineStep | null, isTable?: boolean, resultId?: string) => {
      const nodeId = resultId ? resultId : isTable ? "table-node" : step!.id;
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !reactFlowInstance.current) return;

      // Use setCenter to jump to node position (centered)
      const w = node.type === "tableNode" || node.type === "resultTableNode" ? 260 : 110;
      const h = node.type === "tableNode" || node.type === "resultTableNode" ? 130 : 45;
      reactFlowInstance.current.setCenter(
        node.position.x + w,
        node.position.y + h,
        {
          zoom: Math.max(reactFlowInstance.current.getZoom(), 0.8),
          duration: 400,
        },
      );

      // Set highlighted node (trigger animation effect)
      setHighlightedNodeId(nodeId);
      setTimeout(() => setHighlightedNodeId(null), 1500);

      // Close search box
      setIsSearchOpen(false);
      setSearchQuery("");
    },
    [nodes],
  );

  // Collision detection function
  const detectAndDeleteElements = useCallback(
    (path: { x: number; y: number }[]) => {
      if (path.length < 2 || !reactFlowWrapper.current) return;

      // Convert cutting path to ReactFlow canvas coordinates
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const flowPath = path.map((p) => {
        return (
          reactFlowInstance.current?.screenToFlowPosition({
            x: p.x + rect.left,
            y: p.y + rect.top,
          }) || { x: 0, y: 0 }
        );
      });

      // Build node position mapping
      const nodePositions = new Map<
        string,
        { x: number; y: number; width: number; height: number }
      >();
      nodes.forEach((node) => {
        const nodeData = node as any;
        nodePositions.set(node.id, {
          x: node.position.x,
          y: node.position.y,
          width: nodeData.width || nodeData.measured?.width || 200,
          height: nodeData.height || nodeData.measured?.height || 80,
        });
      });

      // Detect edge collisions
      const edgesToDelete: Edge[] = [];
      const edgeTargets = new Set<string>();

      edges.forEach((edge) => {
        const sourcePos = nodePositions.get(edge.source);
        const targetPos = nodePositions.get(edge.target);

        if (!sourcePos || !targetPos) return;

        const { start: edgeStart, end: edgeEnd } = getEdgeEndpoints(
          edge.source,
          edge.target,
          sourcePos,
          targetPos,
        );

        for (let i = 0; i < flowPath.length - 1; i++) {
          const p1 = flowPath[i];
          const p2 = flowPath[i + 1];

          if (
            linesIntersect(
              p1.x,
              p1.y,
              p2.x,
              p2.y,
              edgeStart.x,
              edgeStart.y,
              edgeEnd.x,
              edgeEnd.y,
            )
          ) {
            edgesToDelete.push(edge);
            edgeTargets.add(edge.target);
            break;
          }

          const dist1 = pointToLineDistance(p1, edgeStart, edgeEnd);
          const dist2 = pointToLineDistance(p2, edgeStart, edgeEnd);
          if (dist1 < 20 || dist2 < 20) {
            if (!edgesToDelete.some((e) => e.id === edge.id)) {
              edgesToDelete.push(edge);
              edgeTargets.add(edge.target);
            }
          }
        }
      });

      // Detect node collisions
      const nodesToDelete: string[] = [];

      nodes.forEach((node) => {
        if (node.id === "table-node") return;
        if (edgeTargets.has(node.id)) return;

        const nodePos = nodePositions.get(node.id);
        if (!nodePos) return;

        const nodeRect = {
          left: nodePos.x,
          right: nodePos.x + nodePos.width,
          top: nodePos.y,
          bottom: nodePos.y + nodePos.height,
        };

        for (let i = 0; i < flowPath.length - 1; i++) {
          const p1 = flowPath[i];
          const p2 = flowPath[i + 1];

          if (lineIntersectsRect(p1, p2, nodeRect as DOMRect)) {
            nodesToDelete.push(node.id);
            break;
          }
        }
      });

      // Add cutting animation effect
      if (edgesToDelete.length > 0 || nodesToDelete.length > 0) {
        const edgeIdsToDelete = edgesToDelete.map((e) => e.id);
        const edgeIdSet = new Set(edgeIdsToDelete);

        const newCutEdges = new Set(cutEdges);
        edgeIdsToDelete.forEach((id) => newCutEdges.add(id));
        setCutEdges(newCutEdges);

        const newCutNodes = new Set(cutNodes);
        nodesToDelete.forEach((id) => newCutNodes.add(id));
        setCutNodes(newCutNodes);

        // Edges not connected to the cutting nodes → delete them with extra parameter;
        // Edges connected to the cutting nodes are automatically cleaned up.
        const nodeIdSet = new Set(nodesToDelete);
        const extraEdgeIds = edgesToDelete
          .filter((e) => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target))
          .map((e) => e.id);

        // Calculate cutting parts for the cutting nodes (free fall animation)
        const fallVec = calculateFallVector(path);
        const newCutParts: CutPartInfo[] = [];

        nodesToDelete.forEach((nodeId) => {
          const nodePos = nodePositions.get(nodeId);
          if (!nodePos) return;

          const localStart = {
            x: flowPath[0].x - nodePos.x,
            y: flowPath[0].y - nodePos.y,
          };
          const localEnd = {
            x: flowPath[flowPath.length - 1].x - nodePos.x,
            y: flowPath[flowPath.length - 1].y - nodePos.y,
          };

          const rect = {
            x: 0,
            y: 0,
            width: nodePos.width,
            height: nodePos.height,
          };
          const intersection = getCutIntersectionPoints(
            localStart,
            localEnd,
            rect,
          );

          if (intersection) {
            const { partA, partB } = generateCutClipPaths(
              intersection.p1,
              intersection.p2,
              rect,
            );

            newCutParts.push({
              nodeId,
              partIndex: 0,
              clipPath: partA,
              fallDx: fallVec.dx,
              fallDy: fallVec.dy,
              fallRotation: fallVec.rotation,
            });
            newCutParts.push({
              nodeId,
              partIndex: 1,
              clipPath: partB,
              fallDx: -fallVec.dx * 0.6,
              fallDy: fallVec.dy * 1.2,
              fallRotation: -fallVec.rotation,
            });
          }
        });

        setCutParts(newCutParts);

        // Delete elements: Edge animation fast (200ms), node fall animation slow (400ms), each independent trigger.
        // Each callback uses current state (edgesRef.current / App latest tabs) to calculate,
        // to avoid old snapshots. When cutting nodes, edges are deleted with 200ms,
        // Nodes continue to fall for 400ms.
        setTimeout(() => {
          if (edgeIdSet.size > 0) {
            setEdges((prev) => prev.filter((e) => !edgeIdSet.has(e.id)));
            if (onEdgesChange) {
              const remainingEdges = edgesRef.current.filter(
                (e) => !edgeIdSet.has(e.id),
              );
              const pipelineEdges = remainingEdges
                .filter((e) => e.source && e.target)
                .map((e) => ({ id: e.id, source: e.source, target: e.target }));
              onEdgesChange(pipelineEdges);
            }
          }
          setCutEdges(new Set());
        }, 200);

        setTimeout(() => {
          if (nodesToDelete.length > 0) {
            onStepRemove(nodesToDelete, extraEdgeIds);
          }
          setCutNodes(new Set());
          setCutParts([]);
        }, 400);
      }
    },
    [edges, nodes, setEdges, onStepRemove, onEdgesChange, cutEdges, cutNodes],
  );

  // Node → flow coordinate rectangle. First Prefer using rendered width/height,
  // fallback to node's own width/height, finally use default.
  const getNodeRect = useCallback((node: Node): FlowRect => {
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
  }, []);

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
    [nodes, getNodeRect],
  );

  // Right-click - Start connecting or cutting nodes
  const handleCutStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();

        const clickedNode = getNodeAtPosition(e.clientX, e.clientY);

        if (clickedNode && clickedNode !== "table-node") {
          setIsConnecting(true);
          setConnectSourceNode(clickedNode);
          setConnectTargetNode(null);
          setConnectPreviewD(null);
          setConnectStartAnchor(null);
          setConnectEndAnchor(null);
        } else {
          setIsCutting(true);
          setIsClosingCut(false);
          if (reactFlowWrapper.current) {
            const rect = reactFlowWrapper.current.getBoundingClientRect();
            const startPoint = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
            setCutStartPoint(startPoint);
            setCutPath([startPoint]);
          }
        }
      }
    },
    [getNodeAtPosition],
  );

  // Right-click move - Connect or cut nodes mode
  const handleCutMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        isConnecting &&
        reactFlowWrapper.current &&
        reactFlowInstance.current
      ) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();

        const flowCursor = reactFlowInstance.current.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });

        const sourceNode = nodes.find((n) => n.id === connectSourceNode);
        if (sourceNode) {
          const sourceRect = getNodeRect(sourceNode);
          const sourceHandle = pickStartHandle(
            connectSourceNode!,
            sourceRect,
            flowCursor,
          );

          const hoveredNode = getNodeAtPosition(e.clientX, e.clientY);
          let target: ConnectPreviewTarget | undefined;
          if (hoveredNode && hoveredNode !== connectSourceNode) {
            const targetNode = nodes.find((n) => n.id === hoveredNode);
            if (targetNode) {
              target = { id: hoveredNode, rect: getNodeRect(targetNode) };
            }
          }

          const preview = buildConnectPreviewPath({
            sourceId: connectSourceNode!,
            sourceRect,
            sourceHandle,
            cursor: flowCursor,
            target,
          });

          const toWrapper = (p: { x: number; y: number }) => {
            const s = reactFlowInstance.current.flowToScreenPosition(p);
            return { x: s.x - rect.left, y: s.y - rect.top };
          };

          setConnectPreviewD(transformBezierPath(preview.d, toWrapper));
          setConnectStartAnchor(toWrapper(preview.sourceAnchor));
          setConnectEndAnchor(toWrapper(preview.targetAnchor));
          setConnectTargetNode(target?.id ?? null);
        }
      } else if (isCutting && !isClosingCut && reactFlowWrapper.current) {
        const rect = reactFlowWrapper.current.getBoundingClientRect();
        const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (cutStartPoint) {
          setCutPath([cutStartPoint, newPoint]);
        }

        // Real-time collision detection - Update pending elements highlight
        if (cutPath.length >= 2 && reactFlowInstance.current) {
          const flowPath = cutPath.map((p) =>
            reactFlowInstance.current!.screenToFlowPosition({
              x: p.x + rect.left,
              y: p.y + rect.top,
            }),
          );

          const nodePositions = new Map<
            string,
            { x: number; y: number; width: number; height: number }
          >();
          nodes.forEach((node) => {
            const rect = getNodeRect(node);
            nodePositions.set(node.id, rect);
          });

          // Detect edge collision
          const pendingEdges = new Set<string>();
          const edgeTargets = new Set<string>();

          edges.forEach((edge) => {
            const sourcePos = nodePositions.get(edge.source);
            const targetPos = nodePositions.get(edge.target);
            if (!sourcePos || !targetPos) return;

            const { start: edgeStart, end: edgeEnd } = getEdgeEndpoints(
              edge.source,
              edge.target,
              sourcePos,
              targetPos,
            );

            for (let i = 0; i < flowPath.length - 1; i++) {
              const p1 = flowPath[i];
              const p2 = flowPath[i + 1];

              if (
                linesIntersect(
                  p1.x,
                  p1.y,
                  p2.x,
                  p2.y,
                  edgeStart.x,
                  edgeStart.y,
                  edgeEnd.x,
                  edgeEnd.y,
                )
              ) {
                pendingEdges.add(edge.id);
                edgeTargets.add(edge.target);
                break;
              }

              const dist1 = pointToLineDistance(p1, edgeStart, edgeEnd);
              const dist2 = pointToLineDistance(p2, edgeStart, edgeEnd);
              if (dist1 < 20 || dist2 < 20) {
                pendingEdges.add(edge.id);
                edgeTargets.add(edge.target);
                break;
              }
            }
          });

          // Detect node collision
          const pendingNodes = new Set<string>();
          nodes.forEach((node) => {
            if (node.id === "table-node" || edgeTargets.has(node.id)) return;

            const nodePos = nodePositions.get(node.id);
            if (!nodePos) return;

            const nodeRect = {
              left: nodePos.x,
              right: nodePos.x + nodePos.width,
              top: nodePos.y,
              bottom: nodePos.y + nodePos.height,
            };

            for (let i = 0; i < flowPath.length - 1; i++) {
              if (
                lineIntersectsRect(
                  flowPath[i],
                  flowPath[i + 1],
                  nodeRect as DOMRect,
                )
              ) {
                pendingNodes.add(node.id);
                break;
              }
            }
          });

          setPendingDeleteEdges(pendingEdges);
          setPendingDeleteNodes(pendingNodes);
        }
      }
    },
    [
      isCutting,
      isConnecting,
      getNodeAtPosition,
      getNodeRect,
      connectSourceNode,
      cutPath,
      nodes,
      edges,
      cutStartPoint,
      isClosingCut,
    ],
  );

  // Create edge between two nodes
  const createEdge = useCallback(
    (sourceId: string, targetId: string) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      const targetNode = nodes.find((n) => n.id === targetId);

      const config = createEdgeConfig(
        sourceId,
        targetId,
        sourceNode,
        targetNode,
      );

      setEdges((eds) => {
        const existingEdge = eds.find(
          (e) => e.source === sourceId && e.target === targetId,
        );
        if (existingEdge) return eds;

        const newEdge: Edge = config;
        const newEdges = [...eds, newEdge];

        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = newEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesChange(pipelineEdges);
        }

        return newEdges;
      });
    },
    [setEdges, onEdgesChange, nodes],
  );

  // Right-click release - Complete connecting or cutting nodes
  const handleCutEnd = useCallback(
    (e: React.MouseEvent) => {
      if (isConnecting) {
        e.preventDefault();
        e.stopPropagation();

        if (connectSourceNode && connectTargetNode) {
          createEdge(connectSourceNode, connectTargetNode);
        }

        setIsConnecting(false);
        setConnectSourceNode(null);
        setConnectTargetNode(null);
        setConnectPreviewD(null);
        setConnectStartAnchor(null);
        setConnectEndAnchor(null);
      } else if (isCutting) {
        e.preventDefault();
        e.stopPropagation();

        if (cutPath.length > 1) {
          const currentPath = [...cutPath];
          detectAndDeleteElements(currentPath);
        }

        setIsClosingCut(true);
        setIsCutting(false);

        setTimeout(() => {
          setIsClosingCut(false);
          setCutPath([]);
          setCutStartPoint(null);
          setPendingDeleteNodes(new Set());
          setPendingDeleteEdges(new Set());
        }, 150);
      }
    },
    [
      isCutting,
      isConnecting,
      detectAndDeleteElements,
      connectSourceNode,
      connectTargetNode,
      createEdge,
    ],
  );

  // Prevent default right-click menu on panel
  const handlePanelContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // Update node's isCutting attribute, pending delete highlight, and cut parts
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isCutting: cutNodes.has(node.id),
          isPendingDelete: pendingDeleteNodes.has(node.id),
          cutParts: cutParts.filter((p) => p.nodeId === node.id),
        },
      })),
    );
  }, [cutNodes, pendingDeleteNodes, cutParts]);

  // Update edge's cut effect and pending delete highlight
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          const isCut = cutEdges.has(edge.id);
          const isPending = pendingDeleteEdges.has(edge.id);
          return {
            ...edge,
            style: {
              ...edge.style,
              strokeDasharray: isCut ? "10" : undefined,
              animation: isCut
                ? "cut-edge-animation 0.2s ease-out forwards"
                : undefined,
              stroke: isPending && !isCut ? "#9a9aa6" : edge.style?.stroke,
              filter:
                isPending && !isCut
                  ? "drop-shadow(0 0 6px rgba(154, 154, 166, 0.7))"
                  : undefined,
            },
          };
        }),
      );
    });
    return () => cancelAnimationFrame(rafId);
  }, [cutEdges, pendingDeleteEdges]);

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
    [steps, onStepsChange, setEdges, onEdgesChange, nodes],
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

  const handleCopySelected = useCallback(() => {
    if (selectedNodeIds.size === 0) return;
    const selectedSteps = steps.filter((s) => selectedNodeIds.has(s.id));
    if (selectedSteps.length === 0) return;
    const ids = new Set(selectedSteps.map((s) => s.id));
    const internalEdges = edges.filter(
      (e) => e.source && e.target && ids.has(e.source) && ids.has(e.target),
    );
    clipboardRef.current = {
      steps: selectedSteps,
      edges: internalEdges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
    // Close the floating action bar after copying
    setSelectedNodeIds(new Set());
  }, [selectedNodeIds, steps, edges]);

  const handlePasteClipboard = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip || clip.steps.length === 0) return;

    const idMap = new Map<string, string>();
    const newSteps: PipelineStep[] = clip.steps.map((s) => {
      const newId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      idMap.set(s.id, newId);
      return {
        ...s,
        id: newId,
        alias: s.alias ? `${s.alias} (copy)` : s.alias,
        position: undefined,
      };
    });
    const newEdges: PipelineEdge[] = clip.edges
      .map((e) => {
        const source = idMap.get(e.source);
        const target = idMap.get(e.target);
        if (!source || !target) return null;
        return { id: `e-${source}-${target}`, source, target };
      })
      .filter((e): e is PipelineEdge => e !== null);

    onStepsChange([...steps, ...newSteps]);
    if (newEdges.length > 0 && onEdgesChange) {
      const existingEdges = edges
        .filter((e) => e.source && e.target)
        .map((e) => ({ id: e.id, source: e.source, target: e.target }));
      onEdgesChange([...existingEdges, ...newEdges]);
    }
  }, [steps, edges, onStepsChange, onEdgesChange]);

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

  return (
    <div
      ref={reactFlowWrapper}
      className="w-full h-full relative"
      onMouseDown={handleCutStart}
      onMouseMove={handleCutMove}
      onMouseUp={handleCutEnd}
      onContextMenu={handlePanelContextMenu}
    >
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
        onClose={() => {
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
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
          onOpenBatchFilter={(x, y) => onOpenBatchFilter(x, y)}
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

      {/* Multi-select floating action bar */}
      {selectedNodeIds.size > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-card border border-border/70 rounded-lg shadow-lg px-2 py-1.5">
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
