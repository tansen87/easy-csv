import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import type { ChartConfig, PipelineStep, PipelineTab } from "@/types/xan";
import type { BatchFilterConfig } from "@/types/xan";
import type { RunContext } from "@/types/execution";
import type { RunPipelineDeps } from "@/hooks/execution/runPipelineDeps";
import { MAX_OUTPUT_BYTES } from "@/hooks/execution/runPipelineDeps";
import { serializeStepParams } from "@/hooks/execution/serializeStepParams";
import { processChartDataWithIssues } from "@/hooks/charts/processChartData";

interface BranchOutcome {
  success: boolean;
  output?: string;
  error?: string;
  cancelled?: boolean;
  stepErrors?: Record<string, string>;
  branchStepNames: string[];
}

interface ExecuteBranchArgs {
  /** Per-run context: tabId/runId/delimiter never drift when the user switches tabs. */
  ctx: RunContext;
  branchSteps: PipelineStep[];
  index: number;
  total: number;
  outputPath: string;
  currentTab: PipelineTab;
  deps: RunPipelineDeps;
  markFailed: () => void;
}

/**
 * Run one branch of the execution graph: batch-from/batch-to pairing,
 * batch-filter (with optional pre-batch pipeline), frontend chart rendering,
 * or a plain xan pipeline with the output param appended.
 */
export async function executeSingleBranch({
  ctx,
  branchSteps,
  index,
  total,
  outputPath,
  currentTab,
  deps,
  markFailed,
}: ExecuteBranchArgs): Promise<BranchOutcome> {
  if (branchSteps.length === 0) {
    return { success: true, branchStepNames: [] };
  }

  const branchStepNames = branchSteps.map((s) => s.alias || s.command.name);
  const branchName = branchStepNames.join(" -> ");
  ctx.log("info", `Executing branch ${index + 1}/${total}: ${branchName}`);

  ctx.onProgress({
    current: index + 1,
    total,
    name: branchName,
    status: "executing",
  });

  const failBranch = (error: string): BranchOutcome => {
    ctx.onProgress({
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
      ctx,
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
      ctx.log(
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
        inputFile: ctx.inputFile,
        runId: ctx.runId,
        defaultDelimiter: ctx.delimiter,
        maxOutputBytes: MAX_OUTPUT_BYTES,
      });

      if (!preResult.success) {
        ctx.log("error", `Pre-batch steps failed: ${preResult.error}`);
        result = preResult;
      } else {
        preBatchOutput = preResult.output || "";
        ctx.log(
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
        await deps.executeBatchFilterWithData(ctx, bfConfig, preBatchOutput);
      } else {
        await deps.executeBatchFilterDirect(ctx, bfConfig, ctx.inputFile);
      }
      result = { success: true, output: "" };
    }
  } else if (branchSteps.findIndex((s) => s.command.id === "chart") >= 0) {
    result = await runChartBranch({
      ctx,
      branchSteps,
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
      inputFile: ctx.inputFile,
      runId: ctx.runId,
      // The chosen table of a `.duckdb` input; null otherwise.
      inputTable: currentTab?.sourceTable ?? null,
      defaultDelimiter: ctx.delimiter,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
  }

  if (result?.cancelled) {
    ctx.onProgress({
      current: index + 1,
      total,
      name: branchName,
      status: "error",
    });
    markFailed();
    return { ...result, cancelled: true, branchStepNames };
  }

  ctx.onProgress({
    current: index + 1,
    total,
    name: branchName,
    status: result.success ? "completed" : "error",
  });

  if (result.success) {
    if (result.output) {
      const output = (result.output as string).trimStart().trimEnd();
      ctx.log("success", `${output}`);
    } else {
      ctx.log(
        "info",
        `Branch ${index + 1} completed successfully with no output`,
      );
    }
  } else {
    if (result.error) {
      ctx.log("error", `${result.error}`);
    } else {
      ctx.log("error", `Branch ${index + 1} failed with no error message`);
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
  ctx: RunContext;
  branchSteps: PipelineStep[];
  currentTab: PipelineTab;
  deps: RunPipelineDeps;
}

/** `chart` command: run preceding steps (or read the raw input) and render the chart in the frontend with recharts. */
async function runChartBranch({
  ctx,
  branchSteps,
  currentTab,
  deps,
}: ChartBranchArgs): Promise<any> {
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
  let truncated = false;
  let totalRows = data.length;

  /**
   * Parse CSV through the backend `csv` crate instead of splitting strings here.
   *
   * The old local `split("\n")` + `split(delimiter)` broke on quoted fields
   * (`"Smith, John",42` became three columns) and disagreed with the preview
   * table, which already parses in Rust.
   */
  const parseCsvText = async (text: string, delimiter: string) => {
    const parsed = await invoke<{
      headers: string[];
      rows: string[][];
      truncated: boolean;
      total_rows: number;
    }>("parse_csv_text", {
      text,
      delimiter,
      hasHeaders: true,
    });

    headers = parsed.headers;
    data = parsed.rows;
    truncated = parsed.truncated;
    totalRows = parsed.total_rows;
  };

  if (precedingSteps.length > 0) {
    const preCommands = precedingSteps.map((step) => ({
      name: step.command.name,
      id: step.id,
      parameters: serializeStepParams(step),
    }));

    const preResult = await invoke<any>("execute_xan_pipeline", {
      commands: preCommands,
      inputFile: ctx.inputFile,
      runId: ctx.runId,
      defaultDelimiter: ctx.delimiter,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });

    if (preResult.success && preResult.output) {
      await parseCsvText(preResult.output as string, ctx.delimiter || ",");
    }
  } else {
    // Use raw CSV data
    if (ctx.inputFile) {
      const csvContent = await readFile(ctx.inputFile);
      const text = new TextDecoder().decode(csvContent);
      await parseCsvText(text, ctx.delimiter || ",");
    }
  }

  // A 2 MB stdout cap silently dropped rows before; surfacing the truncation
  // keeps the chart from presenting partial data as complete.
  if (truncated) {
    ctx.log(
      "info",
      `Chart data was truncated: showing the first ${data.length} of ${totalRows} rows. Averages and totals may be incomplete.`,
    );
  }

  // Process data for chart
  const processed = processChartDataWithIssues(headers, data, chartConfig);

  // Charts are per tab: another tab running a chart must not replace this one.
  deps.setTabChart(ctx.tabId, {
    config: chartConfig,
    series: processed.series,
    headers,
    rows: data,
    droppedRows: processed.droppedRows,
    issue: processed.issue,
    truncated,
    totalRows,
  });
  deps.setShowChartPanel(true);

  return {
    success: true,
    output: `Chart generated: ${chartConfig.chartType} (${chartConfig.x}${chartConfig.y ? ` vs ${chartConfig.y}` : ""})`,
  };
}