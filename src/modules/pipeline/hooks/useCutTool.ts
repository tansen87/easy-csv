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
  const [cutEdges, setCutEdges] = useState<Set<string>>(new Set());
  // Cut part information (used for the split animation)
  const [cutParts, setCutParts] = useState<CutPartInfo[]>([]);
  // Segment of the pending cut inside each node, in node-local coordinates.
  const [pendingSeams, setPendingSeams] = useState<
    Record<string, { x1: number; y1: number; x2: number; y2: number }>
  >({});
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

        // Edges not connected to the cutting nodes → delete them with extra parameter;
        // Edges connected to the cutting nodes are automatically cleaned up.
        const nodeIdSet = new Set(nodesToDelete);
        const extraEdgeIds = edgesToDelete
          .filter((e) => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target))
          .map((e) => e.id);

        // Restore the original falling-halves animation: gravity plus a little
        // of the cut direction, with a small rotation.
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

        // Original rhythm: edges go first (200ms), the two halves fall and
        // rotate for the full 700ms before the step leaves the canvas.
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
          setCutParts([]);
        }, 740);
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

        // Segment of the straight cut inside each pending node, used for the
        // 1px seam preview drawn on the card.
        const seams: Record<
          string,
          { x1: number; y1: number; x2: number; y2: number }
        > = {};
        const flowStart = flowPath[0];
        const flowEnd = flowPath[flowPath.length - 1];
        pendingNodes.forEach((id) => {
          const nodePos = nodePositions.get(id);
          if (!nodePos) return;
          const localStart = {
            x: flowStart.x - nodePos.x,
            y: flowStart.y - nodePos.y,
          };
          const localEnd = {
            x: flowEnd.x - nodePos.x,
            y: flowEnd.y - nodePos.y,
          };
          const hit = getCutIntersectionPoints(localStart, localEnd, {
            x: 0,
            y: 0,
            width: nodePos.width,
            height: nodePos.height,
          });
          if (hit) {
            seams[id] = {
              x1: hit.p1.x,
              y1: hit.p1.y,
              x2: hit.p2.x,
              y2: hit.p2.y,
            };
          }
        });

        setPendingDeleteEdges(pendingEdges);
        setPendingDeleteNodes(pendingNodes);
        setPendingSeams(seams);
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
      setPendingSeams({});
    }, 220);
  }, [cutPath, detectAndDeleteElements]);

  // Update node's pending-delete highlight, seam preview and cut parts
  useEffect(() => {
    setNodes((prevNodes) =>
      prevNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          isPendingDelete: pendingDeleteNodes.has(node.id),
          pendingSeam: pendingSeams[node.id] ?? null,
          cutParts: cutParts.filter((p) => p.nodeId === node.id),
        },
      })),
    );
  }, [pendingDeleteNodes, pendingSeams, cutParts, setNodes]);

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
              strokeDasharray: isCut ? "10" : isPending ? "3 4" : undefined,
              animation: isCut
                ? "cut-edge-retract 0.2s cubic-bezier(0.2, 0, 0, 1) forwards"
                : undefined,
              stroke: isPending && !isCut ? "var(--danger)" : edge.style?.stroke,
              strokeOpacity: isPending && !isCut ? 0.55 : undefined,
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
    cutEdges,
    cutParts,
    pendingDeleteNodes,
    pendingDeleteEdges,
    startCut,
    moveCut,
    finishCut,
  };
}
