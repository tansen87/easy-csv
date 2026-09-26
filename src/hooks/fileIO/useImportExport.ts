import { useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import type { PipelineEdge, PipelineStep, PipelineTab } from "@/types/xan";
import { xanCommands } from "@/data/commands";

interface UseImportExportProps {
  getCurrentPipeline: () => PipelineStep[];
  getCurrentTab: () => PipelineTab | undefined;
  resolveRunDelimiter: () => string;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  formatDateTime: (date: Date) => string;
  updateTabPipeline: (
    tabIdOrPipeline: string | PipelineStep[],
    newPipeline?: PipelineStep[],
    edges?: PipelineEdge[],
    inputPosition?: { x: number; y: number },
  ) => void;
  loadCsvData: (
    tabId: string,
    filePath: string,
    customDelimiter?: string,
  ) => Promise<void>;
  selectedTabId: string;
}

/** Export the current pipeline as `.xanflow` JSON / import one back. */
export function useImportExport({
  getCurrentPipeline,
  getCurrentTab,
  resolveRunDelimiter,
  showToast,
  formatDateTime,
  updateTabPipeline,
  loadCsvData,
  selectedTabId,
}: UseImportExportProps) {
  const handleExportPipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    if (!currentTab) return;
    if (currentPipeline.length === 0) {
      showToast("No pipeline to export", "warning");
      return;
    }

    try {
      const pipelineData = {
        name: currentTab.name,
        pipeline: currentPipeline.map((step) => ({
          id: step.id,
          commandId: step.command.id,
          parameters: step.parameters,
          alias: step.alias,
          position: step.position,
        })),
        inputFile: currentTab.inputFile || "",
        defaultDelimiter: resolveRunDelimiter(),
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
        created: formatDateTime(new Date()),
      };

      const jsonContent = JSON.stringify(pipelineData, null, 2);
      const filePath = await save({
        filters: [{ name: "Workflow Files", extensions: ["xanflow"] }],
        defaultPath: `${currentTab.name}.xanflow`,
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(jsonContent));
        showToast(`Pipeline exported to: ${filePath}`, "success");
      }
    } catch (error) {
      showToast(`Failed to export pipeline: ${error}`, "error");
    }
  }, [
    getCurrentPipeline,
    getCurrentTab,
    resolveRunDelimiter,
    showToast,
    formatDateTime,
  ]);

  const handleImportPipeline = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Workflow Files", extensions: ["xanflow"] }],
    });

    if (!file) return;

    try {
      const fileContent = await readFile(file);
      const jsonContent = new TextDecoder().decode(fileContent);
      const pipelineData = JSON.parse(jsonContent);

      if (!pipelineData.pipeline || !Array.isArray(pipelineData.pipeline)) {
        showToast("Invalid pipeline file format", "error");
        return;
      }

      const importedPipeline: PipelineStep[] = pipelineData.pipeline
        .map(
          (stepData: {
            id?: string;
            commandId: string;
            parameters?: Record<string, any>;
            alias?: string;
            position?: { x: number; y: number };
          }) => {
            const command = xanCommands.find(
              (cmd) => cmd.id === stepData.commandId,
            );
            if (!command) {
              showToast(
                `Unknown command: ${stepData.commandId}, skipping`,
                "warning",
              );
              return null;
            }
            return {
              id:
                stepData.id ||
                `${command.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              command,
              parameters: stepData.parameters || {},
              alias: stepData.alias,
              position: stepData.position,
            };
          },
        )
        .filter(
          (step: PipelineStep | null): step is PipelineStep => step !== null,
        );

      if (importedPipeline.length === 0) {
        showToast("No valid commands found in pipeline file", "error");
        return;
      }

      updateTabPipeline(
        importedPipeline,
        undefined,
        pipelineData.edges,
        pipelineData.inputPosition,
      );
      if (pipelineData.inputFile) {
        loadCsvData(
          selectedTabId,
          pipelineData.inputFile,
          pipelineData.defaultDelimiter,
        );
      }

      showToast(
        `Imported pipeline with ${importedPipeline.length} steps`,
        "success",
      );
    } catch (error) {
      showToast(`Failed to import pipeline: ${error}`, "error");
    }
  }, [showToast, updateTabPipeline, loadCsvData, selectedTabId]);

  return { handleExportPipeline, handleImportPipeline };
}
