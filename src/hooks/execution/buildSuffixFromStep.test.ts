import { describe, expect, it } from "vitest";
import { buildSuffixFromStep } from "@/hooks/execution/buildSuffixFromStep";
import type { PipelineEdge, PipelineStep } from "@/types/xan";

function step(id: string): PipelineStep {
  return {
    id,
    command: { id, name: `cmd-${id}`, parameters: [] },
    parameters: {},
  } as unknown as PipelineStep;
}

function edge(source: string, target: string): PipelineEdge {
  return { id: `${source}->${target}`, source, target } as PipelineEdge;
}

describe("buildSuffixFromStep", () => {
  it("no edges: slices by array order from the target to the end", () => {
    const steps = [step("a"), step("b"), step("c")];
    expect(buildSuffixFromStep(steps, [], "b").map((s) => s.id)).toEqual([
      "b",
      "c",
    ]);
  });

  it("linear graph: keeps the target and everything downstream", () => {
    const steps = [step("a"), step("b"), step("c")];
    const edges = [edge("a", "b"), edge("b", "c")];
    expect(buildSuffixFromStep(steps, edges, "b").map((s) => s.id)).toEqual([
      "b",
      "c",
    ]);
  });

  it("branching graph: keeps both downstream branches, never upstream", () => {
    const steps = [step("a"), step("b"), step("c"), step("d")];
    const edges = [edge("a", "b"), edge("b", "c"), edge("b", "d")];
    expect(buildSuffixFromStep(steps, edges, "b").map((s) => s.id)).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("isolated target: returns only itself", () => {
    const steps = [step("a"), step("b"), step("c")];
    const edges = [edge("a", "b")];
    expect(buildSuffixFromStep(steps, edges, "c").map((s) => s.id)).toEqual([
      "c",
    ]);
  });

  it("unknown target: empty list", () => {
    expect(buildSuffixFromStep([step("a")], [], "nope")).toEqual([]);
  });
});
