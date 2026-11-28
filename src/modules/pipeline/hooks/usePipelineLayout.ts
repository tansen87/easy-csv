import { useEffect, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Edge, Node } from "reactflow";
import type { PipelineStep } from "@/types/xan";
import { getLayoutedElements } from "@/modules/pipeline/lib/layout";

interface UsePipelineLayoutArgs {
  hasTable: boolean;
  steps: PipelineStep[];
  headers: string[];
  rows: string[][];
  columnWidths: Record<number, number>;
  /** Basename of the input file, forwarded to the table node footer. */
  inputFileName?: string;
  savedEdges?: PipelineStep extends never ? never : any[];
  savedInputPosition?: { x: number; y: number };
  delimiter?: string;
  delimiterMode?: string;
  delimiterSource?: string;
  delimiterConfidence?: "high" | "low" | "none";
  /** Input file format; non-CSV inputs show a read-only badge. */
  inputFormat?: string;
  /** Chosen table when the input is a `.duckdb` file. */
  sourceTable?: string;
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
  handleContextMenu: (
    stepId: string,
    x: number,
    y: number,
    openMenu?: boolean,
  ) => void;
  handleTableContextMenu: (col: number, x: number, y: number) => void;
  nodes: Node[];
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  /** Bumped to re-run layout while ignoring saved/manual positions. */
  layoutResetKey?: number;
  /** Locked canvas: hide step action strips. */
  locked?: boolean;
  /** Called once after a forced layout so the new positions can be persisted. */
  onLayoutApplied?: (nodes: Node[]) => void;
}

/**
 * Canvas layout reconciliation: recompute node/edge layout when data changes,
 * inject result-preview nodes with position memory, and apply
 * selection/highlight as visual-only node properties.
 */
export function usePipelineLayout({
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
  onLayoutApplied,
}: UsePipelineLayoutArgs) {
  const lastLayoutResetRef = useRef(layoutResetKey ?? 0);
  const onLayoutAppliedRef = useRef(onLayoutApplied);
  onLayoutAppliedRef.current = onLayoutApplied;

  // Re-compute layout when data changes (not callbacks)
  useEffect(() => {
    // "Tidy" bumps the key: recompute the default layout, ignoring manual
    // positions.
    const forceReset =
      layoutResetKey !== undefined &&
      layoutResetKey !== lastLayoutResetRef.current;
    if (forceReset) lastLayoutResetRef.current = layoutResetKey;
    const layoutSteps = forceReset
      ? steps.map((step) => ({ ...step, position: undefined }))
      : steps;

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      hasTable,
      layoutSteps,
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
      forceReset ? undefined : savedInputPosition,
      highlightedNodeId,
      onTableDeleteRef.current,
      locked,
    );

    const updatedNodes = layoutedNodes.map((newNode) => {
      const existingNode = nodes.find((n) => n.id === newNode.id);
      const withPosition =
        !forceReset && existingNode && existingNode.position
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
            fileName: inputFileName,
            delimiter,
            delimiterMode,
            delimiterSource,
            delimiterConfidence,
            inputFormat: inputFormat as any,
            sourceTable,
            onDelimiterChange: onDelimiterChangeRef.current,
          },
        };
      }
      return withPosition;
    });

    setNodes(updatedNodes);
    setEdges(layoutedEdges);
    if (forceReset) {
      onLayoutAppliedRef.current?.(updatedNodes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
    layoutResetKey,
    locked,
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
