import type { PipelineStep, PipelineVariable } from "@/types/xan";
import { extractVariableNames } from "@/utils/params";

/**
 * Pure helpers that turn a pipeline into a runnable shell / PowerShell script.
 * Extracted from the former handleSavePipeline so the logic is testable
 * without Tauri dialogs.
 */

/** Escape a value for shell double quotes (bash branch). */
const bashEscape = (s: string) => s.replace(/[\\"$`]/g, "\\$&");

/**
 * Render each step as a CLI line (`xan <subcommand> ...`), the last one
 * carrying `--output` when an output path exists. DuckDB steps are emitted as
 * `duckdb -c "<sql>"` rather than a xan subcommand. Mirrors the multi-value
 * execution path by promoting the first `add-pattern` to the positional
 * `pattern` when the main pattern is empty.
 */
export function buildPipelineCliLines(
  executableSteps: PipelineStep[],
  outputPath: string,
  exportDelimiter: string,
): string[] {
  return executableSteps.map((step, index) => {
    // DuckDB steps are emitted as `duckdb -c "<sql>"` rather than a xan
    // subcommand. The in-app `input` virtual relation has no standalone
    // equivalent; exported scripts rely on the user adapting the data source.
    if (step.command.id === "duckdb") {
      const sql = String(step.parameters.sql || "").trim();
      // DuckDB query results are always emitted as CSV (`-csv`) with a header
      // row and bail-on-error enabled. `-separator` mirrors the delimiter the
      // tab is actually read with, so the piped CSV matches it.
      const separator =
        exportDelimiter && exportDelimiter.trim() !== ""
          ? exportDelimiter
          : ",";
      return `duckdb -c "${sql.replace(/"/g, '\\"')}" -csv -bail -separator "${separator}"`.trim();
    }

    const isSearch = step.command.name === "search";
    const apRaw = step.parameters["add-pattern"];
    let extraPatterns = Array.isArray(apRaw)
      ? apRaw.filter(Boolean).map(String)
      : [];
    const patternParamDef = step.command.parameters.find(
      (p) => p.name === "pattern",
    );
    let patternStr = String(
      step.parameters["pattern"] ?? patternParamDef?.default ?? "",
    ).trim();
    if (isSearch && !patternStr && extraPatterns.length > 0) {
      patternStr = extraPatterns[0];
      extraPatterns = extraPatterns.slice(1);
    }

    const params = step.command.parameters
      .map((param) => {
        let value = step.parameters[param.name] ?? param.default;
        if (param.name === "pattern") {
          value = patternStr;
        } else if (param.name === "add-pattern" && isSearch) {
          if (extraPatterns.length === 0) return "";
          const prefix = param.isPositional ? "" : `--${param.name}`;
          return extraPatterns
            .map((v: string) =>
              v.includes(" ") || v.includes('"')
                ? `${prefix} "${v.replace(/"/g, '\\"')}"`
                : `${prefix} ${v}`,
            )
            .join(" ");
        }

        if (param.type === "flag") {
          if (value !== true) {
            return "";
          }
          return `--${param.name}`;
        }

        if (value === undefined || value === null || value === "") {
          return "";
        }

        const prefix = param.isPositional ? "" : `--${param.name}`;
        let escapedValue = value;
        if (Array.isArray(value)) {
          escapedValue = value
            .map((v: string) =>
              v.includes(" ") || v.includes('"')
                ? `"${v.replace(/"/g, '\\"')}"`
                : v,
            )
            .join(" ");
        } else if (typeof value === "string") {
          if (
            value.includes(" ") ||
            value.includes('"') ||
            value.includes("'") ||
            value.includes("|")
          ) {
            escapedValue = `"${value.replace(/"/g, '\\"')}"`;
          }
        }
        return `${prefix} ${escapedValue}`.trim();
      })
      .filter(Boolean);

    if (index === executableSteps.length - 1 && outputPath) {
      const escapedOutputPath = `"${outputPath.replace(/"/g, '\\"')}"`;
      params.push(`--output ${escapedOutputPath}`);
    }

    return `xan ${step.command.name} ${params.join(" ")}`.trim();
  });
}

/** F3: collect `{{var}}` placeholders in first-appearance order. */
export function collectPipelineVariableNames(
  executableSteps: PipelineStep[],
): string[] {
  const variableNames: string[] = [];
  const varSeen = new Set<string>();
  for (const step of executableSteps) {
    for (const rawValue of Object.values(step.parameters)) {
      const itemList = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const item of itemList) {
        if (typeof item !== "string") continue;
        for (const name of extractVariableNames(item)) {
          if (!varSeen.has(name)) {
            varSeen.add(name);
            variableNames.push(name);
          }
        }
      }
    }
  }
  return variableNames;
}

export interface ScriptBuildInput {
  pipelineBody: string;
  variableNames: string[];
  inputFile: string;
  variables?: PipelineVariable[];
  generatedAt: string;
}

/** Build the full PowerShell (.ps1) script content. */
export function generatePowerShellScript(input: ScriptBuildInput): string {
  const { pipelineBody, variableNames, inputFile, generatedAt } = input;
  const head = inputFile
    ? `Get-Content -Raw -LiteralPath '${inputFile.replace(/'/g, "''")}' | `
    : "";
  let psBody = pipelineBody.replace(/\bxan\b/g, ".\\xan");
  // Map each placeholder to a quoted positional $args[N] so values
  // containing spaces / special chars survive as a single argument.
  variableNames.forEach((name, i) => {
    psBody = psBody.split(`{{${name}}}`).join(`"$args[${i}]"`);
  });
  const usageVars = variableNames
    .map((name, i) => `[var:${name} => $args[${i}]]`)
    .join(" ");
  return [
    "# Generated by EasyCsv",
    "# Encoding: utf-8",
    `# Generated at: ${generatedAt}`,
    variableNames.length > 0
      ? `# Usage: .\\script.ps1 ${usageVars}`
      : "# Usage: .\\script.ps1 [input.csv]",
    '$ErrorActionPreference = "Stop"',
    "",
    `${head}${psBody}`,
    "",
  ].join("\r\n");
}

/** Build the full POSIX shell (.sh) script content. */
export function generateShellScript(input: ScriptBuildInput): string {
  const { pipelineBody, variableNames, inputFile, variables, generatedAt } =
    input;
  const defaultInput = inputFile
    ? `"${inputFile.replace(/\\/g, "/").replace(/"/g, '\\"')}"`
    : "/dev/stdin";
  let bashBody = pipelineBody.replace(/\\/g, "/").replace(/\bxan\b/g, '"$XAN"');
  // $1 is INPUT; each placeholder becomes the next positional arg,
  // with a `${N:-default}` fallback so missing args don't trip `set -u`.
  const defaultByVar = new Map(
    (variables || []).map((v) => [v.name, v.defaultValue ?? ""]),
  );
  variableNames.forEach((name, i) => {
    const argIndex = i + 2;
    const fallback = defaultByVar.get(name) || "";
    const expr = fallback
      ? `"${"${" + argIndex + ":-" + bashEscape(fallback) + "}"}"`
      : `"${"${" + argIndex + ":-}"}"`;
    bashBody = bashBody.split(`{{${name}}}`).join(expr);
  });
  const firstPipeIndex = bashBody.indexOf(" | ");
  if (firstPipeIndex === -1) {
    bashBody = `${bashBody} < "$INPUT"`;
  } else {
    bashBody = `${bashBody.slice(0, firstPipeIndex)} < "$INPUT"${bashBody.slice(firstPipeIndex)}`;
  }
  const usageVars = variableNames
    .map((name, i) => `[var:${name} => $${i + 2}]`)
    .join(" ");
  return [
    "#!/usr/bin/env bash",
    "# Generated by EasyCsv",
    "# Encoding: utf-8",
    `# Generated at: ${generatedAt}`,
    variableNames.length > 0
      ? `# Usage: ./script.sh [input.csv] ${usageVars}`
      : "# Usage: ./script.sh [input.csv]",
    "set -euo pipefail",
    "",
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'XAN="$SCRIPT_DIR/xan"',
    "",
    `INPUT="\${1:-${defaultInput}}"`,
    bashBody,
    "",
  ].join("\n");
}
