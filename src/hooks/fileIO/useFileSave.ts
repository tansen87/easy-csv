import { useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { PipelineStep, PipelineTab } from "@/types/xan";
import { isWindows } from "@/utils/platform";
import {
  buildPipelineCliLines,
  collectPipelineVariableNames,
  generatePowerShellScript,
  generateShellScript,
} from "@/hooks/fileIO/pipelineScript";

interface UseFileSaveProps {
  getCurrentPipeline: () => PipelineStep[];
  getCurrentTab: () => PipelineTab | undefined;
  /** Delimiter the run/preview actually uses (design 018). */
  resolveRunDelimiter: () => string;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/**
 * Save the current pipeline as a runnable `.ps1` / `.sh` script. The script
 * mirrors the delimiter the tab was actually read with, not the global
 * fallback setting (design 018 §3.5).
 */
export function useFileSave({
  getCurrentPipeline,
  getCurrentTab,
  resolveRunDelimiter,
  showToast,
}: UseFileSaveProps) {
  const handleSavePipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    if (!currentTab) return;
    if (currentPipeline.length === 0) {
      showToast("No pipeline to save", "warning");
      return;
    }

    try {
      const outputStep = currentPipeline.find(
        (step) => step.command.id === "output",
      );
      const outputPath = outputStep?.parameters.path || "";
      const executableSteps = currentPipeline.filter(
        (step) => step.command.id !== "output",
      );

      const exportDelimiter = resolveRunDelimiter() || ",";
      const pipelineLines = buildPipelineCliLines(
        executableSteps,
        outputPath,
        exportDelimiter,
      );

      const pipelineBody = pipelineLines.join(" | ");
      if (!pipelineBody) {
        showToast("No executable steps in pipeline to save", "warning");
        return;
      }

      const variableNames = collectPipelineVariableNames(executableSteps);

      const inputFile = currentTab.inputFile || "";
      // Default to PowerShell on Windows and a POSIX shell script elsewhere;
      // the preferred format is listed first so it is the default filter.
      const defaultIsPs = isWindows();
      const scriptFilters = defaultIsPs
        ? [
            { name: "PowerShell", extensions: ["ps1"] },
            { name: "Shell Script", extensions: ["sh"] },
          ]
        : [
            { name: "Shell Script", extensions: ["sh"] },
            { name: "PowerShell", extensions: ["ps1"] },
          ];
      const filePath = await save({
        filters: scriptFilters,
        defaultPath: `${currentTab.name}.${defaultIsPs ? "ps1" : "sh"}`,
      });

      if (filePath) {
        const generatedAt = new Date().toLocaleString();
        const buildInput = {
          pipelineBody,
          variableNames,
          inputFile,
          variables: currentTab.variables,
          generatedAt,
        };
        const scriptContent = filePath.toLowerCase().endsWith(".ps1")
          ? generatePowerShellScript(buildInput)
          : generateShellScript(buildInput);

        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(scriptContent));
        showToast(`Pipeline saved to: ${filePath}`, "success");
      }
    } catch (error) {
      showToast(`Failed to save pipeline: ${error}`, "error");
    }
  }, [getCurrentPipeline, getCurrentTab, showToast, resolveRunDelimiter]);

  return { handleSavePipeline };
}
