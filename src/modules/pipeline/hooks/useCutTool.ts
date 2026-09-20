import { useCallback, useEffect, useState } from "react";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";
import type { Edge, Node } from "reactflow";
import type { PipelineEdge } from "@/types/xan";
import { getEdgeEndpoints } from "@/modules/pipeline/lib/layout";
import {
  getCutIntersectionPoints,
  generateCutClipPaths,
  calculateFallVector,
  pointToLineDistance,
  linesIntersect,
  lineIntersectsRect,
  CutPartInfo,
} from "@/modules/pipeline/lib/cutGeometry";

interface UseCutToolArgs {
  nodes: Node[];
  edges: Edge[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  /** Live edge snapshot so delayed animations never read stale arrays. */
  edgesRef: RefObject<Edge[]>;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  reactFlowInstance: RefObject<any>;
  getNodeRect: (node: Node) => {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onStepRemove: (stepId: string | string[], extraEdgeIds?: string[]) => void;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
}

/**
 * Right-click cut-to-delete tool: freehand cut path, real-time pending-delete
 * highlighting, the two-phase deletion animation (edges 200ms, falling node
 * parts 400ms) and the cut/pending visual effects on nodes and edges.
 *
 * Deletion goes through the onStepRemove / onEdgesChange callbacks; the local
 * setEdges/setNodes calls only maintain the transient ReactFlow canvas state.
 */
export function useCutTool({
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
}: UseCutToolArgs) {
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
    [
      edges,
      nodes,
      setEdges,
      edgesRef,
      reactFlowWrapper,
      reactFlowInstance,
      onStepRemove,
      onEdgesChange,
      cutEdges,
      cutNodes,
    ],
  );

  // Right-click - start cutting (blank area or table node)
  const startCut = useCallback(
    (e: MouseEvent) => {
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
    },
    [reactFlowWrapper],
  );

  // Right-click move - cut mode: extend the path and update pending highlights
  const moveCut = useCallback(
    (e: MouseEvent) => {
      if (!isCutting || isClosingCut || !reactFlowWrapper.current) return;

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
    },
    [
      isCutting,
      isClosingCut,
      getNodeRect,
      cutPath,
      nodes,
      edges,
      cutStartPoint,
      reactFlowWrapper,
      reactFlowInstance,
    ],
  );

  // Right-click release - complete the cut
  const finishCut = useCallback(() => {
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
  }, [cutPath, detectAndDeleteElements]);

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
  }, [cutNodes, pendingDeleteNodes, cutParts, setNodes]);

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
  }, [cutEdges, pendingDeleteEdges, setEdges]);

  return {
    cutPath,
    isCutting,
    isClosingCut,
    cutNodes,
    cutEdges,
    cutParts,
    pendingDeleteNodes,
    pendingDeleteEdges,
    startCut,
    moveCut,
    finishCut,
  };
}
