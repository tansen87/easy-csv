import { useCallback, useState } from "react";
import type { Dispatch, MouseEvent, RefObject, SetStateAction } from "react";
import type { Edge, Node } from "reactflow";
import type { PipelineEdge } from "@/types/xan";
import {
  buildConnectPreviewPath,
  createEdgeConfig,
  pickStartHandle,
  transformBezierPath,
  ConnectPreviewTarget,
  FlowRect,
} from "@/modules/pipeline/lib/layout";

interface UseConnectGestureArgs {
  nodes: Node[];
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  reactFlowWrapper: RefObject<HTMLDivElement | null>;
  reactFlowInstance: RefObject<any>;
  getNodeRect: (node: Node) => FlowRect;
  getNodeAtPosition: (clientX: number, clientY: number) => string | null;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
}

/**
 * Right-click connect gesture: press on a node, drag to another node with a
 * live bezier preview and snap-to-target anchors, release to create the edge.
 * New edges are committed through the local setEdges plus the onEdgesChange
 * callback (App-side sync); no pipeline steps are touched here.
 */
export function useConnectGesture({
  nodes,
  setEdges,
  reactFlowWrapper,
  reactFlowInstance,
  getNodeRect,
  getNodeAtPosition,
  onEdgesChange,
}: UseConnectGestureArgs) {
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

  // Right-click on a step node → begin the connect gesture
  const startConnect = useCallback((nodeId: string) => {
    setIsConnecting(true);
    setConnectSourceNode(nodeId);
    setConnectTargetNode(null);
    setConnectPreviewD(null);
    setConnectStartAnchor(null);
    setConnectEndAnchor(null);
  }, []);

  // Right-click move - connect mode: live preview path with target snapping
  const moveConnect = useCallback(
    (e: MouseEvent) => {
      if (
        !isConnecting ||
        !reactFlowWrapper.current ||
        !reactFlowInstance.current
      )
        return;

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
    },
    [
      isConnecting,
      getNodeAtPosition,
      getNodeRect,
      connectSourceNode,
      nodes,
      reactFlowWrapper,
      reactFlowInstance,
    ],
  );

  // Right-click release - complete the connection
  const finishConnect = useCallback(() => {
    if (connectSourceNode && connectTargetNode) {
      createEdge(connectSourceNode, connectTargetNode);
    }

    setIsConnecting(false);
    setConnectSourceNode(null);
    setConnectTargetNode(null);
    setConnectPreviewD(null);
    setConnectStartAnchor(null);
    setConnectEndAnchor(null);
  }, [connectSourceNode, connectTargetNode, createEdge]);

  return {
    isConnecting,
    connectSourceNode,
    connectPreviewD,
    connectStartAnchor,
    connectEndAnchor,
    connectTargetNode,
    startConnect,
    moveConnect,
    finishConnect,
  };
}
