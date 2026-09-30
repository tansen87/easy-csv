import { invoke } from "@tauri-apps/api/core";
import { readDir } from "@tauri-apps/plugin-fs";
import type { RunContext } from "@/types/execution";

/**
 * Batch format conversion. Takes a `RunContext` at call time so the loop uses
 * the run's own tab / delimiter / cancel flag instead of "the current tab"
 * (design 028 §5.2). Logging goes through `ctx.log` (tagged with the tab).
 */
export function useBatchConvert() {
  const globToRegex = (pattern: string): RegExp => {
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp(`^${regexStr}$`, "i");
  };

  const collectFiles = async (
    ctx: RunContext,
    sourcePath: string,
    pattern: string,
    recursive: boolean,
  ): Promise<string[]> => {
    const files: string[] = [];
    const regex = globToRegex(pattern);

    const scanDir = async (dirPath: string) => {
      try {
        const entries = await readDir(dirPath);
        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;
          if (entry.isDirectory && recursive) {
            const subFiles = await collectFiles(ctx, fullPath, pattern, recursive);
            files.push(...subFiles);
          } else if (!entry.isDirectory && regex.test(entry.name || "")) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        ctx.log("error", `Failed to read directory: ${dirPath} - ${error}`);
      }
    };

    await scanDir(sourcePath);
    return files;
  };

  const getBaseName = (filePath: string): string => {
    const parts = filePath.split(/[\\/]/);
    const fileName = parts[parts.length - 1] || "output";
    const lastDot = fileName.lastIndexOf(".");
    return lastDot >= 0 ? fileName.substring(0, lastDot) : fileName;
  };

  const getOutputDir = (filePath: string, customOutputDir?: string): string => {
    if (customOutputDir && customOutputDir.trim()) {
      return customOutputDir.trim();
    }
    const lastSlash = Math.max(
      filePath.lastIndexOf("/"),
      filePath.lastIndexOf("\\"),
    );
    return lastSlash >= 0 ? filePath.substring(0, lastSlash) : ".";
  };

  const executeBatchConvert = async (
    ctx: RunContext,
    batchFromParams: Record<string, any>,
    batchToParams: Record<string, any>,
  ) => {
    const sourcePath = batchFromParams["source-path"];
    const pattern = batchFromParams.pattern || "*";
    const recursive = batchFromParams.recursive || false;
    const format = batchFromParams.format;
    const outputDir = batchToParams["output-dir"];
    const outputFormat = batchToParams.format || "xlsx";

    // Collect files from source path
    const sourcePaths = sourcePath.split(";").filter((p: string) => p.trim());
    let files: string[] = [];

    for (const sp of sourcePaths) {
      const trimmed = sp.trim();
      if (!trimmed) continue;

      // Check if it has a file extension (likely a file)
      const hasExtension = /\.\w+$/.test(trimmed);
      if (hasExtension) {
        // It's a file, add directly
        files.push(trimmed);
      } else {
        // It's a directory, collect files from it
        try {
          const dirFiles = await collectFiles(ctx, trimmed, pattern, recursive);
          files.push(...dirFiles);
        } catch {
          ctx.log("warning", `Cannot read directory: ${trimmed}`);
        }
      }
    }

    if (files.length === 0) {
      ctx.log("warning", "No files found to convert");
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      // Honor a pending cancel request between iterations
      if (ctx.isCancelled()) {
        ctx.log("warning", `Batch conversion cancelled after ${i} file(s)`);
        break;
      }
      const file = files[i];
      const displayName = getBaseName(file);

      ctx.log("info", `Processing ${i + 1}/${files.length}: ${displayName}`);
      ctx.onProgress({
        current: i + 1,
        total: files.length,
        name: `Converting: ${displayName}`,
        status: "executing",
      });

      try {
        // Build "from" command parameters
        const fromParams: Record<string, any> = {};
        if (format) {
          fromParams.format = format;
        }
        // Pass through format-specific params
        if (batchFromParams["sheet-index"] !== undefined)
          fromParams["sheet-index"] = batchFromParams["sheet-index"];
        if (batchFromParams["sheet-name"])
          fromParams["sheet-name"] = batchFromParams["sheet-name"];
        if (batchFromParams["sample-size"] !== undefined)
          fromParams["sample-size"] = batchFromParams["sample-size"];
        if (batchFromParams["sort-keys"])
          fromParams["sort-keys"] = batchFromParams["sort-keys"];
        if (batchFromParams["key-column"])
          fromParams["key-column"] = batchFromParams["key-column"];
        if (batchFromParams["value-column"])
          fromParams["value-column"] = batchFromParams["value-column"];
        if (batchFromParams["single-object"])
          fromParams["single-object"] = batchFromParams["single-object"];
        if (batchFromParams.column) fromParams.column = batchFromParams.column;
        if (batchFromParams["nth-table"] !== undefined)
          fromParams["nth-table"] = batchFromParams["nth-table"];

        // Build "to" command parameters
        const toParams: Record<string, any> = {};
        toParams.format = outputFormat;
        if (batchToParams["sample-size"] !== undefined)
          toParams["sample-size"] = batchToParams["sample-size"];
        if (batchToParams.nulls) toParams.nulls = batchToParams.nulls;
        if (batchToParams.omit) toParams.omit = batchToParams.omit;
        if (batchToParams.strings) toParams.strings = batchToParams.strings;
        if (batchToParams.dtype) toParams.dtype = batchToParams.dtype;
        if (batchToParams.select) toParams.select = batchToParams.select;
        if (batchToParams.limit !== undefined)
          toParams.limit = batchToParams.limit;

        // Build output path
        const fileOutputDir = getOutputDir(file, outputDir);
        const outputFileName = `${getBaseName(file)}.${outputFormat}`;
        const outputPath = `${fileOutputDir}/${outputFileName}`;

        // Build pipeline commands
        // - "from" converts FROM other formats TO CSV
        // - "to" converts FROM CSV TO other formats
        const commands: Array<{
          name: string;
          parameters: Array<{
            name: string;
            value: string;
            isPositional: boolean;
          }>;
        }> = [];

        const sourceIsCsv = !format || format === "csv";
        const targetIsCsv = outputFormat === "csv";

        if (sourceIsCsv && targetIsCsv) {
          // csv -> csv: no conversion needed, just copy
          // This shouldn't happen in practice, but handle gracefully
          ctx.log(
            "warning",
            "Source and target are both CSV, no conversion needed",
          );
          ctx.onProgress({
            current: i + 1,
            total: files.length,
            name: `Converting: ${displayName}`,
            status: "completed",
          });
          successCount++;
          continue;
        } else if (sourceIsCsv && !targetIsCsv) {
          // csv → xlsx/json/etc: use "to" command
          commands.push({
            name: "to",
            parameters: [
              ...Object.entries(toParams).map(([name, value]) => ({
                name,
                value: String(value),
                isPositional: name === "format",
              })),
              {
                name: "output",
                value: outputPath,
                isPositional: false,
              },
            ],
          });
        } else if (!sourceIsCsv && targetIsCsv) {
          // xlsx/json/etc → csv: use "from" command
          commands.push({
            name: "from",
            parameters: [
              ...Object.entries(fromParams).map(([name, value]) => ({
                name,
                value: String(value),
                isPositional: false,
              })),
              {
                name: "output",
                value: outputPath,
                isPositional: false,
              },
            ],
          });
        } else {
          // xlsx/json/etc → xlsx/json/etc: use "from" then "to"
          commands.push({
            name: "from",
            parameters: Object.entries(fromParams).map(([name, value]) => ({
              name,
              value: String(value),
              isPositional: false,
            })),
          });
          commands.push({
            name: "to",
            parameters: [
              ...Object.entries(toParams).map(([name, value]) => ({
                name,
                value: String(value),
                isPositional: name === "format",
              })),
              {
                name: "output",
                value: outputPath,
                isPositional: false,
              },
            ],
          });
        }

        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile: file,
          runId: ctx.runId,
          defaultDelimiter: ctx.delimiter,
        });

        ctx.onProgress({
          current: i + 1,
          total: files.length,
          name: `Converting: ${displayName}`,
          status: result.success ? "completed" : "error",
        });

        if (result.success) {
          successCount++;
        } else {
          ctx.log("error", `${displayName} failed: ${result.error}`);
          failCount++;
        }
      } catch (error) {
        ctx.log("error", `${displayName} error: ${error}`);
        ctx.onProgress({
          current: i + 1,
          total: files.length,
          name: `Converting: ${displayName}`,
          status: "error",
        });
        failCount++;
      }
    }

    const summary = `Batch conversion completed: ${successCount} success, ${failCount} failed`;
    ctx.log("success", summary);
  };

  return {
    executeBatchConvert,
  };
}
