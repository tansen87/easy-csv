import { describe, it, expect } from "vitest";
import {
  extractVariableNames,
  inferVariableType,
  hasPlaceholder,
  collectVariablesFromPipeline,
  collectVariableRefs,
  isValidVariableName,
  resolveValue,
  resolveStepPlaceholders,
} from "@/utils/params";
import { PipelineStep } from "@/types/xan";

function step(
  id: string,
  name: string,
  parameters: Record<string, any>,
): PipelineStep {
  return {
    id,
    command: {
      id: name,
      name,
      description: "",
      descriptionCn: "",
      category: "",
      parameters: [],
    },
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

  describe("isValidVariableName", () => {
    it("accepts the placeholder grammar", () => {
      expect(isValidVariableName("limit")).toBe(true);
      expect(isValidVariableName("_col")).toBe(true);
      expect(isValidVariableName("col2")).toBe(true);
    });
    it("rejects names that {{…}} could never match", () => {
      expect(isValidVariableName("开始 日期")).toBe(false);
      expect(isValidVariableName("2col")).toBe(false);
      expect(isValidVariableName("")).toBe(false);
    });
  });

  describe("collectVariableRefs", () => {
    it("records step, command label and parameter for each reference", () => {
      const s1 = step("a", "select", { pattern: "{{col}}" });
      s1.alias = "取列";
      const refs = collectVariableRefs([
        s1,
        step("b", "head", { n: "{{limit}}", columns: ["{{col}}", "x"] }),
      ]);
      expect(refs).toEqual([
        {
          name: "col",
          stepIndex: 1,
          stepId: "a",
          commandLabel: "取列",
          paramKey: "pattern",
        },
        {
          name: "limit",
          stepIndex: 2,
          stepId: "b",
          commandLabel: "head",
          paramKey: "n",
        },
        {
          name: "col",
          stepIndex: 2,
          stepId: "b",
          commandLabel: "head",
          paramKey: "columns",
        },
      ]);
    });
    it("dedupes repeat mentions inside one parameter", () => {
      const refs = collectVariableRefs([
        step("a", "filter", { value: "{{d}} .. {{d}}" }),
      ]);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toMatchObject({ name: "d", paramKey: "value" });
    });
    it("skips non-string parameters", () => {
      const refs = collectVariableRefs([
        step("a", "head", { n: 10, flag: true, list: [1, "{{ok}}"] }),
      ]);
      expect(refs).toEqual([
        {
          name: "ok",
          stepIndex: 1,
          stepId: "a",
          commandLabel: "head",
          paramKey: "list",
        },
      ]);
    });
  });

  describe("collectVariablesFromPipeline", () => {
    it("collects referenced variables and merges declared metadata", () => {
      const vars = collectVariablesFromPipeline(
        [
          step("a", "select", { pattern: "{{col}}" }),
          step("b", "head", { n: "{{limit}}" }),
        ],
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
      const steps = [
        step("a", "fill", { value: "{{x}}" }),
        step("b", "to", { path: ["{{x}}"] }),
      ];
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
