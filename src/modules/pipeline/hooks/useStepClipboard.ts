import { useCallback, useRef } from "react";
import type { Edge } from "reactflow";
import type { PipelineEdge, PipelineStep } from "@/types/xan";

interface UseStepClipboardArgs {
  steps: PipelineStep[];
  edges: Edge[];
  selectedNodeIds: Set<string>;
  /** Clear the multi-selection after a successful copy (closes the action bar). */
  clearSelection: () => void;
  onStepsChange: (steps: PipelineStep[]) => void;
  onEdgesChange?: (edges: PipelineEdge[]) => void;
}

/**
 * Step copy/paste clipboard (Ctrl+C / Ctrl+V and the canvas context menu).
 * Reads the canvas selection, writes back exclusively through the
 * onStepsChange / onEdgesChange callbacks so the undo stack stays consistent.
 */
export function useStepClipboard({
  steps,
  edges,
  selectedNodeIds,
  clearSelection,
  onStepsChange,
  onEdgesChange,
}: UseStepClipboardArgs) {
  const clipboardRef = useRef<{
    steps: PipelineStep[];
    edges: { source: string; target: string }[];
  } | null>(null);

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
    clearSelection();
  }, [selectedNodeIds, steps, edges, clearSelection]);

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

  return { clipboardRef, handleCopySelected, handlePasteClipboard };
}
