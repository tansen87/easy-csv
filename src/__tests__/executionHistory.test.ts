import { describe, it, expect } from "vitest";
import {
  hashString,
  computePipelineSnapshotHash,
  buildOutputSummary,
} from "@/utils/executionHistory";
import { PipelineEdge, StoredPipelineStep } from "@/types/xan";

function storedStep(
  id: string,
  commandId: string,
  parameters: Record<string, any>,
): StoredPipelineStep {
  return { id, commandId, parameters };
}

const steps: StoredPipelineStep[] = [
  storedStep("s1", "drop", { column: "a" }),
  storedStep("s2", "sort", { column: "b" }),
];
const edges: PipelineEdge[] = [{ id: "e1", source: "s1", target: "s2" }];

describe("executionHistory", () => {
  describe("hashString", () => {
    it("is deterministic", () => {
      expect(hashString("abc")).toBe(hashString("abc"));
    });
    it("differs for different inputs", () => {
      expect(hashString("abc")).not.toBe(hashString("abd"));
    });
    it("produces a hex string", () => {
      expect(hashString("hello")).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe("computePipelineSnapshotHash", () => {
    it("is stable for the same pipeline", () => {
      expect(computePipelineSnapshotHash(steps, edges)).toBe(
        computePipelineSnapshotHash(steps, edges),
      );
    });
    it("is insensitive to step order", () => {
      const shuffled = [steps[1], steps[0]];
      expect(computePipelineSnapshotHash(shuffled, edges)).toBe(
        computePipelineSnapshotHash(steps, edges),
      );
    });
    it("changes when a parameter changes", () => {
      const modified = [storedStep("s1", "drop", { column: "b" }), steps[1]];
      expect(computePipelineSnapshotHash(modified, edges)).not.toBe(
        computePipelineSnapshotHash(steps, edges),
      );
    });
    it("changes when an edge changes", () => {
      const otherEdges: PipelineEdge[] = [
        { id: "e2", source: "s2", target: "s1" },
      ];
      expect(computePipelineSnapshotHash(steps, otherEdges)).not.toBe(
        computePipelineSnapshotHash(steps, edges),
      );
    });
  });

  describe("buildOutputSummary", () => {
    it("sums rows and max columns across successful outputs", () => {
      const summary = buildOutputSummary([
        { success: true, output: "a,b\n1,2\n3,4" },
        { success: true, output: "x,y,z\n5,6,7" },
      ]);
      expect(summary.columns).toBe(3);
      expect(summary.rows).toBe(3);
      expect(summary.bytes).toBeGreaterThan(0);
      expect(summary.preview).toEqual(["a,b", "1,2", "3,4"]);
    });
    it("skips failed and empty outputs", () => {
      const summary = buildOutputSummary([
        { success: false, output: "boom" },
        { success: true, output: "" },
        { success: true, output: "h\n1" },
      ]);
      expect(summary.rows).toBe(1);
      expect(summary.columns).toBe(1);
      expect(summary.preview).toEqual(["h", "1"]);
    });
    it("caps preview at 3 lines", () => {
      const summary = buildOutputSummary([
        {
          success: true,
          output: Array.from({ length: 10 }, (_, i) => `l${i}`).join("\n"),
        },
      ]);
      expect(summary.preview).toHaveLength(3);
    });
    it("returns zeros when there is no output", () => {
      const summary = buildOutputSummary([{ success: true }]);
      expect(summary).toEqual({ columns: 0, rows: 0, bytes: 0, preview: [] });
    });
  });
});
