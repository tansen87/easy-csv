import type { PipelineEdge, PipelineStep } from "@/types/xan";

/**
 * Sub-chain from a target step to the end of its branch (inclusive). The
 * counterpart of `buildPrefixToStep`, used by "run from this step": the target
 * step's input is supplied by the caller (usually the upstream step's last
 * exported CSV), so only the target and everything downstream of it run.
 *
 * Linear pipelines (no edges) slice by array order. Branching pipelines keep
 * every node reachable from the target, in pipeline order. An unknown target
 * yields an empty list.
 */
export function buildSuffixFromStep(
  steps: PipelineStep[],
  edges: PipelineEdge[],
  targetStepId: string,
): PipelineStep[] {
  const targetIndex = steps.findIndex((s) => s.id === targetStepId);
  if (targetIndex < 0) return [];
  if (edges.length === 0) return steps.slice(targetIndex);

  const stepIds = new Set(steps.map((s) => s.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    if (!stepIds.has(edge.source) || !stepIds.has(edge.target)) continue;
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const reachable = new Set<string>();
  const stack: string[] = [targetStepId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const next of adjacency.get(id) || []) stack.push(next);
  }

  return steps.filter((step) => reachable.has(step.id));
}
