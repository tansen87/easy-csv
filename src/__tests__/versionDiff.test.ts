import { describe, it, expect } from "vitest";
import {
  diffSnapshots,
  snapshotsEqual,
  summarizeDiff,
  stepSignature,
} from "@/utils/versionDiff";
import { PipelineSnapshot } from "@/utils/versionDiff";

function step(id: string, commandId: string, parameters = {}) {
  return { id, commandId, parameters };
}

describe("versionDiff", () => {
  const base: PipelineSnapshot = {
    steps: [
      step("a", "select", { col: "x" }),
      step("b", "sort", { key: "x" }),
    ],
    edges: [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "input", target: "a" },
    ],
  };

  it("detects added steps and edges", () => {
    const next: PipelineSnapshot = {
      steps: [step("a", "select", { col: "x" }), step("c", "count")],
      edges: [{ id: "e1", source: "a", target: "c" }],
    };
    const diff = diffSnapshots(base, next);
    expect(diff.addedSteps.map((s) => s.id)).toEqual(["c"]);
    expect(diff.removedSteps.map((s) => s.id)).toEqual(["b"]);
    expect(diff.modifiedSteps).toEqual([]);
    expect(diff.addedEdges).toHaveLength(1);
    expect(diff.removedEdges).toHaveLength(2);
    const sum = summarizeDiff(diff);
    expect(sum.addedSteps).toBe(1);
    expect(sum.removedSteps).toBe(1);
  });

  it("detects parameter modifications", () => {
    const next: PipelineSnapshot = {
      steps: [
        step("a", "select", { col: "y" }),
        step("b", "sort", { key: "x" }),
      ],
      edges: base.edges,
    };
    const diff = diffSnapshots(base, next);
    expect(diff.modifiedSteps).toHaveLength(1);
    expect(diff.modifiedSteps[0].id).toBe("a");
  });

  it("snapshotsEqual compares parameter-independent ids and values", () => {
    expect(
      snapshotsEqual(base, {
        steps: [
          step("a", "select", { col: "x" }),
          step("b", "sort", { key: "x" }),
        ],
        edges: [...base.edges].reverse(),
      }),
    ).toBe(true);
    expect(snapshotsEqual(base, { steps: base.steps, edges: [] })).toBe(false);
  });

  it("stepSignature orders parameter keys deterministically", () => {
    expect(stepSignature(step("a", "c", { b: 1, a: 2 }))).toBe(
      stepSignature(step("a", "c", { a: 2, b: 1 })),
    );
  });
});
