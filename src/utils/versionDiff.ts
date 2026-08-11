import { PipelineEdge, StoredPipelineStep } from "@/types/xan";

export interface PipelineSnapshot {
  steps: StoredPipelineStep[];
  edges: PipelineEdge[];
}

export interface ModifiedStep {
  id: string;
  before: StoredPipelineStep;
  after: StoredPipelineStep;
}

export interface VersionDiff {
  addedSteps: StoredPipelineStep[];
  removedSteps: StoredPipelineStep[];
  modifiedSteps: ModifiedStep[];
  addedEdges: PipelineEdge[];
  removedEdges: PipelineEdge[];
}

export interface VersionDiffSummary {
  addedSteps: number;
  removedSteps: number;
  modifiedSteps: number;
  addedEdges: number;
  removedEdges: number;
}

function normalizeParameters(params: Record<string, any>): string {
  const sorted: Record<string, any> = {};
  Object.keys(params || {})
    .sort()
    .forEach((k) => {
      sorted[k] = params[k];
    });
  return JSON.stringify(sorted);
}

export function stepSignature(step: StoredPipelineStep): string {
  return `${step.commandId}|${step.alias || ""}|${normalizeParameters(
    step.parameters,
  )}`;
}

export function snapshotsEqual(
  a: PipelineSnapshot,
  b: PipelineSnapshot,
): boolean {
  if (a.steps.length !== b.steps.length || a.edges.length !== b.edges.length) {
    return false;
  }
  const aSteps = [...a.steps].sort((x, y) => x.id.localeCompare(y.id));
  const bSteps = [...b.steps].sort((x, y) => x.id.localeCompare(y.id));
  for (let i = 0; i < aSteps.length; i++) {
    if (
      aSteps[i].id !== bSteps[i].id ||
      stepSignature(aSteps[i]) !== stepSignature(bSteps[i])
    ) {
      return false;
    }
  }
  const aEdges = [...a.edges].sort((x, y) => x.id.localeCompare(y.id));
  const bEdges = [...b.edges].sort((x, y) => x.id.localeCompare(y.id));
  for (let i = 0; i < aEdges.length; i++) {
    if (
      aEdges[i].source !== bEdges[i].source ||
      aEdges[i].target !== bEdges[i].target
    ) {
      return false;
    }
  }
  return true;
}

export function diffSnapshots(
  before: PipelineSnapshot,
  after: PipelineSnapshot,
): VersionDiff {
  const beforeSteps = new Map(
    (before.steps || []).map((s) => [s.id, s] as const),
  );
  const afterSteps = new Map(
    (after.steps || []).map((s) => [s.id, s] as const),
  );

  const addedSteps: StoredPipelineStep[] = [];
  const removedSteps: StoredPipelineStep[] = [];
  const modifiedSteps: ModifiedStep[] = [];

  afterSteps.forEach((step, id) => {
    const prev = beforeSteps.get(id);
    if (!prev) {
      addedSteps.push(step);
    } else if (stepSignature(prev) !== stepSignature(step)) {
      modifiedSteps.push({ id, before: prev, after: step });
    }
  });

  beforeSteps.forEach((step, id) => {
    if (!afterSteps.has(id)) removedSteps.push(step);
  });

  const beforeEdges = new Set(
    (before.edges || []).map((e) => `${e.source}|${e.target}`),
  );
  const afterEdges = new Set(
    (after.edges || []).map((e) => `${e.source}|${e.target}`),
  );

  const addedEdges = (after.edges || []).filter(
    (e) => !beforeEdges.has(`${e.source}|${e.target}`),
  );
  const removedEdges = (before.edges || []).filter(
    (e) => !afterEdges.has(`${e.source}|${e.target}`),
  );

  return { addedSteps, removedSteps, modifiedSteps, addedEdges, removedEdges };
}

export function summarizeDiff(diff: VersionDiff): VersionDiffSummary {
  return {
    addedSteps: diff.addedSteps.length,
    removedSteps: diff.removedSteps.length,
    modifiedSteps: diff.modifiedSteps.length,
    addedEdges: diff.addedEdges.length,
    removedEdges: diff.removedEdges.length,
  };
}
