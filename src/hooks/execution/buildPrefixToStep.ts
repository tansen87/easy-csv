import type { PipelineEdge, PipelineStep } from "@/types/xan";

/**
 * Build the sub-chain from the input to a target step (inclusive) along the
 * edges. Used by "save intermediate result as input CSV": the output of this
 * prefix is exactly the data the target step receives.
 *
 * Linear pipelines (no edges) simply slice by array order. Branching pipelines
 * take the first DFS path that reaches the target; a disconnected target falls
 * back to the array-order prefix so it can still be inspected.
 */
export function buildPrefixToStep(
  steps: PipelineStep[],
  edges: PipelineEdge[],
  targetStepId: string,
): PipelineStep[] {
  if (!steps.some((s) => s.id === targetStepId)) return [];
  if (edges.length === 0) {
    const idx = steps.findIndex((s) => s.id === targetStepId);
    return idx >= 0 ? steps.slice(0, idx + 1) : [];
  }

  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if (e.source && e.target && stepMap.has(e.target)) {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    }
  }

  const targetIds = new Set(edges.map((e) => e.target));
  const startIds = steps.filter((s) => !targetIds.has(s.id)).map((s) => s.id);

  const visited = new Set<string>();
  const stack: Array<{ id: string; path: string[] }> = startIds.map((id) => ({
    id,
    path: [],
  }));
  while (stack.length > 0) {
    const { id, path } = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const newPath = [...path, id];
    if (id === targetStepId) {
      return newPath.map((nid) => stepMap.get(nid)!).filter(Boolean);
    }
    for (const next of adjacency.get(id) || []) {
      stack.push({ id: next, path: newPath });
    }
  }

  // Not reachable via edges; fall back to array-order prefix.
  const idx = steps.findIndex((s) => s.id === targetStepId);
  return idx >= 0 ? steps.slice(0, idx + 1) : [];
}
