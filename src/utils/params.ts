import {
  PipelineStep,
  PipelineVariable,
  PipelineVariableType,
} from "@/types/xan";

/**
 * Pure helpers for F3 pipeline parameterization: variable placeholders
 * (`{{name}}`) are allowed only in parameter *values* (never inside moonblade
 * expressions). These functions are intentionally side-effect free.
 */

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_]\w*)\s*\}\}/g;
const PLACEHOLDER_ANY = /\{\{\s*([A-Za-z_]\w*)\s*\}\}/;

/** True when the string contains at least one `{{var}}` placeholder. */
export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER_ANY.test(value);
}

/** Extract distinct placeholder names from a single value, in order of appearance. */
export function extractVariableNames(value: string): string[] {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  const names: string[] = [];
  let m: RegExpExecArray | null;
  // Reset lastIndex defensively (global regex state).
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(value)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
    if (m.index === PLACEHOLDER_RE.lastIndex) PLACEHOLDER_RE.lastIndex++;
  }
  return names;
}

/** Infer a variable type from its default value (path / number / else string). */
export function inferVariableType(defaultValue?: string): PipelineVariableType {
  const v = String(defaultValue ?? "").trim();
  if (!v) return "string";
  if (
    v.includes("/") ||
    v.includes("\\") ||
    /\.(csv|tsv|txt|xlsx|xls|json|jsonl|parquet|npy)$/i.test(v)
  ) {
    return "path";
  }
  return Number.isFinite(Number(v)) ? "number" : "string";
}

/**
 * Collect the ordered set of variables referenced by a pipeline, merged with
 * metadata (defaultValue/type) taken from `existing` declarations.
 */
export function collectVariablesFromPipeline(
  steps: PipelineStep[],
  existing: PipelineVariable[] = [],
): PipelineVariable[] {
  const declared = new Map(existing.map((v) => [v.name, v]));
  const ordered: PipelineVariable[] = [];
  const seen = new Set<string>();

  const push = (name: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    const existingVar = declared.get(name);
    ordered.push({
      name,
      defaultValue: existingVar?.defaultValue,
      type: existingVar?.type ?? inferVariableType(existingVar?.defaultValue),
    });
  };

  for (const step of steps) {
    if (!step.parameters) continue;
    // Placeholders only apply to string values (arrays of strings too).
    for (const raw of Object.values(step.parameters)) {
      if (typeof raw === "string") {
        extractVariableNames(raw).forEach(push);
      } else if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === "string") {
            extractVariableNames(item).forEach(push);
          }
        }
      }
    }
  }
  return ordered;
}

/**
 * Resolve `{{name}}` placeholders inside a single string value to their
 * current values. Unknown variables are left as-is.
 */
export function resolveValue(
  value: string,
  values: Record<string, string>,
): string {
  if (!PLACEHOLDER_ANY.test(value)) return value;
  return value.replace(PLACEHOLDER_ANY, (match, name: string) =>
    values[name] !== undefined ? values[name] : match,
  );
}

function resolveParam(raw: any, values: Record<string, string>): any {
  if (typeof raw === "string") return resolveValue(raw, values);
  if (Array.isArray(raw)) return raw.map((item) => resolveParam(item, values));
  return raw;
}

/** Deep-clone steps with placeholders resolved; does NOT mutate the input. */
export function resolveStepPlaceholders(
  steps: PipelineStep[],
  values: Record<string, string>,
): PipelineStep[] {
  if (Object.keys(values).length === 0) return steps;
  return steps.map((step) => {
    const parameters = { ...step.parameters };
    for (const key of Object.keys(parameters)) {
      parameters[key] = resolveParam(parameters[key], values);
    }
    return { ...step, parameters };
  });
}
