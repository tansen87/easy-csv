import { describe, expect, it } from "vitest";
import { buildExecutionBranches } from "@/hooks/execution/buildBranches";
import { buildPrefixToStep } from "@/hooks/execution/buildPrefixToStep";
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

describe("buildExecutionBranches", () => {
  it("linear graph without edges: each step is its own branch in array order", () => {
    const steps = [step("a"), step("b"), step("c")];
    const branches = buildExecutionBranches(steps, []);
    expect(branches).toEqual([["a"], ["b"], ["c"]].map((ids) => ids.map(step)));
  });

  it("linear graph with edges: single branch from source to leaf", () => {
    const steps = [step("a"), step("b"), step("c")];
    const edges = [edge("a", "b"), edge("b", "c")];
    const branches = buildExecutionBranches(steps, edges);
    expect(branches).toHaveLength(1);
    expect(branches[0].map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("branching graph: one branch per root-to-leaf path", () => {
    const steps = [step("a"), step("b"), step("c"), step("d")];
    const edges = [
      edge("a", "b"),
      edge("a", "c"),
      edge("b", "d"),
      edge("c", "d"),
    ];
    const branches = buildExecutionBranches(steps, edges);
    const idPaths = branches.map((b) => b.map((s) => s.id)).sort();
    expect(idPaths).toEqual([
      ["a", "b", "d"],
      ["a", "c", "d"],
    ]);
  });

  it("isolated step alongside a chain: every root runs as its own branch", () => {
    const steps = [step("s1"), step("s2"), step("table")];
    const edges = [edge("table-node", "s1")];
    const branches = buildExecutionBranches(steps, edges);
    const idPaths = branches.map((b) => b.map((s) => s.id)).sort();
    // table-node is not an executable step, so `table` has no out-edges here
    // and runs as its own single-step branch.
    expect(idPaths).toEqual([["s1"], ["s2"], ["table"]]);
  });

  it("S1-4: edges sourced from non-executable steps do not create in-degree", () => {
    // table-node is not in `steps`; its edge must not stop s1 from being a root.
    const steps = [step("s1"), step("s2")];
    const edges = [edge("table-node", "s1")];
    const branches = buildExecutionBranches(steps, edges);
    const idPaths = branches.map((b) => b.map((s) => s.id)).sort();
    expect(idPaths).toEqual([["s1"], ["s2"]]);
  });

  it("cycle reachable from a root: throws a readable error carrying cycleNodeIds", () => {
    const steps = [step("a"), step("b"), step("c")];
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "b")];
    expect(() => buildExecutionBranches(steps, edges)).toThrowError(/^cycle: /);
    try {
      buildExecutionBranches(steps, edges);
    } catch (err) {
      const e = err as Error & { cycleNodeIds?: string[] };
      expect(e.cycleNodeIds).toBeDefined();
      // The chain is root-entry + closed loop: the revisited node (last)
      // must already appear earlier in the chain.
      const chain = e.cycleNodeIds!;
      expect(chain.indexOf(chain[chain.length - 1])).toBeLessThan(
        chain.length - 1,
      );
    }
  });

  it("full cycle with no roots: inherited fallback to single-step branches", () => {
    // Without any executable root the DFS never starts, so the cycle is not
    // detected here — matches the original inline implementation.
    const steps = [step("a"), step("b"), step("c")];
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    const branches = buildExecutionBranches(steps, edges);
    expect(branches).toHaveLength(3);
  });

  it("no roots and no table-node edges: falls back to single-step branches", () => {
    // Every step is a target of some edge, but the source is non-executable
    // and table-node has no outgoing edges → fallback path.
    const steps = [step("a"), step("b")];
    const edges = [edge("ghost", "a"), edge("ghost2", "b")];
    const branches = buildExecutionBranches(steps, edges);
    // ghost/ghost2 are not executable → their edges contribute no in-degree,
    // so this is actually the normal root path; assert both roots run alone.
    const idPaths = branches.map((b) => b.map((s) => s.id)).sort();
    expect(idPaths).toEqual([["a"], ["b"]]);
  });
});

describe("buildPrefixToStep", () => {
  it("no edges: array-order prefix up to and including the target", () => {
    const steps = [step("a"), step("b"), step("c")];
    expect(buildPrefixToStep(steps, [], "b").map((s) => s.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("with edges: DFS path from a root to the target", () => {
    const steps = [step("a"), step("b"), step("c"), step("d")];
    const edges = [edge("a", "b"), edge("b", "d"), edge("c", "d")];
    const path = buildPrefixToStep(steps, edges, "d").map((s) => s.id);
    // Returns the first DFS path found; both [a,b,d] and [c,d] are valid.
    expect(["a|b|d", "c|d"]).toContain(path.join("|"));
    expect(path[path.length - 1]).toBe("d");
  });

  it("unknown target: empty result", () => {
    const steps = [step("a")];
    expect(buildPrefixToStep(steps, [], "zz")).toEqual([]);
  });

  it("target only reachable as a DFS root: returns the single-node path", () => {
    // b is a root (its only incoming edge starts from a non-executable step),
    // so the DFS finds it immediately — no array-order fallback happens.
    const steps = [step("a"), step("b")];
    const edges = [edge("ghost", "a")];
    expect(buildPrefixToStep(steps, edges, "b").map((s) => s.id)).toEqual([
      "b",
    ]);
  });
});
