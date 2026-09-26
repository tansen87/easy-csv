import type { PipelineStep } from "@/types/xan";

export interface CliParam {
  name: string;
  value: string;
  isPositional?: boolean;
}

/**
 * Serialize a step's parameters to CLI param entries.
 *
 * `search` multi-pattern (S1): `add-pattern` is emitted as repeated `-P`
 * flags (OR). xan requires a positional `<pattern>` as the first mode, so if
 * the main `pattern` is empty but the list has values, the first value is
 * promoted to the positional pattern and the rest become `-P`.
 *
 * Other array values (e.g. multiple file paths) are joined with `|`.
 */
export function serializeStepParams(step: PipelineStep): CliParam[] {
  const params: CliParam[] = [];
  const isSearch = step.command.name === "search";

  // Normalize add-pattern values to a trimmed list.
  const apRaw = step.parameters["add-pattern"];
  let extraPatterns: string[] = Array.isArray(apRaw)
    ? apRaw.map((v) => String(v).trim()).filter(Boolean)
    : apRaw && String(apRaw).trim()
      ? [String(apRaw).trim()]
      : [];

  // Positional `pattern`; promote the first extra pattern when empty.
  const patternParam = step.command.parameters.find(
    (p) => p.name === "pattern",
  );
  let positionedPattern = patternParam
    ? String(step.parameters["pattern"] ?? patternParam.default ?? "").trim()
    : "";
  if (isSearch && !positionedPattern && extraPatterns.length > 0) {
    positionedPattern = extraPatterns[0];
    extraPatterns = extraPatterns.slice(1);
  }

  for (const param of step.command.parameters) {
    if (param.name === "pattern") {
      params.push({
        name: "pattern",
        value: positionedPattern,
        isPositional: param.isPositional,
      });
      continue;
    }
    if (isSearch && param.name === "add-pattern") {
      for (const v of extraPatterns) {
        params.push({
          name: "add-pattern",
          value: v,
          isPositional: param.isPositional,
        });
      }
      continue;
    }
    const raw = step.parameters[param.name] ?? param.default;
    const value = Array.isArray(raw)
      ? raw.filter(Boolean).join("|")
      : String(raw || "");
    params.push({ name: param.name, value, isPositional: param.isPositional });
  }
  return params;
}
