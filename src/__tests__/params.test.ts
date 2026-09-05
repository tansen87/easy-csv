import { describe, it, expect } from "vitest";
import {
  extractVariableNames,
  inferVariableType,
  hasPlaceholder,
  collectVariablesFromPipeline,
  resolveValue,
  resolveStepPlaceholders,
} from "@/utils/params";
import { PipelineStep } from "@/types/xan";

function step(id: string, name: string, parameters: Record<string, any>): PipelineStep {
  return {
    id,
    command: { id: name, name, description: "", descriptionCn: "", category: "", parameters: [] },
    parameters,
  };
}

describe("params", () => {
  describe("extractVariableNames", () => {
    it("finds distinct placeholder names in order", () => {
      expect(extractVariableNames("--col {{name}} and {{limit}}")).toEqual([
        "name",
        "limit",
      ]);
    });
    it("ignores braces and handles spacing", () => {
      expect(extractVariableNames("{{name}} {{ name }}")).toEqual(["name"]);
    });
    it("returns [] for non-strings and plain values", () => {
      expect(extractVariableNames("no placeholder")).toEqual([]);
    });
  });

  describe("inferVariableType", () => {
    it("infers number", () => {
      expect(inferVariableType("42")).toBe("number");
    });
    it("infers path", () => {
      expect(inferVariableType("/data/out.csv")).toBe("path");
      expect(inferVariableType("out.tsv")).toBe("path");
    });
    it("defaults to string", () => {
      expect(inferVariableType("hello")).toBe("string");
      expect(inferVariableType("")).toBe("string");
    });
  });

  describe("collectVariablesFromPipeline", () => {
    it("collects referenced variables and merges declared metadata", () => {
      const vars = collectVariablesFromPipeline(
        [step("a", "select", { pattern: "{{col}}" }), step("b", "head", { n: "{{limit}}" })],
        [
          { name: "col", defaultValue: "id", type: "string" },
          { name: "limit", defaultValue: "100", type: "number" },
        ],
      );
      expect(vars.map((v) => v.name)).toEqual(["col", "limit"]);
      expect(vars[0].defaultValue).toBe("id");
      expect(vars[1].type).toBe("number");
    });
  });

  describe("resolveValue / resolveStepPlaceholders", () => {
    it("replaces known placeholders and leaves unknown intact", () => {
      expect(resolveValue("{{x}} {{y}}", { x: "1" })).toBe("1 {{y}}");
    });
    it("resolves across steps and arrays without mutating input", () => {
      const steps = [step("a", "fill", { value: "{{x}}" }), step("b", "to", { path: ["{{x}}"] })];
      const resolved = resolveStepPlaceholders(steps, { x: "42" });
      expect(resolved[0].parameters.value).toBe("42");
      expect(resolved[1].parameters.path).toEqual(["42"]);
      expect(steps[0].parameters.value).toBe("{{x}}");
      expect(hasPlaceholder(steps[0].parameters.value)).toBe(true);
    });
    it("returns input unchanged when no values", () => {
      const steps = [step("a", "fill", { value: "{{x}}" })];
      const resolved = resolveStepPlaceholders(steps, {});
      expect(resolved[0].parameters.value).toBe("{{x}}");
    });
  });
});