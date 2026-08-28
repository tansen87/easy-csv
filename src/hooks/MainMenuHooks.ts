import { useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
  PipelineStep,
  PipelineTab,
  PipelineEdge,
  LogEntry,
  StepLineage,
  ChartConfig,
  ChartSeries,
  ChartDataPoint,
} from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { BatchFilterConfig } from "@/components/dialog/BatchFilterDialog";
import { BatchFilterHooks } from "@/hooks/BatchFilterHooks";
import { BatchConvertHooks } from "@/hooks/BatchConvertHooks";

interface MainMenuHooksProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  defaultDelimiter: string;
  setDefaultDelimiter: React.Dispatch<React.SetStateAction<string>>;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  addLog: (type: LogEntry["type"], message: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>;
  setSelectedTabId: React.Dispatch<React.SetStateAction<string>>;
  setUndoStack: React.Dispatch<
    React.SetStateAction<
      Array<{
        pipeline: PipelineStep[];
        edges: PipelineEdge[];
        inputPosition?: { x: number; y: number };
      }>
    >
  >;
  setRedoStack: React.Dispatch<
    React.SetStateAction<
      Array<{
        pipeline: PipelineStep[];
        edges: PipelineEdge[];
        inputPosition?: { x: number; y: number };
      }>
    >
  >;
  setSelectedStep: React.Dispatch<React.SetStateAction<PipelineStep | null>>;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLogPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowProgressBar: React.Dispatch<React.SetStateAction<boolean>>;
  setBranchProgress: React.Dispatch<
    React.SetStateAction<{
      current: number;
      total: number;
      name: string;
      status: "executing" | "completed" | "error";
    } | null>
  >;
  progressHideTimerRef: React.RefObject<ReturnType<typeof setTimeout> | null>;
  loadCsvData: (
    tabId: string,
    filePath: string,
    customDelimiter?: string,
  ) => Promise<void>;
  formatDateTime: (date: Date) => string;
  trackLineage?: (
    steps: PipelineStep[],
    edges: PipelineEdge[],
    inputHeaders: string[],
    inputRows: string[][],
    actualOutputRowCount?: number,
  ) => StepLineage[];
  setShowChartPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setChartConfig: React.Dispatch<React.SetStateAction<ChartConfig | null>>;
  setChartSeries: React.Dispatch<React.SetStateAction<ChartSeries[]>>;
  setChartHeaders: React.Dispatch<React.SetStateAction<string[]>>;
  saveVersion: (message?: string, tags?: string[]) => Promise<any>;
}

export function MainMenuHooks({
  tabs,
  selectedTabId,
  defaultDelimiter,
  showToast,
  addLog,
  setTabs,
  setSelectedTabId,
  setUndoStack,
  setRedoStack,
  setSelectedStep,
  setIsExecuting,
  setShowLogPanel,
  setShowProgressBar,
  setBranchProgress,
  progressHideTimerRef,
  loadCsvData,
  formatDateTime,
  trackLineage,
  setShowChartPanel,
  setChartConfig,
  setChartSeries,
  setChartHeaders,
  saveVersion,
}: MainMenuHooksProps) {
  const getCurrentTab = useCallback(() => {
    return tabs.find((tab) => tab.id === selectedTabId) || tabs[0];
  }, [tabs, selectedTabId]);

  const { executeBatchFilterDirect, executeBatchFilterWithData } =
    BatchFilterHooks({
      defaultDelimiter,
      addLog,
      setBranchProgress,
      getCurrentTab,
    });

  const { executeBatchConvert } = BatchConvertHooks({
    defaultDelimiter,
    addLog,
    setBranchProgress,
    getCurrentTab,
  });

  const getCurrentPipeline = useCallback(() => {
    return getCurrentTab().pipeline;
  }, [getCurrentTab]);

  const updateTabPipeline = useCallback(
    (
      tabIdOrPipeline: string | PipelineStep[],
      newPipeline?: PipelineStep[],
      edges?: PipelineEdge[],
      inputPosition?: { x: number; y: number },
    ) => {
      const currentTab =
        typeof tabIdOrPipeline === "string"
          ? tabs.find((t) => t.id === tabIdOrPipeline)
          : tabs.find((t) => t.id === selectedTabId);

      const newPipelineToSet =
        typeof tabIdOrPipeline === "string"
          ? newPipeline!
          : (tabIdOrPipeline as PipelineStep[]);
      const isStateChanged =
        currentTab &&
        (JSON.stringify(currentTab.pipeline) !==
          JSON.stringify(newPipelineToSet) ||
          JSON.stringify(currentTab.edges) !==
            JSON.stringify(edges ?? currentTab.edges) ||
          JSON.stringify(currentTab.inputPosition) !==
            JSON.stringify(inputPosition ?? currentTab.inputPosition));

      if (currentTab && isStateChanged) {
        setUndoStack((prev) => [
          ...prev,
          {
            pipeline: currentTab.pipeline,
            edges: currentTab.edges || [],
            inputPosition: currentTab.inputPosition,
          },
        ]);
        setRedoStack([]);
      }

      if (typeof tabIdOrPipeline === "string" && newPipeline) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabIdOrPipeline
              ? {
                  ...tab,
                  pipeline: newPipeline,
                  edges: edges !== undefined ? edges : tab.edges,
                  inputPosition:
                    inputPosition !== undefined
                      ? inputPosition
                      : tab.inputPosition,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      } else {
        const pipeline = tabIdOrPipeline as PipelineStep[];
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === selectedTabId
              ? {
                  ...tab,
                  pipeline: pipeline,
                  edges: edges !== undefined ? edges : tab.edges,
                  inputPosition:
                    inputPosition !== undefined
                      ? inputPosition
                      : tab.inputPosition,
                  updatedAt: formatDateTime(new Date()),
                }
              : tab,
          ),
        );
      }
    },
    [tabs, selectedTabId, setUndoStack, setRedoStack, setTabs, formatDateTime],
  );

  const addNewTab = useCallback((): string => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: PipelineTab = {
      id: newTabId,
      name: `Tab${tabs.length + 1}`,
      pipeline: [],
      created: formatDateTime(new Date()),
      updated: formatDateTime(new Date()),
    };
    setTabs((prev) => [...prev, newTab]);
    setSelectedTabId(newTabId);
    setSelectedStep(null);
    return newTabId;
  }, [tabs.length, setTabs, setSelectedTabId, setSelectedStep, formatDateTime]);

  const handleOpenFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "JSON", extensions: ["json", "jsonl"] },
        { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
        { name: "Parquet", extensions: ["parquet"] },
        { name: "All", extensions: ["*"] },
      ],
    });

    if (file) {
      loadCsvData(selectedTabId, file);
    }
  }, [selectedTabId, loadCsvData]);

  const handleOpenNewTabWithFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV", extensions: ["csv", "txt", "tsv"] },
        { name: "JSON", extensions: ["json", "jsonl"] },
        { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
        { name: "Parquet", extensions: ["parquet"] },
        { name: "All", extensions: ["*"] },
      ],
    });

    if (file) {
      const newTabId = addNewTab();
      loadCsvData(newTabId, file);
    }
  }, [addNewTab, loadCsvData]);

  const handleSavePipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
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

      const pipelineLines = executableSteps.map((step, index) => {
        let params = step.command.parameters
          .map((param) => {
            const value = step.parameters[param.name] ?? param.default;

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

      const pipelineBody = pipelineLines.join(" | ");
      if (!pipelineBody) {
        showToast("No executable steps in pipeline to save", "warning");
        return;
      }

      const inputFile = currentTab.inputFile || "";
      const filePath = await save({
        filters: [
          { name: "PowerShell", extensions: ["ps1"] },
          { name: "Shell Script", extensions: ["sh"] },
        ],
        defaultPath: `${currentTab.name}.ps1`,
      });

      if (filePath) {
        const generatedAt = new Date().toLocaleString();
        let scriptContent: string;

        if (filePath.toLowerCase().endsWith(".ps1")) {
          const head = inputFile
            ? `Get-Content -Raw -LiteralPath '${inputFile.replace(/'/g, "''")}' | `
            : "";
          scriptContent = [
            "# Generated by easy-csv",
            "# Encoding: utf-8",
            `# Generated at: ${generatedAt}`,
            "# Usage: .\\script.ps1 [input.csv]",
            '$ErrorActionPreference = "Stop"',
            "",
            `${head}${pipelineBody.replace(/\bxan\b/g, ".\\xan")}`,
            "",
          ].join("\r\n");
        } else {
          const defaultInput = inputFile
            ? `"${inputFile.replace(/\\/g, "/").replace(/"/g, '\\"')}"`
            : "/dev/stdin";
          let bashBody = pipelineBody
            .replace(/\\/g, "/")
            .replace(/\bxan\b/g, '"$XAN"');
          const firstPipeIndex = bashBody.indexOf(" | ");
          if (firstPipeIndex === -1) {
            bashBody = `${bashBody} < "$INPUT"`;
          } else {
            bashBody = `${bashBody.slice(0, firstPipeIndex)} < "$INPUT"${bashBody.slice(firstPipeIndex)}`;
          }
          scriptContent = [
            "#!/usr/bin/env bash",
            "# Generated by easy-csv",
            "# Encoding: utf-8",
            `# Generated at: ${generatedAt}`,
            "# Usage: ./script.sh [input.csv]",
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

        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(scriptContent));
        showToast(`Pipeline saved to: ${filePath}`, "success");
      }
    } catch (error) {
      showToast(`Failed to save pipeline: ${error}`, "error");
    }
  }, [getCurrentPipeline, getCurrentTab, showToast]);

  const handleExportPipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
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
        defaultDelimiter,
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
    defaultDelimiter,
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

  const buildExecutionBranches = useCallback(
    (steps: PipelineStep[], edges: PipelineEdge[]): PipelineStep[][] => {
      if (edges.length === 0) {
        return steps.map((step) => [step]);
      }

      const stepMap = new Map<string, PipelineStep>();
      steps.forEach((step) => stepMap.set(step.id, step));

      const executableStepIds = new Set(steps.map((step) => step.id));
      const adjacency = new Map<string, string[]>();
      edges.forEach((edge) => {
        if (executableStepIds.has(edge.target)) {
          if (!adjacency.has(edge.source)) {
            adjacency.set(edge.source, []);
          }
          adjacency.get(edge.source)!.push(edge.target);
        }
      });

      const branches: PipelineStep[][] = [];

      const dfs = (currentId: string, path: PipelineStep[]) => {
        const currentStep = stepMap.get(currentId);
        if (!currentStep) return;

        const newPath = [...path, currentStep];
        const nextEdges = adjacency.get(currentId) || [];

        if (nextEdges.length === 0) {
          branches.push(newPath);
          return;
        }

        nextEdges.forEach((nextId) => {
          dfs(nextId, newPath);
        });
      };

      const targetIds = new Set(edges.map((e) => e.target));
      const startNodes = steps
        .filter((step) => !targetIds.has(step.id))
        .map((step) => step.id);

      if (startNodes.length === 0) {
        const tableEdges = adjacency.get("table-node") || [];
        if (tableEdges.length > 0) {
          tableEdges.forEach((edge) => {
            dfs(edge, []);
          });
          return branches;
        }
        return steps.map((step) => [step]);
      }

      startNodes.forEach((startId) => {
        dfs(startId, []);
      });

      return branches;
    },
    [],
  );

  const handleExecute = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    const edges = currentTab.edges || [];
    const inputFile = currentTab.inputFile || "";

    if (currentPipeline.length === 0) {
      showToast("No steps in pipeline to execute", "warning");
      return;
    }

    setIsExecuting(true);
    setShowLogPanel(true);
    setShowProgressBar(true);

    if (progressHideTimerRef.current) {
      clearTimeout(progressHideTimerRef.current);
      progressHideTimerRef.current = null;
    }

    try {
      await invoke("set_pipeline_cancelled", { cancel: false });

      // Clear any previous step execution errors so stale errors don't remain
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === selectedTabId
            ? {
                ...tab,
                pipeline: tab.pipeline.map((step) =>
                  step.error ? { ...step, error: undefined } : step,
                ),
              }
            : tab,
        ),
      );

      const outputStep = currentPipeline.find(
        (step) => step.command.id === "output",
      );
      const outputPath = outputStep?.parameters.path || "";

      const executableSteps = currentPipeline.filter(
        (step) => step.command.id !== "output",
      );

      if (executableSteps.length === 0) {
        showToast(
          "No executable steps found in pipeline - add other commands before output",
          "warning",
        );
        setIsExecuting(false);
        return;
      }

      // Validate required parameters before execution
      const missingParams: string[] = [];
      for (const step of executableSteps) {
        for (const param of step.command.parameters) {
          if (
            param.required &&
            (step.parameters[param.name] === undefined ||
              step.parameters[param.name] === "")
          ) {
            missingParams.push(
              `${step.alias || step.command.name} → ${param.name}`,
            );
          }
        }
      }
      if (missingParams.length > 0) {
        showToast(
          `Missing required parameters: ${missingParams.join(", ")}`,
          "warning",
        );
        setIsExecuting(false);
        return;
      }

      const branches = buildExecutionBranches(executableSteps, edges);

      const allResults: {
        success: boolean;
        output?: string;
        error?: string;
        branchSteps: string[];
      }[] = [];

      // Accumulate per-step execution errors to display on the nodes
      const accumulatedErrors: Record<string, string> = {};

      let pipelineFailed = false;
      let wasCancelled = false;
      for (let i = 0; i < branches.length; i++) {
        const branchSteps = branches[i];
        if (branchSteps.length === 0) continue;

        const branchStepNames = branchSteps.map(
          (s) => s.alias || s.command.name,
        );
        const branchName = branchStepNames.join(" -> ");
        addLog(
          "info",
          `Executing branch ${i + 1}/${branches.length}: ${branchName}`,
        );

        setBranchProgress({
          current: i + 1,
          total: branches.length,
          name: branchName,
          status: "executing",
        });

        // Check if branch contains batch-from and batch-to steps
        const batchFromIndex = branchSteps.findIndex(
          (s) => s.command.id === "batch-from",
        );
        const batchToIndex = branchSteps.findIndex(
          (s) => s.command.id === "batch-to",
        );

        let result: any;

        // Validate batch-from and batch-to pairing
        if (batchFromIndex >= 0 || batchToIndex >= 0) {
          if (batchFromIndex < 0) {
            result = { success: false, error: "batch-to requires batch-from" };
            setBranchProgress({
              current: i + 1,
              total: branches.length,
              name: branchName,
              status: "error",
            });
            pipelineFailed = true;
            continue;
          }
          if (batchToIndex < 0) {
            result = { success: false, error: "batch-from requires batch-to" };
            setBranchProgress({
              current: i + 1,
              total: branches.length,
              name: branchName,
              status: "error",
            });
            pipelineFailed = true;
            continue;
          }
          // Execute batch conversion
          const batchFromStep = branchSteps[batchFromIndex];
          const batchToStep = branchSteps[batchToIndex];
          await executeBatchConvert(
            batchFromStep.parameters,
            batchToStep.parameters,
          );
          result = { success: true, output: "" };
        } else if (
          branchSteps.findIndex((s) => s.command.id === "batch-filter") >= 0
        ) {
          // Check if branch contains batch-filter step
          const batchFilterIndex = branchSteps.findIndex(
            (s) => s.command.id === "batch-filter",
          );

          // Split branch: steps before batch-filter + batch-filter step
          const preBatchSteps = branchSteps.slice(0, batchFilterIndex);
          const batchFilterStep = branchSteps[batchFilterIndex];

          // Execute pre-batch steps as pipeline to get intermediate input
          let preBatchOutput: string | null = null;
          if (preBatchSteps.length > 0) {
            addLog(
              "info",
              `Executing ${preBatchSteps.length} step(s) before batch filter...`,
            );
            const preCommands = preBatchSteps.map((step) => {
              let params = step.command.parameters.map((param) => ({
                name: param.name,
                value: String(
                  step.parameters[param.name] || param.default || "",
                ),
                isPositional: param.isPositional,
              }));
              return {
                name: step.command.name,
                id: step.id,
                parameters: params,
              };
            });

            const preResult = await invoke<any>("execute_xan_pipeline", {
              commands: preCommands,
              inputFile,
              defaultDelimiter,
            });

            if (!preResult.success) {
              addLog("error", `Pre-batch steps failed: ${preResult.error}`);
              result = preResult;
            } else {
              preBatchOutput = preResult.output || "";
              addLog(
                "info",
                `Pre-batch steps completed, using result as input for batch filter`,
              );
            }
          }

          // Execute batch-filter if pre-batch steps succeeded (or no pre-batch steps)
          if (!result || result.success) {
            const bfParams = batchFilterStep.parameters;
            const bfConfig: BatchFilterConfig = {
              column: bfParams.column,
              filterType: bfParams["filter-type"] || "text",
              textOperator: bfParams["text-operator"],
              numberOperator: bfParams["number-operator"],
              valueMode: bfParams["value-mode"] || "manual",
              manualValues: bfParams["manual-values"],
              extractColumn: bfParams["extract-column"],
              caseInsensitive: bfParams["case-insensitive"],
              outputDir: bfParams["output-dir"],
            };

            // Execute batch filter: use pre-batch output data directly if available
            if (preBatchOutput !== null) {
              await executeBatchFilterWithData(bfConfig, preBatchOutput);
            } else {
              await executeBatchFilterDirect(bfConfig, inputFile);
            }
            result = { success: true, output: "" };
          }
        } else if (
          branchSteps.findIndex((s) => s.command.id === "chart") >= 0
        ) {
          // Handle chart command - render in frontend with recharts
          const chartStep = branchSteps.find((s) => s.command.id === "chart");
          if (chartStep) {
            const chartParams = chartStep.parameters;
            const chartConfig: ChartConfig = {
              chartType: chartParams["chart-type"] || "line",
              x: chartParams.x,
              y: chartParams.y,
              category: chartParams.category,
              title: chartParams.title,
              xLabel: chartParams["x-label"],
              yLabel: chartParams["y-label"],
              bins: chartParams.bins || 10,
              color: chartParams.color || "#8884d8",
              width: chartParams.width || 600,
              height: chartParams.height || 400,
            };

            // Execute preceding commands to get data
            const precedingSteps = branchSteps.filter(
              (s) => s.command.id !== "chart",
            );
            let headers = currentTab.headers || [];
            let data = currentTab.data || [];

            if (precedingSteps.length > 0) {
              const preCommands = precedingSteps.map((step) => {
                let params = step.command.parameters.map((param) => ({
                  name: param.name,
                  value: String(
                    step.parameters[param.name] || param.default || "",
                  ),
                  isPositional: param.isPositional,
                }));
                return {
                  name: step.command.name,
                  id: step.id,
                  parameters: params,
                };
              });

              const preResult = await invoke<any>("execute_xan_pipeline", {
                commands: preCommands,
                inputFile,
                defaultDelimiter,
              });

              if (preResult.success && preResult.output) {
                // Parse CSV output
                const lines = (preResult.output as string).trim().split("\n");
                if (lines.length > 0) {
                  const delimiter = defaultDelimiter || ",";
                  headers = lines[0]
                    .split(delimiter)
                    .map((h: string) => h.trim().replace(/^"|"$/g, ""));
                  data = lines
                    .slice(1)
                    .map((line: string) =>
                      line
                        .split(delimiter)
                        .map((cell: string) =>
                          cell.trim().replace(/^"|"$/g, ""),
                        ),
                    );
                }
              }
            } else {
              // Use raw CSV data
              if (inputFile) {
                const csvContent = await readFile(inputFile);
                const text = new TextDecoder().decode(csvContent);
                const lines = text.trim().split("\n");
                if (lines.length > 0) {
                  const delimiter = defaultDelimiter || ",";
                  headers = lines[0]
                    .split(delimiter)
                    .map((h: string) => h.trim().replace(/^"|"$/g, ""));
                  data = lines
                    .slice(1)
                    .map((line: string) =>
                      line
                        .split(delimiter)
                        .map((cell: string) =>
                          cell.trim().replace(/^"|"$/g, ""),
                        ),
                    );
                }
              }
            }

            // Process data for chart
            const chartSeries = processChartData(headers, data, chartConfig);

            setChartConfig(chartConfig);
            setChartSeries(chartSeries);
            setChartHeaders(headers);
            setShowChartPanel(true);

            result = {
              success: true,
              output: `Chart generated: ${chartConfig.chartType} (${chartConfig.x}${chartConfig.y ? ` vs ${chartConfig.y}` : ""})`,
            };
          } else {
            result = { success: false, error: "Chart step not found" };
          }
        } else {
          // Normal pipeline execution (no batch-filter)
          const commands = branchSteps.map((step, index) => {
            let params = step.command.parameters.map((param) => {
              const rawValue = step.parameters[param.name] ?? param.default;
              // For arrays (e.g., multiple file paths), join with | separator
              const value = Array.isArray(rawValue)
                ? rawValue.filter(Boolean).join("|")
                : String(rawValue || "");
              return {
                name: param.name,
                value,
                isPositional: param.isPositional,
              };
            });

            if (step.command.name === "run") {
              const mode = step.parameters.mode || "pipeline";
              params = params.filter((param) => {
                if (mode === "script" && param.name === "pipeline")
                  return false;
                if (mode === "pipeline" && param.name === "file") return false;
                return true;
              });
            }

            if (
              index === branchSteps.length - 1 &&
              outputPath &&
              !pipelineFailed
            ) {
              params.push({
                name: "output",
                value: outputPath,
                isPositional: false,
              });
            }

            return {
              name: step.command.name,
              id: step.id,
              parameters: params,
            };
          });

          result = await invoke<any>("execute_xan_pipeline", {
            commands,
            inputFile,
            defaultDelimiter,
          });
        }

        if (result?.cancelled) {
          addLog("warning", "Execution cancelled by user");
          setBranchProgress({
            current: i + 1,
            total: branches.length,
            name: branchName,
            status: "error",
          });
          pipelineFailed = true;
          wasCancelled = true;
          break;
        }

        allResults.push({
          success: result.success,
          output: result.output,
          error: result.error,
          branchSteps: branchStepNames,
        });

        // Merge per-step errors from this branch
        const stepErrors = result.step_errors as
          | Record<string, string>
          | undefined;
        if (stepErrors) {
          for (const stepId in stepErrors) {
            const err = stepErrors[stepId];
            if (err) accumulatedErrors[stepId] = err;
          }
        }

        setBranchProgress({
          current: i + 1,
          total: branches.length,
          name: branchName,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          if (result.output) {
            const output = (result.output as string).trimStart().trimEnd();
            addLog("success", `${output}`);
          } else {
            addLog(
              "info",
              `Branch ${i + 1} completed successfully with no output`,
            );
          }
        } else {
          if (result.error) {
            addLog("error", `${result.error}`);
          } else {
            addLog("error", `Branch ${i + 1} failed with no error message`);
          }
          pipelineFailed = true;
        }
      }

      if (trackLineage && !wasCancelled) {
        const headers = currentTab.headers || [];
        const rows = currentTab.data || [];
        trackLineage(currentPipeline, edges, headers, rows);
      }

      // Apply per-step execution errors so they render on the nodes
      if (Object.keys(accumulatedErrors).length > 0) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === selectedTabId
              ? {
                  ...tab,
                  pipeline: tab.pipeline.map((step) => {
                    const err = accumulatedErrors[step.id];
                    if (err !== undefined) {
                      return { ...step, error: err };
                    }
                    return step;
                  }),
                }
              : tab,
          ),
        );
      }

      const successCount = allResults.filter((r) => r.success).length;
      if (successCount === branches.length) {
        addLog(
          "success",
          `All ${branches.length} branch(es) executed successfully`,
        );
        // Auto-save version on successful execution
        try {
          await saveVersion(`auto-generated`);
        } catch (versionError) {
          addLog("warning", `Failed to auto-save version: ${versionError}`);
        }
      }
    } catch (error) {
      addLog("error", `${error}`);
    } finally {
      setIsExecuting(false);
      progressHideTimerRef.current = setTimeout(() => {
        setShowProgressBar(false);
        setBranchProgress(null);
      }, 5000);
    }
  }, [
    getCurrentPipeline,
    getCurrentTab,
    defaultDelimiter,
    showToast,
    addLog,
    setIsExecuting,
    setShowLogPanel,
    setShowProgressBar,
    setBranchProgress,
    progressHideTimerRef,
    buildExecutionBranches,
    formatDateTime,
    trackLineage,
    setShowChartPanel,
    setChartConfig,
    setChartSeries,
    setChartHeaders,
    saveVersion,
  ]);

  const processChartData = useCallback(
    (
      headers: string[],
      data: string[][],
      config: ChartConfig,
    ): ChartSeries[] => {
      const xIndex = headers.indexOf(config.x);
      if (xIndex === -1) return [];

      const categoryIndex = config.category
        ? headers.indexOf(config.category)
        : -1;
      const yIndex = config.y ? headers.indexOf(config.y) : -1;

      if (config.chartType === "histogram") {
        // For histogram, we need numeric values from x column
        const values = data
          .map((row) => parseFloat(row[xIndex]))
          .filter((v) => !isNaN(v));

        const bins = config.bins || 10;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binWidth = (max - min) / bins;

        const histogramData: ChartDataPoint[] = [];
        for (let i = 0; i < bins; i++) {
          const binStart = min + i * binWidth;
          const binEnd = binStart + binWidth;
          const count = values.filter(
            (v) => v >= binStart && (i === bins - 1 ? v <= binEnd : v < binEnd),
          ).length;
          histogramData.push({
            range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
            count,
          });
        }

        return [
          {
            name: config.x,
            data: histogramData,
            color: config.color || "#8884d8",
          },
        ];
      }

      if (config.chartType === "pie") {
        if (categoryIndex >= 0) {
          const categories = new Map<string, ChartDataPoint[]>();
          data.forEach((row) => {
            const cat = row[categoryIndex] || "Unknown";
            if (!categories.has(cat)) {
              categories.set(cat, []);
            }
            const point: ChartDataPoint = { [config.x]: row[xIndex] };
            point[config.y || "count"] =
              yIndex >= 0 ? parseFloat(row[yIndex]) || 0 : 1;
            categories.get(cat)!.push(point);
          });

          const colors = [
            "#8884d8",
            "#82ca9d",
            "#ffc658",
            "#ff7300",
            "#0088fe",
            "#00C49F",
            "#FFBB28",
            "#FF8042",
          ];
          let colorIndex = 0;

          return Array.from(categories.entries()).map(([cat, points]) => ({
            name: cat,
            data: points,
            color: colors[colorIndex++ % colors.length],
          }));
        }

        const valueKey = config.y || "count";
        const points: ChartDataPoint[] = data.map((row) => {
          const point: ChartDataPoint = { [config.x]: row[xIndex] };
          point[valueKey] = yIndex >= 0 ? parseFloat(row[yIndex]) || 0 : 1;
          return point;
        });

        return [
          {
            name: config.x,
            data: points,
            color: config.color || "#8884d8",
          },
        ];
      }

      if (config.chartType === "wordcloud") {
        const wordCounts = new Map<string, number>();

        data.forEach((row) => {
          const text = row[xIndex] || "";
          const words = text.toLowerCase().split(/\s+/).filter(Boolean);
          const weight = yIndex >= 0 ? parseFloat(row[yIndex]) || 1 : 1;

          words.forEach((word) => {
            const cleanWord = word.replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
            if (cleanWord) {
              wordCounts.set(
                cleanWord,
                (wordCounts.get(cleanWord) || 0) + weight,
              );
            }
          });
        });

        const maxCount = Math.max(...Array.from(wordCounts.values()), 1);
        const wordData: ChartDataPoint[] = Array.from(wordCounts.entries())
          .map(([word, count]) => ({
            text: word,
            value: count,
            normalizedValue: count / maxCount,
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 200);

        return [
          {
            name: config.x,
            data: wordData,
            color: config.color || "#8884d8",
          },
        ];
      }

      if (config.chartType === "heatmap") {
        const yCol = yIndex >= 0 ? headers[yIndex] : "count";
        const xValues = new Set<string>();
        const yValues = new Set<string>();
        const valueMap = new Map<string, number>();

        data.forEach((row) => {
          const xVal = String(row[xIndex] || "");
          const yVal = yIndex >= 0 ? String(row[yIndex] || "") : "";

          xValues.add(xVal);
          yValues.add(yVal);

          const key = `${xVal}|${yVal}`;
          valueMap.set(key, (valueMap.get(key) || 0) + 1);
        });

        const xArray = Array.from(xValues);
        const yArray = Array.from(yValues);
        const maxValue = Math.max(...Array.from(valueMap.values()), 1);

        const heatData: ChartDataPoint[] = [];
        xArray.forEach((xVal) => {
          yArray.forEach((yVal) => {
            const key = `${xVal}|${yVal}`;
            const value = valueMap.get(key) || 0;
            heatData.push({
              [config.x]: xVal,
              [yCol]: yVal,
              value,
              normalizedValue: value / maxValue,
            });
          });
        });

        return [
          {
            name: `${config.x} vs ${yCol}`,
            data: heatData,
            color: config.color || "#8884d8",
          },
        ];
      }

      if (categoryIndex >= 0) {
        // Group by category
        const categories = new Map<string, ChartDataPoint[]>();
        data.forEach((row) => {
          const cat = row[categoryIndex] || "Unknown";
          if (!categories.has(cat)) {
            categories.set(cat, []);
          }
          const point: ChartDataPoint = { [config.x]: row[xIndex] };
          if (yIndex >= 0) {
            point[config.y!] = parseFloat(row[yIndex]) || 0;
          }
          categories.get(cat)!.push(point);
        });

        const colors = [
          "#8884d8",
          "#82ca9d",
          "#ffc658",
          "#ff7300",
          "#0088fe",
          "#00C49F",
          "#FFBB28",
          "#FF8042",
        ];
        let colorIndex = 0;

        return Array.from(categories.entries()).map(([cat, points]) => ({
          name: cat,
          data: points,
          color: colors[colorIndex++ % colors.length],
        }));
      }

      // Simple series
      const points: ChartDataPoint[] = data.map((row) => {
        const point: ChartDataPoint = { [config.x]: row[xIndex] };
        if (yIndex >= 0) {
          point[config.y!] = parseFloat(row[yIndex]) || 0;
        }
        return point;
      });

      return [
        {
          name: config.y || config.x,
          data: points,
          color: config.color || "#8884d8",
        },
      ];
    },
    [],
  );

  const handleCancelExecution = useCallback(async () => {
    try {
      await invoke("set_pipeline_cancelled", { cancel: true });
      addLog("warning", "Cancelling execution...");
    } catch (error) {
      addLog("error", `Failed to cancel execution: ${error}`);
    }
  }, [addLog]);

  return {
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleExportPipeline,
    handleImportPipeline,
    handleExecute,
    handleCancelExecution,
    getCurrentPipeline,
    processChartData,
  };
}
