import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import type { PipelineTab } from "@/types/xan";
import { buildPrefixToStep } from "@/hooks/execution/buildPrefixToStep";
import { serializeStepParams } from "@/hooks/execution/serializeStepParams";
import { resolveStepPlaceholders } from "@/utils/params";

interface UseSaveIntermediateProps {
  getCurrentTab: () => PipelineTab | undefined;
  resolveRunDelimiter: () => string;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/**
 * Save the intermediate result of a step (input → target step, inclusive)
 * as a full CSV file. Runs the prefix sub-chain WITHOUT the output-size cap
 * so large results are written completely, then prompts for a save path.
 */
export function useSaveIntermediate({
  getCurrentTab,
  resolveRunDelimiter,
  showToast,
}: UseSaveIntermediateProps) {
  const handleSaveIntermediateAsInput = useCallback(
    async (stepId: string) => {
      const currentTab = getCurrentTab();
      if (!currentTab) return;
      const currentPipeline = currentTab.pipeline;
      if (currentPipeline.length === 0) {
        showToast("No pipeline to save", "warning");
        return;
      }
      const inputFile = currentTab.inputFile || "";
      if (!inputFile) {
        showToast("Open an input file first", "warning");
        return;
      }

      const target = currentPipeline.find((s) => s.id === stepId);
      if (!target) {
        showToast("Step not found", "error");
        return;
      }

      const edges = currentTab.edges || [];
      const prefix = buildPrefixToStep(currentPipeline, edges, stepId);
      const executablePrefix = prefix.filter((s) => s.command.id !== "output");
      if (executablePrefix.length === 0) {
        showToast("No executable steps up to this step", "warning");
        return;
      }

      // Resolve {{var}} placeholders with declared defaults (F3).
      const values: Record<string, string> = {};
      for (const v of currentTab.variables || []) {
        values[v.name] = v.defaultValue ?? "";
      }
      const resolvedSteps = resolveStepPlaceholders(executablePrefix, values);

      const commands = resolvedSteps.map((step) => {
        let params = serializeStepParams(step);
        if (step.command.name === "run") {
          const mode = step.parameters.mode || "pipeline";
          params = params.filter((param) => {
            if (mode === "script" && param.name === "pipeline") return false;
            if (mode === "pipeline" && param.name === "file") return false;
            return true;
          });
        }
        return {
          name: step.command.name,
          id: step.id,
          parameters: params,
        };
      });

      try {
        // No maxOutputBytes: the intermediate must be written in full.
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile,
          defaultDelimiter: resolveRunDelimiter(),
        });
        if (!result.success) {
          showToast(`Failed: ${result.error || "execution error"}`, "error");
          return;
        }
        const output = (result.output as string) || "";
        if (!output.trim()) {
          showToast("No output produced by these steps", "warning");
          return;
        }

        const stepName = target.alias || target.command.name;
        const filePath = await save({
          filters: [{ name: "CSV", extensions: ["csv"] }],
          defaultPath: `${currentTab.name}_${stepName}.csv`,
        });
        if (!filePath) return;

        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(output));
        showToast(`Intermediate saved to: ${filePath}`, "success");
      } catch (error) {
        showToast(`Failed to save intermediate: ${error}`, "error");
      }
    },
    [getCurrentTab, showToast, resolveRunDelimiter],
  );

  return { handleSaveIntermediateAsInput };
}
