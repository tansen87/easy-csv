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
  ConnectionMode,
  Connection,
} from "reactflow";
import "reactflow/dist/style.css";
import { nodeTypes } from "@/components/panel/nodes";
import { CoordinateGrid } from "@/components/panel/CoordinateGrid";
import { getLayoutedElements, createEdgeConfig } from "@/components/panel/utils/layout";
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

interface FlowPanelProps {
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  onStepsChange: (steps: PipelineStep[]) => void;
  onStepClick: (step: PipelineStep) => void;
  onStepAliasUpdate: (stepId: string, alias: string) => void;
  onStepRemove: (stepId: string | string[]) => void;
  onOpenFilterDialog: (col: number, x: number, y: number) => void;
  onOpenBatchFilter: (x: number, y: number) => void;
  onOpenPivotDialog: (x: number, y: number) => void;
  onOpenDateTransformDialog: (col: number, x: number, y: number) => void;
  onOpenSliceDialog: (col: number, x: number, y: number, sliceType?: string) => void;
  onOpenReplaceDialog: (col: number, x: number, y: number) => void;
  onOpenWindowDialog: (col: number, x: number, y: number) => void;
  onOpenPadDialog: (col: number, x: number, y: number, padType: string) => void;
  onOpenSortDialog: (col: number, x: number, y: number) => void;
  onOpenTextTransformDialog: (col: number, x: number, y: number, transformType?: TextTransformType) => void;
  onOpenNumberTransformDialog: (col: number, x: number, y: number, transformType?: NumberTransformType) => void;
  onTableRename: (col: number, newName: string) => void;
  onSave: () => void;
  onTableDelete?: () => void;
  selectedStepId?: string;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
  onInputPositionChange?: (position: { x: number; y: number }) => void;
  savedEdges?: PipelineEdge[];
  savedInputPosition?: { x: number; y: number };
}

export function FlowPanel({
  steps,
  headers,
  rows,
  columnWidths,
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
}: FlowPanelProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // 切水果功能状态
  const [cutPath, setCutPath] = useState<{ x: number; y: number }[]>([]);
  const [isCutting, setIsCutting] = useState(false);
  const [isClosingCut, setIsClosingCut] = useState(false);
  const [cutStartPoint, setCutStartPoint] = useState<{ x: number; y: number } | null>(null);
  // 被切元素的动画状态
  const [cutNodes, setCutNodes] = useState<Set<string>>(new Set());
  const [cutEdges, setCutEdges] = useState<Set<string>>(new Set());
  // 切割部分信息(用于自由坠落动画)
  const [cutParts, setCutParts] = useState<CutPartInfo[]>([]);
  // 实时高亮状态 - 用于显示即将被删除的元素
  const [pendingDeleteNodes, setPendingDeleteNodes] = useState<Set<string>>(new Set());
  const [pendingDeleteEdges, setPendingDeleteEdges] = useState<Set<string>>(new Set());

  // 画布搜索状态
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 右键连接功能状态
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSourceNode, setConnectSourceNode] = useState<string | null>(null);
  const [connectPath, setConnectPath] = useState<{ x: number; y: number }[]>([]);
  const [connectTargetNode, setConnectTargetNode] = useState<string | null>(null);

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

  // Ctrl+F 全局快捷键(HelpDialog 打开时由 HelpDialog 处理)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果对话框打开,不拦截 Ctrl+F
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 搜索框打开时自动聚焦
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [isSearchOpen]);

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
        selectedStepId,
        savedEdges,
        savedInputPosition,
        highlightedNodeId,
        onTableDelete
      ),
    [hasTable, steps, headers, rows, columnWidths, selectedStepId, handleContextMenu, handleTableContextMenu, handleTableRename, onSave, savedEdges, savedInputPosition, highlightedNodeId, onTableDelete]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // 搜索结果:匹配命令名称或 alias
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const results: { step: PipelineStep | null; displayName: string; secondaryName: string | null; isTableNode?: boolean }[] = [];

    // 搜索 "Input Data" 节点(不搜索其列名)
    if ("input data".includes(query) || "input".includes(query)) {
      results.push({ step: null, displayName: "Input Data", secondaryName: null, isTableNode: true });
    }

    // 搜索 pipeline 步骤
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
  }, [searchQuery, steps]);

  // 点击搜索结果:跳转到节点并高亮
  const reactFlowInstance = useRef<any>(null);

  const handleSearchResultClick = useCallback((step: PipelineStep | null, isTable?: boolean) => {
    const nodeId = isTable ? "table-node" : step!.id;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !reactFlowInstance.current) return;

    // 使用 setCenter 跳转到节点位置(居中显示)
    const w = node.type === "tableNode" ? 260 : 110;
    const h = node.type === "tableNode" ? 130 : 45;
    reactFlowInstance.current.setCenter(
      node.position.x + w,
      node.position.y + h,
      {
        zoom: Math.max(reactFlowInstance.current.getZoom(), 0.8),
        duration: 400,
      }
    );

    // 设置高亮节点(触发动画)
    setHighlightedNodeId(nodeId);
    setTimeout(() => setHighlightedNodeId(null), 1500);

    // 关闭搜索框
    setIsSearchOpen(false);
    setSearchQuery("");
  }, [nodes]);

  // 当savedEdges变化时(如从history导入),更新本地edges状态
  useEffect(() => {
    if (savedEdges && savedEdges.length > 0) {
      const newEdges: Edge[] = savedEdges.map((edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        const config = createEdgeConfig(edge.source, edge.target, sourceNode, targetNode);
        return { ...config, id: edge.id } as Edge;
      });
      setEdges(newEdges);
    }
  }, [savedEdges, nodes]);

  // 碰撞检测函数
  const detectAndDeleteElements = useCallback((path: { x: number; y: number }[]) => {
    if (path.length < 2 || !reactFlowWrapper.current) return;

    // 将切水果路径转换为 ReactFlow 画布坐标
    const rect = reactFlowWrapper.current.getBoundingClientRect();
    const flowPath = path.map(p => {
      return reactFlowInstance.current?.screenToFlowPosition({
        x: p.x + rect.left,
        y: p.y + rect.top
      }) || { x: 0, y: 0 };
    });

    // 构建节点位置映射
    const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    nodes.forEach(node => {
      const nodeData = node as any;
      nodePositions.set(node.id, {
        x: node.position.x,
        y: node.position.y,
        width: nodeData.measured?.width || 200,
        height: nodeData.measured?.height || 80,
      });
    });

    // 检测连线碰撞
    const edgesToDelete: string[] = [];
    const edgeTargets = new Set<string>();

    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);

      if (!sourcePos || !targetPos) return;

      const edgeStart = {
        x: sourcePos.x + sourcePos.width,
        y: sourcePos.y + sourcePos.height / 2,
      };
      const edgeEnd = {
        x: targetPos.x,
        y: targetPos.y + targetPos.height / 2,
      };

      for (let i = 0; i < flowPath.length - 1; i++) {
        const p1 = flowPath[i];
        const p2 = flowPath[i + 1];

        if (linesIntersect(
          p1.x, p1.y, p2.x, p2.y,
          edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y
        )) {
          edgesToDelete.push(edge.id);
          edgeTargets.add(edge.target);
          break;
        }

        const dist1 = pointToLineDistance(p1, edgeStart, edgeEnd);
        const dist2 = pointToLineDistance(p2, edgeStart, edgeEnd);
        if (dist1 < 20 || dist2 < 20) {
          if (!edgesToDelete.includes(edge.id)) {
            edgesToDelete.push(edge.id);
            edgeTargets.add(edge.target);
          }
        }
      }
    });

    // 检测节点碰撞
    const nodesToDelete: string[] = [];

    nodes.forEach(node => {
      if (node.id === 'table-node') return;
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

    // 添加切水果动画效果
    if (edgesToDelete.length > 0 || nodesToDelete.length > 0) {
      const newCutEdges = new Set(cutEdges);
      edgesToDelete.forEach(id => newCutEdges.add(id));
      setCutEdges(newCutEdges);

      const newCutNodes = new Set(cutNodes);
      nodesToDelete.forEach(id => newCutNodes.add(id));
      setCutNodes(newCutNodes);

      // 为被切节点计算切割部分(自由坠落动画)
      const fallVec = calculateFallVector(path);
      const newCutParts: CutPartInfo[] = [];

      nodesToDelete.forEach(nodeId => {
        const nodePos = nodePositions.get(nodeId);
        if (!nodePos) return;

        const localStart = { x: flowPath[0].x - nodePos.x, y: flowPath[0].y - nodePos.y };
        const localEnd = { x: flowPath[flowPath.length - 1].x - nodePos.x, y: flowPath[flowPath.length - 1].y - nodePos.y };

        const rect = { x: 0, y: 0, width: nodePos.width, height: nodePos.height };
        const intersection = getCutIntersectionPoints(localStart, localEnd, rect);

        if (intersection) {
          const { partA, partB } = generateCutClipPaths(intersection.p1, intersection.p2, rect);

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

      // 动画完成后删除元素
      setTimeout(() => {
        if (edgesToDelete.length > 0) {
          const updatedEdges = edges.filter(edge => !edgesToDelete.includes(edge.id));
          setEdges(updatedEdges);
          if (onEdgesChange) {
            const pipelineEdges = updatedEdges
              .filter((e) => e.source && e.target)
              .map((e) => ({ id: e.id, source: e.source, target: e.target }));
            onEdgesChange(pipelineEdges);
          }
        }

        if (nodesToDelete.length > 0) {
          onStepRemove(nodesToDelete);
        }

        setCutEdges(new Set());
        setCutNodes(new Set());
        setCutParts([]);
      }, 700);
    }
  }, [edges, nodes, setEdges, onStepRemove, onEdgesChange, cutEdges, cutNodes]);

  // 判断点击位置是否在节点上
  const getNodeAtPosition = useCallback((clientX: number, clientY: number): string | null => {
    if (!reactFlowWrapper.current || !reactFlowInstance.current) return null;

    const flowPos = reactFlowInstance.current.screenToFlowPosition({ x: clientX, y: clientY });

    for (const node of nodes) {
      const nodeData = node as any;
      const width = nodeData.measured?.width || 200;
      const height = nodeData.measured?.height || 80;

      if (
        flowPos.x >= node.position.x &&
        flowPos.x <= node.position.x + width &&
        flowPos.y >= node.position.y &&
        flowPos.y <= node.position.y + height
      ) {
        return node.id;
      }
    }
    return null;
  }, [nodes]);

  // 右键按下 - 开始连接或切水果
  const handleCutStart = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      e.stopPropagation();

      const clickedNode = getNodeAtPosition(e.clientX, e.clientY);

      if (clickedNode && clickedNode !== 'table-node') {
        setIsConnecting(true);
        setConnectSourceNode(clickedNode);
        if (reactFlowWrapper.current) {
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          setConnectPath([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        }
      } else {
        setIsCutting(true);
        setIsClosingCut(false);
        if (reactFlowWrapper.current) {
          const rect = reactFlowWrapper.current.getBoundingClientRect();
          const startPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          setCutStartPoint(startPoint);
          setCutPath([startPoint]);
        }
      }
    }
  }, [getNodeAtPosition]);

  // 右键移动 - 连接模式或切水果模式
  const handleCutMove = useCallback((e: React.MouseEvent) => {
    if (isConnecting && reactFlowWrapper.current) {
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      setConnectPath(prev => [...prev.slice(-20), { x: e.clientX - rect.left, y: e.clientY - rect.top }]);

      const hoveredNode = getNodeAtPosition(e.clientX, e.clientY);
      if (hoveredNode && hoveredNode !== connectSourceNode) {
        setConnectTargetNode(hoveredNode);
      } else {
        setConnectTargetNode(null);
      }
    } else if (isCutting && !isClosingCut && reactFlowWrapper.current) {
      const rect = reactFlowWrapper.current.getBoundingClientRect();
      const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (cutStartPoint) {
        setCutPath([cutStartPoint, newPoint]);
      }

      // 实时碰撞检测 - 更新待删除元素高亮
      if (cutPath.length >= 2 && reactFlowInstance.current) {
        const flowPath = cutPath.map(p => reactFlowInstance.current!.screenToFlowPosition({
          x: p.x + rect.left,
          y: p.y + rect.top
        }));

        const nodePositions = new Map<string, { x: number; y: number; width: number; height: number }>();
        nodes.forEach(node => {
          const nodeData = node as any;
          nodePositions.set(node.id, {
            x: node.position.x,
            y: node.position.y,
            width: nodeData.measured?.width || 200,
            height: nodeData.measured?.height || 80,
          });
        });

        // 检测连线碰撞
        const pendingEdges = new Set<string>();
        const edgeTargets = new Set<string>();

        edges.forEach(edge => {
          const sourcePos = nodePositions.get(edge.source);
          const targetPos = nodePositions.get(edge.target);
          if (!sourcePos || !targetPos) return;

          const edgeStart = { x: sourcePos.x + sourcePos.width, y: sourcePos.y + sourcePos.height / 2 };
          const edgeEnd = { x: targetPos.x, y: targetPos.y + targetPos.height / 2 };

          for (let i = 0; i < flowPath.length - 1; i++) {
            const p1 = flowPath[i];
            const p2 = flowPath[i + 1];

            if (linesIntersect(p1.x, p1.y, p2.x, p2.y, edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y)) {
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

        // 检测节点碰撞
        const pendingNodes = new Set<string>();
        nodes.forEach(node => {
          if (node.id === 'table-node' || edgeTargets.has(node.id)) return;

          const nodePos = nodePositions.get(node.id);
          if (!nodePos) return;

          const nodeRect = {
            left: nodePos.x,
            right: nodePos.x + nodePos.width,
            top: nodePos.y,
            bottom: nodePos.y + nodePos.height,
          };

          for (let i = 0; i < flowPath.length - 1; i++) {
            if (lineIntersectsRect(flowPath[i], flowPath[i + 1], nodeRect as DOMRect)) {
              pendingNodes.add(node.id);
              break;
            }
          }
        });

        setPendingDeleteEdges(pendingEdges);
        setPendingDeleteNodes(pendingNodes);
      }
    }
  }, [isCutting, isConnecting, getNodeAtPosition, connectSourceNode, cutPath, nodes, edges, cutStartPoint, isClosingCut]);

  // 创建连线
  const createEdge = useCallback((sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    const config = createEdgeConfig(sourceId, targetId, sourceNode, targetNode);

    setEdges((eds) => {
      const existingEdge = eds.find(e => e.source === sourceId && e.target === targetId);
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
  }, [setEdges, onEdgesChange, nodes]);

  // 右键松开 - 完成连接或切水果
  const handleCutEnd = useCallback((e: React.MouseEvent) => {
    if (isConnecting) {
      e.preventDefault();
      e.stopPropagation();

      if (connectSourceNode && connectTargetNode && connectPath.length > 1) {
        createEdge(connectSourceNode, connectTargetNode);
      }

      setIsConnecting(false);
      setConnectSourceNode(null);
      setConnectTargetNode(null);
      setConnectPath([]);
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
  }, [isCutting, isConnecting, cutPath, detectAndDeleteElements, connectSourceNode, connectTargetNode, connectPath, createEdge]);

  // 屏蔽默认右键菜单
  const handlePanelContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const { nodes: layoutedNodes } = getLayoutedElements(
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
      selectedStepId,
      savedEdges,
      savedInputPosition,
      undefined,
      onTableDelete
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      if (existingNode && existingNode.position) {
        return { ...newNode, position: existingNode.position };
      }
      return newNode;
    });

    setNodes(updatedNodes);
  }, [hasTable, steps, headers, rows, columnWidths, selectedStepId, onStepClick, onStepRemove, onStepAliasUpdate, handleContextMenu, handleTableContextMenu, handleTableRename, onSave, setNodes, savedEdges, savedInputPosition, onTableDelete]);

  // 更新节点的 isCutting 属性、待删除高亮效果和切割部分
  useEffect(() => {
    setNodes(prevNodes => prevNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isCutting: cutNodes.has(node.id),
        isPendingDelete: pendingDeleteNodes.has(node.id),
        cutParts: cutParts.filter(p => p.nodeId === node.id),
      },
    })));
  }, [cutNodes, pendingDeleteNodes, cutParts]);

  // 更新连线的切断效果和待删除高亮效果
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      setEdges(prevEdges => prevEdges.map(edge => {
        const isCut = cutEdges.has(edge.id);
        const isPending = pendingDeleteEdges.has(edge.id);
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeDasharray: isCut ? '10' : undefined,
            animation: isCut ? 'cut-edge-animation 0.2s ease-out forwards' : undefined,
            stroke: isPending && !isCut ? '#f97316' : edge.style?.stroke,
            filter: isPending && !isCut ? 'drop-shadow(0 0 6px rgba(249, 115, 22, 0.7))' : undefined,
          },
        };
      }));
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

      const inputPos = positionMap.get("table-node");
      if (inputPos && onInputPositionChange) {
        onInputPositionChange(inputPos);
      }
    },
    [steps, onStepsChange, onInputPositionChange]
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
    [setEdges, onEdgesChange]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);

      const config = createEdgeConfig(connection.source, connection.target, sourceNode, targetNode);

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
          const orderChanged = reorderedSteps.some((s, i) => s.id !== steps[i].id);
          if (orderChanged) {
            onStepsChange(reorderedSteps);
          }
        }

        if (onEdgesChange) {
          const pipelineEdges: PipelineEdge[] = newEdges
            .filter((e) => e.source && e.target)
            .map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesChange(pipelineEdges);
        }

        return newEdges;
      });
    },
    [steps, onStepsChange, setEdges, onEdgesChange, nodes]
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
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: "default",
          style: { stroke: "var(--flow-line-color)", strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
        onInit={(instance) => { reactFlowInstance.current = instance; }}
      >
        <CoordinateGrid />
      </ReactFlow>

      {/* 画布搜索框 */}
      <SearchOverlay
        isOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClose={() => { setIsSearchOpen(false); setSearchQuery(""); }}
        onEnter={() => { if (searchResults.length > 0) handleSearchResultClick(searchResults[0].step, searchResults[0].isTableNode); }}
        searchResults={searchResults}
        onResultClick={handleSearchResultClick}
        searchInputRef={searchInputRef as React.RefObject<HTMLInputElement>}
      />

      {/* 切水果轨迹线 */}
      <CutVisualization isCutting={isCutting} isClosingCut={isClosingCut} cutPath={cutPath} />

      {tableContextMenu && (
        <ContextMenu
          contextMenu={{ x: tableContextMenu.x, y: tableContextMenu.y, row: null, col: tableContextMenu.col }}
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

      {/* 连接线可视化 */}
      <ConnectionVisualization
        isConnecting={isConnecting}
        connectPath={connectPath}
        connectTargetNode={connectTargetNode}
      />
    </div>
  );
}
