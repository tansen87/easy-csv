import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { PipelineTab } from "@/types/xan";
import type { ResultPreview } from "@/types/execution";
import type { LedgerRunRecord } from "@/hooks/useLedger";
import { buildPrefixToStep } from "@/hooks/execution/buildPrefixToStep";
import { buildSuffixFromStep } from "@/hooks/execution/buildSuffixFromStep";
import { serializeStepParams } from "@/hooks/execution/serializeStepParams";
import { resolveStepPlaceholders } from "@/utils/params";
import { parseCsvString } from "@/utils/csv";
import { readStepExport, rememberStepExport } from "@/utils/stepExportMemory";

interface UseRunFromStepProps {
  getCurrentTab: () => PipelineTab | undefined;
  resolveRunDelimiter: () => string;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  addLog: (
    type: "info" | "success" | "warning" | "error",
    message: string,
    tabId?: string,
  ) => void;
  setTabResultPreview: (tabId: string, previews: ResultPreview[]) => void;
  /** Usage ledger (design 079): a successful step run counts like any run. */
  recordLedger?: (record: LedgerRunRecord) => void;
  labels: {
    noSteps: string;
    needInput: string;
    failed: string;
    done: string;
  };
}

/**
 * "Run from this step" (design 078): execute the target step and everything
 * downstream with a **different input file** — by default the nearest upstream
 * step's last exported CSV. The tab's own input pointer is never touched, so a
 * broken step can be re-run from a previously exported mid-pipeline result.
 */
export function useRunFromStep({
  getCurrentTab,
  resolveRunDelimiter,
  showToast,
  addLog,
  setTabResultPreview,
  recordLedger,
  labels,
}: UseRunFromStepProps) {
  const handleRunFromStep = useCallback(
    async (stepId: string) => {
      const currentTab = getCurrentTab();
      if (!currentTab) return;
      const pipeline = currentTab.pipeline;
      const edges = currentTab.edges || [];
      const target = pipeline.find((step) => step.id === stepId);
      if (!target) return;

      const suffix = buildSuffixFromStep(pipeline, edges, stepId);
      if (suffix.length === 0) {
        showToast(labels.noSteps, "warning");
        return;
      }

      // The step before this one in the branch supplied the export that becomes
      // our input; the first step simply keeps the tab's input file.
      const prefix = buildPrefixToStep(pipeline, edges, stepId);
      const upstream = prefix.length > 1 ? prefix[prefix.length - 2] : null;
      let inputFile = currentTab.inputFile || "";
      if (upstream) {
        const remembered = readStepExport(currentTab.id, upstream.id);
        if (remembered) {
          inputFile = remembered;
        } else {
          const picked = await open({
            multiple: false,
            directory: false,
            filters: [{ name: "CSV", extensions: ["csv"] }],
          });
          if (!picked || Array.isArray(picked)) return;
          inputFile = picked;
          rememberStepExport(currentTab.id, upstream.id, picked);
        }
      }
      if (!inputFile) {
        showToast(labels.needInput, "warning");
        return;
      }

      // Resolve variables with their declared defaults, same as a normal run.
      const values: Record<string, string> = {};
      for (const variable of currentTab.variables || []) {
        values[variable.name] = variable.defaultValue ?? "";
      }
      const resolved = resolveStepPlaceholders(suffix, values);
      const commands = resolved.map((step) => {
        let parameters = serializeStepParams(step);
        if (step.command.name === "run") {
          const mode = step.parameters.mode || "pipeline";
          parameters = parameters.filter((param) => {
            if (mode === "script" && param.name === "pipeline") return false;
            if (mode === "pipeline" && param.name === "file") return false;
            return true;
          });
        }
        return {
          name: step.command.name,
          id: step.id,
          parameters,
        };
      });

      const stepName = target.alias || target.command.name;
      addLog(
        "info",
        `Run from step "${stepName}" with input ${inputFile}`,
        currentTab.id,
      );

      try {
        const startedAt = Date.now();
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile,
          // A throwaway id keeps the backend contract happy without joining
          // the concurrent-run registry.
          runId: `run-from-step-${Date.now()}`,
          defaultDelimiter: resolveRunDelimiter(),
        });
        if (!result.success) {
          const message = `${labels.failed}: ${result.error || ""}`.trim();
          addLog("error", message, currentTab.id);
          showToast(message, "error");
          return;
        }
        const output = (result.output as string) || "";
        const parsed = parseCsvString(output, 500);
        if (parsed.headers.length > 0) {
          const branchLabel = suffix
            .map((step) => step.alias || step.command.name)
            .join(" → ");
          setTabResultPreview(currentTab.id, [
            {
              id: `result-${Date.now()}-0`,
              label: `Result: ${branchLabel}`,
              headers: parsed.headers,
              rows: parsed.rows,
              totalRows: parsed.rows.length,
              truncated: parsed.truncated,
            },
          ]);
        }
        addLog(
          "success",
          `Run from step "${stepName}" completed`,
          currentTab.id,
        );
        recordLedger?.({
          runId: `run-from-step-${startedAt}`,
          tabId: currentTab.id,
          rows: parseCsvString(output).rows.length,
          ms: Date.now() - startedAt,
          steps: suffix.length,
          commands: Array.from(
            new Set(suffix.map((step) => step.command.name)),
          ),
          // The suffix writes through its own output steps, if any.
          files: suffix
            .filter((step) => step.command.id === "output")
            .map((step) => String(step.parameters?.path ?? ""))
            .filter(Boolean),
          via: "step-run",
        });
        showToast(labels.done.replace("{name}", stepName), "success");
      } catch (error) {
        const message = `${labels.failed}: ${error}`;
        addLog("error", message, currentTab.id);
        showToast(message, "error");
      }
    },
    [
      getCurrentTab,
      resolveRunDelimiter,
      showToast,
      addLog,
      setTabResultPreview,
      recordLedger,
      labels.noSteps,
      labels.needInput,
      labels.failed,
      labels.done,
    ],
  );

  return { handleRunFromStep };
}
