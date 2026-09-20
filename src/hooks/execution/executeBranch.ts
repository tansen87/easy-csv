import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ChartConfig, PipelineStep, PipelineTab } from "@/types/xan";
import type { BatchFilterConfig } from "@/types/xan";
import type {
  BranchProgressState,
  RunPipelineDeps,
} from "@/hooks/execution/runPipelineDeps";
import { MAX_OUTPUT_BYTES } from "@/hooks/execution/runPipelineDeps";
import { serializeStepParams } from "@/hooks/execution/serializeStepParams";
import { processChartData } from "@/hooks/charts/processChartData";

interface BranchOutcome {
  success: boolean;
  output?: string;
  error?: string;
  cancelled?: boolean;
  stepErrors?: Record<string, string>;
  branchStepNames: string[];
}

interface ExecuteBranchArgs {
  branchSteps: PipelineStep[];
  index: number;
  total: number;
  inputFile: string;
  outputPath: string;
  currentTab: PipelineTab;
  deps: RunPipelineDeps;
  onBranchProgress: (value: BranchProgressState | null) => void;
  markFailed: () => void;
}

/**
 * Run one branch of the execution graph: batch-from/batch-to pairing,
 * batch-filter (with optional pre-batch pipeline), frontend chart rendering,
 * or a plain xan pipeline with the output param appended.
 */
export async function executeSingleBranch({
  branchSteps,
  index,
  total,
  inputFile,
  outputPath,
  currentTab,
  deps,
  onBranchProgress,
  markFailed,
}: ExecuteBranchArgs): Promise<BranchOutcome> {
  const { addLog, resolveRunDelimiter } = deps;
  if (branchSteps.length === 0) {
    return { success: true, branchStepNames: [] };
  }

  const branchStepNames = branchSteps.map((s) => s.alias || s.command.name);
  const branchName = branchStepNames.join(" -> ");
  addLog("info", `Executing branch ${index + 1}/${total}: ${branchName}`);

  onBranchProgress({
    current: index + 1,
    total,
    name: branchName,
    status: "executing",
  });

  const failBranch = (error: string): BranchOutcome => {
    onBranchProgress({
      current: index + 1,
      total,
      name: branchName,
      status: "error",
    });
    markFailed();
    return { success: false, error, branchStepNames };
  };

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
      return failBranch("batch-to requires batch-from");
    }
    if (batchToIndex < 0) {
      return failBranch("batch-from requires batch-to");
    }
    // Execute batch conversion
    const batchFromStep = branchSteps[batchFromIndex];
    const batchToStep = branchSteps[batchToIndex];
    await deps.executeBatchConvert(
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
      const preCommands = preBatchSteps.map((step) => ({
        name: step.command.name,
        id: step.id,
        parameters: serializeStepParams(step),
      }));

      const preResult = await invoke<any>("execute_xan_pipeline", {
        commands: preCommands,
        inputFile,
        defaultDelimiter: resolveRunDelimiter(),
        maxOutputBytes: MAX_OUTPUT_BYTES,
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
        await deps.executeBatchFilterWithData(bfConfig, preBatchOutput);
      } else {
        await deps.executeBatchFilterDirect(bfConfig, inputFile);
      }
      result = { success: true, output: "" };
    }
  } else if (branchSteps.findIndex((s) => s.command.id === "chart") >= 0) {
    result = await runChartBranch({
      branchSteps,
      inputFile,
      currentTab,
      deps,
    });
  } else {
    // Normal pipeline execution (no batch-filter)
    const commands = branchSteps.map((step, i) => {
      let params = serializeStepParams(step);

      if (step.command.name === "run") {
        const mode = step.parameters.mode || "pipeline";
        params = params.filter((param) => {
          if (mode === "script" && param.name === "pipeline") return false;
          if (mode === "pipeline" && param.name === "file") return false;
          return true;
        });
      }

      if (i === branchSteps.length - 1 && outputPath) {
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
      defaultDelimiter: resolveRunDelimiter(),
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
  }

  if (result?.cancelled) {
    onBranchProgress({
      current: index + 1,
      total,
      name: branchName,
      status: "error",
    });
    markFailed();
    return { ...result, cancelled: true, branchStepNames };
  }

  onBranchProgress({
    current: index + 1,
    total,
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
        `Branch ${index + 1} completed successfully with no output`,
      );
    }
  } else {
    if (result.error) {
      addLog("error", `${result.error}`);
    } else {
      addLog("error", `Branch ${index + 1} failed with no error message`);
    }
  }

  return {
    success: result.success,
    output: result.output,
    error: result.error,
    stepErrors: result.step_errors,
    branchStepNames,
  };
}

interface ChartBranchArgs {
  branchSteps: PipelineStep[];
  inputFile: string;
  currentTab: PipelineTab;
  deps: RunPipelineDeps;
}

/** `chart` command: run preceding steps (or read the raw input) and render the chart in the frontend with recharts. */
async function runChartBranch({
  branchSteps,
  inputFile,
  currentTab,
  deps,
}: ChartBranchArgs): Promise<any> {
  const { resolveRunDelimiter } = deps;
  const chartStep = branchSteps.find((s) => s.command.id === "chart");
  if (!chartStep) {
    return { success: false, error: "Chart step not found" };
  }

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
  const precedingSteps = branchSteps.filter((s) => s.command.id !== "chart");
  let headers = currentTab.headers || [];
  let data = currentTab.data || [];

  const parseCsvText = (text: string, delimiter: string) => {
    const lines = text.trim().split("\n");
    if (lines.length === 0) return;
    headers = lines[0]
      .split(delimiter)
      .map((h: string) => h.trim().replace(/^"|"$/g, ""));
    data = lines
      .slice(1)
      .map((line: string) =>
        line
          .split(delimiter)
          .map((cell: string) => cell.trim().replace(/^"|"$/g, "")),
      );
  };

  if (precedingSteps.length > 0) {
    const preCommands = precedingSteps.map((step) => ({
      name: step.command.name,
      id: step.id,
      parameters: serializeStepParams(step),
    }));

    const preResult = await invoke<any>("execute_xan_pipeline", {
      commands: preCommands,
      inputFile,
      defaultDelimiter: resolveRunDelimiter(),
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    if (preResult.success && preResult.output) {
      // Parse CSV output
      parseCsvText(preResult.output as string, resolveRunDelimiter() || ",");
    }
  } else {
    // Use raw CSV data
    if (inputFile) {
      const csvContent = await readFile(inputFile);
      const text = new TextDecoder().decode(csvContent);
      parseCsvText(text, resolveRunDelimiter() || ",");
    }
  }

  // Process data for chart
  const chartSeries = processChartData(headers, data, chartConfig);

  deps.setChartConfig(chartConfig);
  deps.setChartSeries(chartSeries);
  deps.setChartHeaders(headers);
  deps.setShowChartPanel(true);

  return {
    success: true,
    output: `Chart generated: ${chartConfig.chartType} (${chartConfig.x}${chartConfig.y ? ` vs ${chartConfig.y}` : ""})`,
  };
}
