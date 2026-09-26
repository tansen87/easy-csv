import { useEffect, useState } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Edge, Node } from "reactflow";
import type { PipelineStep } from "@/types/xan";
import type { ResultPreview } from "@/types/execution";
import { getLayoutedElements } from "@/modules/pipeline/lib/layout";

interface UsePipelineLayoutArgs {
  hasTable: boolean;
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  savedEdges?: PipelineStep extends never ? never : any[];
  savedInputPosition?: { x: number; y: number };
  resultPreview?: ResultPreview[];
  delimiter?: string;
  delimiterMode?: string;
  delimiterSource?: string;
  delimiterConfidence?: "high" | "low" | "none";
  selectedStepId?: string;
  highlightedNodeId: string | null;
  // Callback refs captured to avoid unnecessary re-layout
  onStepClickRef: RefObject<(step: PipelineStep) => void>;
  onStepRemoveRef: RefObject<
    (stepId: string | string[], extraEdgeIds?: string[]) => void
  >;
  onStepAliasUpdateRef: RefObject<(stepId: string, alias: string) => void>;
  onTableRenameRef: RefObject<(col: number, newName: string) => void>;
  onSaveRef: RefObject<() => void>;
  onTableDeleteRef: RefObject<(() => void) | undefined>;
  onDelimiterChangeRef: RefObject<((mode: any) => void) | undefined>;
  handleContextMenu: (stepId: string, x: number, y: number) => void;
  handleTableContextMenu: (col: number, x: number, y: number) => void;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
}

/**
 * Canvas layout reconciliation: recompute node/edge layout when data changes,
 * inject result-preview nodes (F1) with position memory, and apply
 * selection/highlight as visual-only node properties.
 */
export function usePipelineLayout({
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
}: UsePipelineLayoutArgs) {
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
      onTableRenameRef.current,
      onSaveRef.current,
      selectedStepId,
      savedEdges as any,
      savedInputPosition,
      highlightedNodeId,
      onTableDeleteRef.current,
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      const withPosition =
        existingNode && existingNode.position
          ? {
              ...newNode,
              position: existingNode.position,
              selected: existingNode.selected,
            }
          : newNode;

      // The input node renders the delimiter badge, so its data is enriched
      // here instead of threading it through `getLayoutedElements`.
      if (withPosition.type === "tableNode") {
        return {
          ...withPosition,
          data: {
            ...withPosition.data,
            delimiter,
            delimiterMode,
            delimiterSource,
            delimiterConfidence,
            onDelimiterChange: onDelimiterChangeRef.current,
          },
        };
      }
      return withPosition;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    delimiter,
    delimiterMode,
    delimiterSource,
    delimiterConfidence,
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
  }, [selectedStepId, highlightedNodeId, setNodes]);
}
