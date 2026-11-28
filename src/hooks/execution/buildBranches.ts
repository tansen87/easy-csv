import type { PipelineEdge, PipelineStep } from "@/types/xan";

/**
 * Split a step graph into executable branches (input → leaf chains).
 *
 * - No edges: every step is its own single-step branch (array order).
 * - With edges: DFS from every node with no executable in-edge.
 * - Cycles throw a readable error carrying `cycleNodeIds` so the UI can mark
 *   the involved nodes red (previously this recursed forever).
 * - Only edges sourced from an executable step contribute to in-degree:
 *   `table-node`'s outgoing edges must not mark their target as
 *   "has a dependency"; otherwise in the mixed graph (table-node→S1 plus an
 *   isolated S2) S1 would be silently skipped.
 */
export interface RunPlan {
  /** All executable branches, in plan order. */
  branches: PipelineStep[][];
  /** Branch indexes the user picked, in plan order (defaults to all). */
  selectedIndexes: number[];
  /** Step instances across selected branches. */
  totalStepCount: number;
  /** Distinct step ids across selected branches. */
  uniqueStepIds: string[];
  /** Steps that appear in more than one selected branch. */
  repeatedStepIds: string[];
}

/**
 * Branch plan plus the selection subset (design 086).
 *
 * `buildExecutionBranches` answers "which paths exist"; this answers "which of
 * them will run, and how much work is that". Unknown indexes are dropped, and
 * the result keeps plan order so the menu and the run panel agree.
 */
export function buildRunPlan(
  steps: PipelineStep[],
  edges: PipelineEdge[],
  selectedIndexes?: number[],
): RunPlan {
  const branches = buildExecutionBranches(steps, edges);
  const selected = Array.from(
    new Set(
      selectedIndexes === undefined
        ? branches.map((_, index) => index)
        : selectedIndexes.filter(
            (index) =>
              Number.isInteger(index) &&
              index >= 0 &&
              index < branches.length,
          ),
    ),
  ).sort((a, b) => a - b);
  const selectedSet = new Set(selected);
  const selectedBranches = branches.filter((_, index) =>
    selectedSet.has(index),
  );

  const counts = new Map<string, number>();
  let totalStepCount = 0;
  selectedBranches.forEach((branch) => {
    branch.forEach((step) => {
      totalStepCount += 1;
      counts.set(step.id, (counts.get(step.id) ?? 0) + 1);
    });
  });

  return {
    branches,
    selectedIndexes: selected,
    totalStepCount,
    uniqueStepIds: Array.from(counts.keys()),
    repeatedStepIds: Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id),
  };
}

export function buildExecutionBranches(
  steps: PipelineStep[],
  edges: PipelineEdge[],
): PipelineStep[][] {
  if (edges.length === 0) {
    return steps.map((step) => [step]);
  }

  const stepMap = new Map<string, PipelineStep>();
  steps.forEach((step) => stepMap.set(step.id, step));

  const executableStepIds = new Set(steps.map((step) => step.id));
  const adjacency = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (executableStepIds.has(edge.target)) {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, []);
      }
      adjacency.get(edge.source)!.push(edge.target);
    }
  });

  const branches: PipelineStep[][] = [];

  // Cycle-safe DFS over the step graph. `onPath` tracks the nodes on the
  // current exploration path; revisiting one means the graph has a cycle.
  const dfs = (
    currentId: string,
    path: PipelineStep[],
    onPath: Set<string>,
  ) => {
    if (onPath.has(currentId)) {
      const chain = [...onPath, currentId];
      const err = new Error(`cycle: ${chain.join(" → ")}`) as Error & {
        cycleNodeIds: string[];
      };
      err.cycleNodeIds = chain;
      throw err;
    }
    const currentStep = stepMap.get(currentId);
    if (!currentStep) return;

    const newOnPath = new Set(onPath).add(currentId);
    const newPath = [...path, currentStep];
    const nextEdges = adjacency.get(currentId) || [];

    if (nextEdges.length === 0) {
      branches.push(newPath);
      return;
    }

    nextEdges.forEach((nextId) => {
      dfs(nextId, newPath, newOnPath);
    });
  };

  const targetIds = new Set(
    edges.filter((edge) => stepMap.has(edge.source)).map((edge) => edge.target),
  );
  const startNodes = steps
    .filter((step) => !targetIds.has(step.id))
    .map((step) => step.id);

  if (startNodes.length === 0) {
    const tableEdges = adjacency.get("table-node") || [];
    if (tableEdges.length > 0) {
      tableEdges.forEach((edge) => {
        dfs(edge, [], new Set<string>());
      });
      return branches;
    }
    return steps.map((step) => [step]);
  }

  startNodes.forEach((startId) => {
    dfs(startId, [], new Set<string>());
  });

  return branches;
}
