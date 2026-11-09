import { invoke } from "@tauri-apps/api/core";
import { writeFile, remove } from "@tauri-apps/plugin-fs";
import { xanCommands } from "@/data/commands";
import { BatchFilterConfig } from "@/types/xan";
import type { RunContext } from "@/types/execution";
import { parseFrequencyValues } from "@/utils/batchFilterValues";

/**
 * Batch filter execution. Every entry point takes a `RunContext`, so the loop
 * reads the run's own tab / delimiter / cancel flag instead of "the current
 * tab" - that is what lets two tabs batch-filter at once.
 * Logging goes through `ctx.log`, which tags every line with the run's tab.
 */
export function useBatchFilter() {
  const sanitizeFileName = (value: string): string => {
    // Remove all characters not allowed in Windows filenames
    // eslint-disable-next-line no-control-regex -- \x00-\x1f are control characters, which Windows also forbids in filenames
    return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").substring(0, 50);
  };

  const buildRegexPattern = (operator: string, value: string): string => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    switch (operator) {
      case "equals":
        return `^${escaped}$`;
      case "starts_with":
      case "not_starts_with":
        return `^${escaped}`;
      case "ends_with":
      case "not_ends_with":
        return `${escaped}$`;
      case "contains":
      case "not_contains":
        return escaped;
      default:
        return escaped;
    }
  };

  /** Temp input files are best effort: a leftover must not fail the run. */
  const removeTempInput = async (path: string) => {
    try {
      await remove(path);
    } catch {
      /* ignore */
    }
  };

  /**
   * Column whose distinct values feed the batch ("value source: from column").
   * The form prefills it from the filter column, but it can be cleared - then
   * filtering a column by its own values is the only sensible reading.
   */
  const resolveExtractColumn = (config: BatchFilterConfig): string =>
    (config.extractColumn || "").trim() || (config.column || "").trim();

  /**
   * Distinct values of `column`, read from `xan frequency`.
   *
   * `--all` is not optional: without it xan returns only the 10 most frequent
   * values. `--no-extra` drops the `<empty>` / `<rest>` rows, which are not
   * values that can be searched for. Parsing is delimiter-aware because the
   * table is written with the input's delimiter (see `utils/batchFilterValues`).
   */
  const extractColumnValues = async (
    ctx: RunContext,
    inputFilePath: string,
    column: string,
  ): Promise<string[]> => {
    if (!column) {
      ctx.log("error", "No column given to extract values from");
      return [];
    }

    ctx.log("info", `Extracting unique values from column "${column}"...`);

    const result = await invoke<any>("execute_xan_pipeline", {
      commands: [
        {
          name: "frequency",
          parameters: [
            { name: "select", value: column, isPositional: false },
            { name: "all", value: "true", isPositional: false },
            { name: "no-extra", value: "true", isPositional: false },
          ],
        },
      ],
      inputFile: inputFilePath,
      runId: ctx.runId,
      defaultDelimiter: ctx.delimiter,
    });

    if (!result?.success) {
      ctx.log(
        "error",
        `Failed to extract values: ${result?.error ?? "unknown error"}`,
      );
      return [];
    }

    const values = parseFrequencyValues(result.output || "", ctx.delimiter);
    ctx.log(
      "info",
      `Found ${values.length} distinct value(s) in column "${column}"`,
    );
    return values;
  };

  const executeBatchFilterDirect = async (
    ctx: RunContext,
    config: BatchFilterConfig,
    inputFilePath: string,
  ) => {
    const baseName =
      inputFilePath
        .replace(/\.[^.]+$/, "")
        .split(/[\\/]/)
        .pop() || "output";
    // Use custom output dir if provided, otherwise use source file directory
    let outputDir: string;
    if (config.outputDir && config.outputDir.trim()) {
      outputDir = config.outputDir.trim();
    } else {
      const lastSlash = Math.max(
        inputFilePath.lastIndexOf("/"),
        inputFilePath.lastIndexOf("\\"),
      );
      outputDir = lastSlash >= 0 ? inputFilePath.substring(0, lastSlash) : ".";
    }

    // Step 1: Resolve values list
    let values: string[] = [];
    if (config.valueMode === "manual") {
      values = (config.manualValues || "")
        .split("\n")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    } else {
      values = await extractColumnValues(
        ctx,
        inputFilePath,
        resolveExtractColumn(config),
      );
    }

    if (values.length === 0) {
      ctx.log("warning", "No values to process");
      return;
    }

    // Special case: is_null / is_not_null
    if (
      config.textOperator === "is_null" ||
      config.textOperator === "is_not_null"
    ) {
      const searchCmd = xanCommands.find((cmd) => cmd.id === "search");
      if (searchCmd) {
        const params: any[] = [
          { name: "select", value: config.column, isPositional: false },
          {
            name: config.textOperator === "is_null" ? "empty" : "non-empty",
            value: "true",
            isPositional: false,
          },
        ];
        const commands = [{ name: searchCmd.name, parameters: params }];

        ctx.onProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: "executing",
        });
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: inputFilePath,
          runId: ctx.runId,
          defaultDelimiter: ctx.delimiter,
        });
        if (result.success) {
          ctx.log("success", `Completed: ${config.textOperator}`);
        } else {
          ctx.log("error", `Failed: ${result.error}`);
        }
        ctx.onProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: result.success ? "completed" : "error",
        });
      }
      return;
    }

    // Execute for each value
    for (let i = 0; i < values.length; i++) {
      // Honor a pending cancel request between iterations
      if (ctx.isCancelled()) {
        ctx.log("warning", `Batch filter cancelled after ${i} value(s)`);
        break;
      }
      const value = values[i];
      const displayName =
        value.length > 20 ? value.substring(0, 20) + "..." : value;
      ctx.log(
        "info",
        `Processing value ${i + 1}/${values.length}: "${displayName}"`,
      );

      ctx.onProgress({
        current: i + 1,
        total: values.length,
        name: `Filtering: "${displayName}"`,
        status: "executing",
      });

      let commands: any[];
      if (config.filterType === "text") {
        const searchCmd = xanCommands.find((cmd) => cmd.id === "search");
        if (!searchCmd) continue;

        const params: any[] = [
          { name: "select", value: config.column, isPositional: false },
        ];

        const isNegative = [
          "not_equals",
          "not_starts_with",
          "not_ends_with",
          "not_contains",
        ].includes(config.textOperator || "");

        if (
          config.textOperator === "equals" ||
          config.textOperator === "not_equals"
        ) {
          params.push({ name: "exact", value: "true", isPositional: false });
          params.push({ name: "pattern", value: value, isPositional: true });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
          if (isNegative) {
            params.push({
              name: "invert-match",
              value: "true",
              isPositional: false,
            });
          }
        } else if (config.textOperator === "regex") {
          params.push({ name: "pattern", value: value, isPositional: true });
          params.push({ name: "regex", value: "true", isPositional: false });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
        } else {
          const pattern = buildRegexPattern(
            config.textOperator || "contains",
            value,
          );
          params.push({ name: "pattern", value: pattern, isPositional: true });
          params.push({ name: "regex", value: "true", isPositional: false });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
          if (isNegative) {
            params.push({
              name: "invert-match",
              value: "true",
              isPositional: false,
            });
          }
        }

        commands = [{ name: searchCmd.name, parameters: params }];
      } else {
        const filterCmd = xanCommands.find((cmd) => cmd.id === "filter");
        if (!filterCmd) continue;

        const op =
          config.numberOperator === "equals"
            ? "=="
            : config.numberOperator === "not_equals"
              ? "!="
              : config.numberOperator === "greater_than"
                ? ">"
                : config.numberOperator === "greater_or_equal"
                  ? ">="
                  : config.numberOperator === "less_than"
                    ? "<"
                    : "<=";

        const expression = `col("${config.column}") ${op} ${value}`;
        commands = [
          {
            name: filterCmd.name,
            parameters: [
              { name: "expression", value: expression, isPositional: true },
            ],
          },
        ];
      }

      const sanitizedValue = sanitizeFileName(value);
      const outputPath = `${outputDir}/${baseName}_${sanitizedValue}.csv`;

      commands[commands.length - 1].parameters.push({
        name: "output",
        value: outputPath,
        isPositional: false,
      });

      try {
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: inputFilePath,
          runId: ctx.runId,
          defaultDelimiter: ctx.delimiter,
        });

        ctx.onProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          ctx.log(
            "success",
            `Value "${displayName}" completed -> ${outputPath}`,
          );
        } else {
          ctx.log("error", `Value "${displayName}" failed: ${result.error}`);
        }
      } catch (error) {
        ctx.log("error", `Value "${displayName}" error: ${error}`);
        ctx.onProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: "error",
        });
      }
    }

    const successCount = values.length;
    ctx.log(
      "success",
      `Batch filter completed: ${successCount} files generated`,
    );
  };

  const executeBatchFilterWithData = async (
    ctx: RunContext,
    config: BatchFilterConfig,
    inputData: string,
  ) => {
    // Use custom output dir if provided, otherwise use this run's input file directory
    const defaultInputFile = ctx.inputFile || "";
    let outputDir: string;
    if (config.outputDir && config.outputDir.trim()) {
      outputDir = config.outputDir.trim();
    } else {
      const lastSlash = Math.max(
        defaultInputFile.lastIndexOf("/"),
        defaultInputFile.lastIndexOf("\\"),
      );
      outputDir =
        lastSlash >= 0 ? defaultInputFile.substring(0, lastSlash) : ".";
    }
    const baseName =
      defaultInputFile
        .replace(/\.[^.]+$/, "")
        .split(/[\\/]/)
        .pop() || "output";

    // xan only reads files, so the pre-batch data is spilled once; both value
    // extraction and every per-value filter run against this copy. The name is
    // per-run so two tabs batch filtering at once cannot clobber each other.
    const tempInputPath = `${outputDir}/.batch_tmp_${ctx.runId}.csv`;
    await writeFile(tempInputPath, new TextEncoder().encode(inputData));

    // Step 1: Resolve values list
    let values: string[] = [];
    if (config.valueMode === "manual") {
      values = (config.manualValues || "")
        .split("\n")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    } else {
      values = await extractColumnValues(
        ctx,
        tempInputPath,
        resolveExtractColumn(config),
      );
    }

    if (values.length === 0) {
      ctx.log("warning", "No values to process");
      await removeTempInput(tempInputPath);
      return;
    }

    // Special case: is_null / is_not_null
    if (
      config.textOperator === "is_null" ||
      config.textOperator === "is_not_null"
    ) {
      const searchCmd = xanCommands.find((cmd) => cmd.id === "search");
      if (searchCmd) {
        const params: any[] = [
          { name: "select", value: config.column, isPositional: false },
          {
            name: config.textOperator === "is_null" ? "empty" : "non-empty",
            value: "true",
            isPositional: false,
          },
        ];
        const commands = [{ name: searchCmd.name, parameters: params }];

        ctx.onProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: "executing",
        });
        // The temp copy already holds the pre-batch data.
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: tempInputPath,
          runId: ctx.runId,
          defaultDelimiter: ctx.delimiter,
        });
        if (result.success) {
          ctx.log("success", `Completed: ${config.textOperator}`);
        } else {
          ctx.log("error", `Failed: ${result.error}`);
        }
        ctx.onProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: result.success ? "completed" : "error",
        });
      }
      await removeTempInput(tempInputPath);
      return;
    }

    // Execute for each value
    for (let i = 0; i < values.length; i++) {
      // Honor a pending cancel request between iterations
      if (ctx.isCancelled()) {
        ctx.log("warning", `Batch filter cancelled after ${i} value(s)`);
        break;
      }
      const value = values[i];
      const displayName =
        value.length > 20 ? value.substring(0, 20) + "..." : value;
      ctx.log(
        "info",
        `Processing value ${i + 1}/${values.length}: "${displayName}"`,
      );

      ctx.onProgress({
        current: i + 1,
        total: values.length,
        name: `Filtering: "${displayName}"`,
        status: "executing",
      });

      let commands: any[];
      if (config.filterType === "text") {
        const searchCmd = xanCommands.find((cmd) => cmd.id === "search");
        if (!searchCmd) continue;

        const params: any[] = [
          { name: "select", value: config.column, isPositional: false },
        ];

        const isNegative = [
          "not_equals",
          "not_starts_with",
          "not_ends_with",
          "not_contains",
        ].includes(config.textOperator || "");

        if (
          config.textOperator === "equals" ||
          config.textOperator === "not_equals"
        ) {
          params.push({ name: "exact", value: "true", isPositional: false });
          params.push({ name: "pattern", value: value, isPositional: true });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
          if (isNegative) {
            params.push({
              name: "invert-match",
              value: "true",
              isPositional: false,
            });
          }
        } else if (config.textOperator === "regex") {
          params.push({ name: "pattern", value: value, isPositional: true });
          params.push({ name: "regex", value: "true", isPositional: false });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
        } else {
          const pattern = buildRegexPattern(
            config.textOperator || "contains",
            value,
          );
          params.push({ name: "pattern", value: pattern, isPositional: true });
          params.push({ name: "regex", value: "true", isPositional: false });
          if (config.caseInsensitive) {
            params.push({
              name: "ignore-case",
              value: "true",
              isPositional: false,
            });
          }
          if (isNegative) {
            params.push({
              name: "invert-match",
              value: "true",
              isPositional: false,
            });
          }
        }

        commands = [{ name: searchCmd.name, parameters: params }];
      } else {
        const filterCmd = xanCommands.find((cmd) => cmd.id === "filter");
        if (!filterCmd) continue;

        const op =
          config.numberOperator === "equals"
            ? "=="
            : config.numberOperator === "not_equals"
              ? "!="
              : config.numberOperator === "greater_than"
                ? ">"
                : config.numberOperator === "greater_or_equal"
                  ? ">="
                  : config.numberOperator === "less_than"
                    ? "<"
                    : "<=";

        const expression = `col("${config.column}") ${op} ${value}`;
        commands = [
          {
            name: filterCmd.name,
            parameters: [
              { name: "expression", value: expression, isPositional: true },
            ],
          },
        ];
      }

      const sanitizedValue = sanitizeFileName(value);
      const outputPath = `${outputDir}/${baseName}_${sanitizedValue}.csv`;

      commands[commands.length - 1].parameters.push({
        name: "output",
        value: outputPath,
        isPositional: false,
      });

      try {
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: tempInputPath,
          runId: ctx.runId,
          defaultDelimiter: ctx.delimiter,
        });

        ctx.onProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          ctx.log(
            "success",
            `Value "${displayName}" completed -> ${outputPath}`,
          );
        } else {
          ctx.log("error", `Value "${displayName}" failed: ${result.error}`);
        }
      } catch (error) {
        ctx.log("error", `Value "${displayName}" error: ${error}`);
        ctx.onProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: "error",
        });
      }
    }

    // Clean up temp file
    await removeTempInput(tempInputPath);

    const successCount = values.length;
    ctx.log(
      "success",
      `Batch filter completed: ${successCount} files generated`,
    );
  };

  return {
    executeBatchFilterDirect,
    executeBatchFilterWithData,
  };
}
