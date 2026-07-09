import { invoke } from "@tauri-apps/api/core";
import { writeFile, remove } from "@tauri-apps/plugin-fs";
import { xanCommands } from "@/data/commands";
import { BatchFilterConfig } from "@/components/dialog/BatchFilterDialog";

interface BatchFilterHooksProps {
  defaultDelimiter: string;
  addLog: (
    type: "info" | "success" | "warning" | "error",
    message: string,
  ) => void;
  setBranchProgress: React.Dispatch<
    React.SetStateAction<{
      current: number;
      total: number;
      name: string;
      status: "executing" | "completed" | "error";
    } | null>
  >;
  getCurrentTab: () => { inputFile?: string };
}

export function BatchFilterHooks({
  defaultDelimiter,
  addLog,
  setBranchProgress,
  getCurrentTab,
}: BatchFilterHooksProps) {
  const sanitizeFileName = (value: string): string => {
    // Remove all characters not allowed in Windows filenames
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

  const executeBatchFilterDirect = async (
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
      addLog(
        "info",
        `Extracting unique values from column "${config.extractColumn}"...`,
      );
      const extractResult = await invoke<any>("execute_xan_pipeline", {
        commands: [
          {
            name: "frequency",
            parameters: [
              {
                name: "select",
                value: config.extractColumn || "",
                isPositional: false,
              },
            ],
          },
        ],
        inputFile: inputFilePath,
        defaultDelimiter,
      });

      if (!extractResult.success) {
        addLog("error", `Failed to extract values: ${extractResult.error}`);
        return;
      }

      const lines = (extractResult.output || "").trim().split("\n");
      values = lines
        .map((line: string) => line.split("\t")[0])
        .filter((v: string) => v.length > 0 && v !== "value");
    }

    if (values.length === 0) {
      addLog("warning", "No values to process");
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

        setBranchProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: "executing",
        });
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: inputFilePath,
          defaultDelimiter,
        });
        if (result.success) {
          addLog("success", `Completed: ${config.textOperator}`);
        } else {
          addLog("error", `Failed: ${result.error}`);
        }
        setBranchProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: result.success ? "completed" : "error",
        });
      }
      return;
    }

    // Step 2: Execute for each value
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const displayName =
        value.length > 20 ? value.substring(0, 20) + "..." : value;
      addLog(
        "info",
        `Processing value ${i + 1}/${values.length}: "${displayName}"`,
      );

      setBranchProgress({
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
          defaultDelimiter,
        });

        setBranchProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          addLog(
            "success",
            `Value "${displayName}" completed -> ${outputPath}`,
          );
        } else {
          addLog("error", `Value "${displayName}" failed: ${result.error}`);
        }
      } catch (error) {
        addLog("error", `Value "${displayName}" error: ${error}`);
        setBranchProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: "error",
        });
      }
    }

    const successCount = values.length;
    addLog(
      "success",
      `Batch filter completed: ${successCount} files generated`,
    );
  };

  const executeBatchFilterWithData = async (
    config: BatchFilterConfig,
    inputData: string,
  ) => {
    // Use custom output dir if provided, otherwise use current tab's input file directory
    const currentTab = getCurrentTab();
    const defaultInputFile = currentTab.inputFile || "";
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

    // Step 1: Resolve values list
    let values: string[] = [];
    if (config.valueMode === "manual") {
      values = (config.manualValues || "")
        .split("\n")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    } else {
      addLog(
        "info",
        `Extracting unique values from column "${config.extractColumn}"...`,
      );
      // For column mode with pre-batch data, we need to parse the CSV data
      // The input data is CSV text, parse it to extract unique values
      const lines = inputData.trim().split("\n");
      if (lines.length > 0) {
        const headers = lines[0].split(",");
        const colIndex = headers.findIndex(
          (h) => h.trim() === config.extractColumn,
        );
        if (colIndex >= 0) {
          const uniqueValues = new Set<string>();
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");
            if (cols[colIndex]) {
              uniqueValues.add(cols[colIndex].trim());
            }
          }
          values = Array.from(uniqueValues);
        }
      }
    }

    if (values.length === 0) {
      addLog("warning", "No values to process");
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

        setBranchProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: "executing",
        });
        // Write input data to temp file for xan processing
        const tempInputPath = `${outputDir}/.batch_tmp_input.csv`;
        const encoder = new TextEncoder();
        await writeFile(tempInputPath, encoder.encode(inputData));
        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: tempInputPath,
          defaultDelimiter,
        });
        if (result.success) {
          addLog("success", `Completed: ${config.textOperator}`);
        } else {
          addLog("error", `Failed: ${result.error}`);
        }
        setBranchProgress({
          current: 1,
          total: 1,
          name: config.textOperator,
          status: result.success ? "completed" : "error",
        });
        // Clean up temp file
        try {
          await remove(tempInputPath);
        } catch {
          /* ignore */
        }
      }
      return;
    }

    // Write input data to temp file for xan processing
    const tempInputPath = `${outputDir}/.batch_tmp_input.csv`;
    const encoder = new TextEncoder();
    await writeFile(tempInputPath, encoder.encode(inputData));

    // Step 2: Execute for each value
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      const displayName =
        value.length > 20 ? value.substring(0, 20) + "..." : value;
      addLog(
        "info",
        `Processing value ${i + 1}/${values.length}: "${displayName}"`,
      );

      setBranchProgress({
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
          defaultDelimiter,
        });

        setBranchProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          addLog(
            "success",
            `Value "${displayName}" completed -> ${outputPath}`,
          );
        } else {
          addLog("error", `Value "${displayName}" failed: ${result.error}`);
        }
      } catch (error) {
        addLog("error", `Value "${displayName}" error: ${error}`);
        setBranchProgress({
          current: i + 1,
          total: values.length,
          name: `Filtering: "${displayName}"`,
          status: "error",
        });
      }
    }

    // Clean up temp file
    try {
      await remove(tempInputPath);
    } catch {
      // Ignore cleanup errors
    }

    const successCount = values.length;
    addLog(
      "success",
      `Batch filter completed: ${successCount} files generated`,
    );
  };

  return {
    executeBatchFilterDirect,
    executeBatchFilterWithData,
  };
}
