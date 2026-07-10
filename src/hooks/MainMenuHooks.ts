import { useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import {
  PipelineStep,
  PipelineTab,
  PipelineEdge,
  LogEntry,
  HistoricalPipeline,
} from "@/types/xan";
import { xanCommands } from "@/data/commands";
import { BatchFilterConfig } from "@/components/dialog/BatchFilterDialog";
import { BatchFilterHooks } from "@/hooks/BatchFilterHooks";
import { BatchConvertHooks } from "@/hooks/BatchConvertHooks";

interface MainMenuHooksProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  undoStack: Array<{
    pipeline: PipelineStep[];
    edges: PipelineEdge[];
    inputPosition?: { x: number; y: number };
  }>;
  redoStack: Array<{
    pipeline: PipelineStep[];
    edges: PipelineEdge[];
    inputPosition?: { x: number; y: number };
  }>;
  historicalPipelines: HistoricalPipeline[];
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
  progressHideTimerRef: React.MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  loadCsvData: (
    tabId: string,
    filePath: string,
    customDelimiter?: string,
  ) => Promise<void>;
  updateHistoricalPipelines: (history: HistoricalPipeline[]) => void;
  formatDateTime: (date: Date) => string;
}

export function MainMenuHooks({
  tabs,
  selectedTabId,
  undoStack,
  redoStack,
  historicalPipelines,
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
  updateHistoricalPipelines,
  formatDateTime,
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

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (!currentTab) return;

    setRedoStack((prev) => [
      ...prev,
      {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
      },
    ]);

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: previousState.pipeline,
              edges: previousState.edges,
              inputPosition: previousState.inputPosition,
              updatedAt: formatDateTime(new Date()),
            }
          : tab,
      ),
    );

    setSelectedStep(null);
  }, [
    undoStack,
    selectedTabId,
    tabs,
    setRedoStack,
    setUndoStack,
    setTabs,
    setSelectedStep,
    formatDateTime,
  ]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentTab = tabs.find((t) => t.id === selectedTabId);
    if (!currentTab) return;

    setUndoStack((prev) => [
      ...prev,
      {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition,
      },
    ]);

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));

    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === selectedTabId
          ? {
              ...tab,
              pipeline: nextState.pipeline,
              edges: nextState.edges,
              inputPosition: nextState.inputPosition,
              updatedAt: formatDateTime(new Date()),
            }
          : tab,
      ),
    );

    setSelectedStep(null);
  }, [
    redoStack,
    selectedTabId,
    tabs,
    setUndoStack,
    setRedoStack,
    setTabs,
    setSelectedStep,
    formatDateTime,
  ]);

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
            if (typeof value === "string") {
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

      const pipelineContent = pipelineLines.join(" | ");
      const filePath = await save({
        filters: [{ name: "Xan Stream Files", extensions: ["xanscript"] }],
        defaultPath: `${getCurrentTab().name}.xanscript`,
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(pipelineContent));
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
        version: "0.2.0",
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
        const nextNodes = adjacency.get(currentId) || [];

        if (nextNodes.length === 0) {
          branches.push(newPath);
          return;
        }

        nextNodes.forEach((nextId: string) => {
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
          tableEdges.forEach((startId) => {
            dfs(startId, []);
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

      const branches = buildExecutionBranches(executableSteps, edges);

      const allResults: {
        success: boolean;
        output?: string;
        error?: string;
        branchSteps: string[];
      }[] = [];

      let pipelineFailed = false;
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
              return { name: step.command.name, parameters: params };
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
        } else {
          // Normal pipeline execution (no batch-filter)
          const commands = branchSteps.map((step, index) => {
            let params = step.command.parameters.map((param) => ({
              name: param.name,
              value: String(step.parameters[param.name] || param.default || ""),
              isPositional: param.isPositional,
            }));

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
              parameters: params,
            };
          });

          result = await invoke<any>("execute_xan_pipeline", {
            commands,
            inputFile,
            defaultDelimiter,
          });
        }

        allResults.push({
          success: result.success,
          output: result.output,
          error: result.error,
          branchSteps: branchStepNames,
        });

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

      const currentTabName = currentTab.name;
      const existingHistoryIndex = historicalPipelines.findIndex(
        (h) => h.name === currentTabName,
      );

      const historicalPipeline: HistoricalPipeline = {
        id:
          existingHistoryIndex >= 0
            ? historicalPipelines[existingHistoryIndex].id
            : `history-${Date.now()}`,
        name: currentTabName,
        pipeline: currentPipeline.map(
          (step) =>
            ({
              id: step.id,
              commandId: step.command.id,
              parameters: step.parameters,
              alias: step.alias,
              position: step.position,
            }) as any,
        ),
        inputFile,
        defaultDelimiter,
        executedAt: formatDateTime(new Date()),
        success: allResults.every((r) => r.success),
        edges: edges,
        inputPosition: currentTab.inputPosition,
      };

      let updatedHistory: HistoricalPipeline[];
      if (existingHistoryIndex >= 0) {
        updatedHistory = [...historicalPipelines];
        updatedHistory[existingHistoryIndex] = historicalPipeline;
        updatedHistory.splice(existingHistoryIndex, 1);
        updatedHistory.unshift(historicalPipeline);
      } else {
        updatedHistory = [historicalPipeline, ...historicalPipelines].slice(
          0,
          50,
        );
      }

      updateHistoricalPipelines(updatedHistory);

      const successCount = allResults.filter((r) => r.success).length;
      if (successCount === branches.length) {
        addLog(
          "success",
          `All ${branches.length} branch(es) executed successfully`,
        );
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
    historicalPipelines,
    showToast,
    addLog,
    setIsExecuting,
    setShowLogPanel,
    setShowProgressBar,
    setBranchProgress,
    progressHideTimerRef,
    buildExecutionBranches,
    updateHistoricalPipelines,
    formatDateTime,
  ]);

  return {
    undo,
    redo,
    handleOpenFile,
    handleOpenNewTabWithFile,
    handleSavePipeline,
    handleExportPipeline,
    handleImportPipeline,
    handleExecute,
    getCurrentPipeline,
  };
}
