import { useCallback } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { PipelineStep, PipelineTab, PipelineEdge, LogEntry, HistoricalPipeline } from "@/types/xan";
import { xanCommands } from "@/data/commands";

interface MainMenuHooksProps {
  tabs: PipelineTab[];
  selectedTabId: string;
  undoStack: Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>;
  redoStack: Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>;
  historicalPipelines: HistoricalPipeline[];
  defaultDelimiter: string;
  showToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
  addLog: (type: LogEntry["type"], message: string) => void;
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>;
  setSelectedTabId: React.Dispatch<React.SetStateAction<string>>;
  setUndoStack: React.Dispatch<React.SetStateAction<Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>>>;
  setRedoStack: React.Dispatch<React.SetStateAction<Array<{ pipeline: PipelineStep[]; edges: PipelineEdge[]; inputPosition?: { x: number; y: number } }>>>;
  setSelectedStep: React.Dispatch<React.SetStateAction<PipelineStep | null>>;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  setShowLogPanel: React.Dispatch<React.SetStateAction<boolean>>;
  setShowProgressBar: React.Dispatch<React.SetStateAction<boolean>>;
  setBranchProgress: React.Dispatch<React.SetStateAction<{ current: number; total: number; name: string; status: "executing" | "completed" | "error" } | null>>;
  progressHideTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  loadCsvData: (tabId: string, filePath: string) => Promise<void>;
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

  const getCurrentPipeline = useCallback(() => {
    return getCurrentTab().pipeline;
  }, [getCurrentTab]);

  const updateTabPipeline = useCallback((tabIdOrPipeline: string | PipelineStep[], newPipeline?: PipelineStep[], edges?: PipelineEdge[], inputPosition?: { x: number; y: number }) => {
    const currentTab = typeof tabIdOrPipeline === 'string'
      ? tabs.find(t => t.id === tabIdOrPipeline)
      : tabs.find(t => t.id === selectedTabId);

    const newPipelineToSet = typeof tabIdOrPipeline === 'string' ? newPipeline! : tabIdOrPipeline as PipelineStep[];
    const isStateChanged = currentTab &&
      (JSON.stringify(currentTab.pipeline) !== JSON.stringify(newPipelineToSet) ||
        JSON.stringify(currentTab.edges) !== JSON.stringify(edges ?? currentTab.edges) ||
        JSON.stringify(currentTab.inputPosition) !== JSON.stringify(inputPosition ?? currentTab.inputPosition));

    if (currentTab && isStateChanged) {
      setUndoStack(prev => [...prev, {
        pipeline: currentTab.pipeline,
        edges: currentTab.edges || [],
        inputPosition: currentTab.inputPosition
      }]);
      setRedoStack([]);
    }

    if (typeof tabIdOrPipeline === 'string' && newPipeline) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === tabIdOrPipeline
            ? {
              ...tab,
              pipeline: newPipeline,
              edges: edges !== undefined ? edges : tab.edges,
              inputPosition: inputPosition !== undefined ? inputPosition : tab.inputPosition,
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
              inputPosition: inputPosition !== undefined ? inputPosition : tab.inputPosition,
              updatedAt: formatDateTime(new Date()),
            }
            : tab,
        ),
      );
    }
  }, [tabs, selectedTabId, setUndoStack, setRedoStack, setTabs, formatDateTime]);

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

    const currentTab = tabs.find(t => t.id === selectedTabId);
    if (!currentTab) return;

    setRedoStack(prev => [...prev, {
      pipeline: currentTab.pipeline,
      edges: currentTab.edges || [],
      inputPosition: currentTab.inputPosition
    }]);

    const previousState = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));

    setTabs(prev =>
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
  }, [undoStack, selectedTabId, tabs, setRedoStack, setUndoStack, setTabs, setSelectedStep, formatDateTime]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const currentTab = tabs.find(t => t.id === selectedTabId);
    if (!currentTab) return;

    setUndoStack(prev => [...prev, {
      pipeline: currentTab.pipeline,
      edges: currentTab.edges || [],
      inputPosition: currentTab.inputPosition
    }]);

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));

    setTabs(prev =>
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
  }, [redoStack, selectedTabId, tabs, setUndoStack, setRedoStack, setTabs, setSelectedStep, formatDateTime]);

  const handleOpenFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV Files", extensions: ["csv", "txt", "tsv"] },
        { name: "JSON Files", extensions: ["json", "jsonl"] },
        { name: "Excel Files", extensions: ["xlsx"] },
        { name: "Parquet Files", extensions: ["parquet"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (file) {
      loadCsvData(selectedTabId, file);
    }
  }, [selectedTabId, loadCsvData]);

  const handleOpenNewTabWithFile = useCallback(async () => {
    const newTabId = addNewTab();
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV Files", extensions: ["csv", "txt", "tsv"] },
        { name: "JSON Files", extensions: ["json", "jsonl"] },
        { name: "Excel Files", extensions: ["xlsx"] },
        { name: "Parquet Files", extensions: ["parquet"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (file) {
      loadCsvData(newTabId, file);
    }
  }, [addNewTab, loadCsvData]);

  const handleSavePipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    if (currentPipeline.length === 0) {
      showToast("No pipeline to save", 'warning');
      return;
    }

    try {
      const pipelineLines = currentPipeline.map((step) => {
        const params = step.command.parameters.map((param) => {
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
          const escapedValue = typeof value === 'string' && value.includes(' ') ? `"${value}"` : value;
          return `${prefix} ${escapedValue}`.trim();
        }).filter(Boolean).join(' ');

        return `xan ${step.command.name} ${params}`.trim();
      });

      const pipelineContent = pipelineLines.join(' | ');
      const filePath = await save({
        filters: [{ name: "Xan Stream Files", extensions: ["xs"] }],
        defaultPath: `${getCurrentTab().name}.xs`,
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(pipelineContent));
        showToast(`Pipeline saved to: ${filePath}`, 'success');
      }
    } catch (error) {
      showToast(`Failed to save pipeline: ${error}`, 'error');
    }
  }, [getCurrentPipeline, getCurrentTab, showToast]);

  const handleExportPipeline = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    if (currentPipeline.length === 0) {
      showToast("No pipeline to export", 'warning');
      return;
    }

    try {
      const pipelineData = {
        version: "0.1.0",
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
        filters: [{ name: "Pipeline Files", extensions: ["xan"] }],
        defaultPath: `${getCurrentTab().name}.xan`,
      });

      if (filePath) {
        const encoder = new TextEncoder();
        await writeFile(filePath, encoder.encode(jsonContent));
        showToast(`Pipeline exported to: ${filePath}`, 'success');
      }
    } catch (error) {
      showToast(`Failed to export pipeline: ${error}`, 'error');
    }
  }, [getCurrentPipeline, getCurrentTab, defaultDelimiter, showToast, formatDateTime]);

  const handleImportPipeline = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Pipeline Files", extensions: ["xan"] }],
    });

    if (!file) return;

    try {
      const fileContent = await readFile(file);
      const jsonContent = new TextDecoder().decode(fileContent);
      const pipelineData = JSON.parse(jsonContent);

      if (!pipelineData.pipeline || !Array.isArray(pipelineData.pipeline)) {
        showToast("Invalid pipeline file format", 'error');
        return;
      }

      const importedPipeline: PipelineStep[] = pipelineData.pipeline.map((stepData: { id?: string; commandId: string; parameters?: Record<string, any>; alias?: string; position?: { x: number; y: number } }) => {
        const command = xanCommands.find((cmd) => cmd.id === stepData.commandId);
        if (!command) {
          showToast(`Unknown command: ${stepData.commandId}, skipping`, 'warning');
          return null;
        }
        return {
          id: stepData.id || `${command.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          command,
          parameters: stepData.parameters || {},
          alias: stepData.alias,
          position: stepData.position,
        };
      }).filter((step: PipelineStep | null): step is PipelineStep => step !== null);

      if (importedPipeline.length === 0) {
        showToast("No valid commands found in pipeline file", 'error');
        return;
      }

      updateTabPipeline(importedPipeline, undefined, pipelineData.edges, pipelineData.inputPosition);
      if (pipelineData.inputFile) {
        loadCsvData(selectedTabId, pipelineData.inputFile);
      }
      if (pipelineData.defaultDelimiter) {
        // Note: We can't update defaultDelimiter from here, it's a prop
      }

      showToast(`Imported pipeline with ${importedPipeline.length} steps`, 'success');
    } catch (error) {
      showToast(`Failed to import pipeline: ${error}`, 'error');
    }
  }, [showToast, updateTabPipeline, loadCsvData, selectedTabId]);

  const buildExecutionBranches = useCallback((steps: PipelineStep[], edges: PipelineEdge[]): PipelineStep[][] => {
    if (edges.length === 0) {
      return steps.map(step => [step]);
    }

    const stepMap = new Map<string, PipelineStep>();
    steps.forEach(step => stepMap.set(step.id, step));

    const executableStepIds = new Set(steps.map(step => step.id));
    const adjacency = new Map<string, string[]>();
    edges.forEach(edge => {
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

    const targetIds = new Set(edges.map(e => e.target));
    const startNodes = steps.filter(step => !targetIds.has(step.id)).map(step => step.id);

    if (startNodes.length === 0) {
      const tableEdges = adjacency.get("table-node") || [];
      if (tableEdges.length > 0) {
        tableEdges.forEach(startId => {
          dfs(startId, []);
        });
        return branches;
      }
      return steps.map(step => [step]);
    }

    startNodes.forEach(startId => {
      dfs(startId, []);
    });

    return branches;
  }, []);

  const handleExecute = useCallback(async () => {
    const currentPipeline = getCurrentPipeline();
    const currentTab = getCurrentTab();
    const edges = currentTab.edges || [];
    const inputFile = currentTab.inputFile || "";

    if (currentPipeline.length === 0) {
      showToast("No steps in pipeline to execute", 'warning');
      return;
    }

    if (!inputFile) {
      showToast("No input file selected", 'warning');
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
      const outputStep = currentPipeline.find(step => step.command.id === "output");
      const outputPath = outputStep?.parameters.path || "";

      const executableSteps = currentPipeline.filter(step => step.command.id !== "output");

      if (executableSteps.length === 0) {
        showToast("No executable steps found in pipeline - add other commands before output", 'warning');
        setIsExecuting(false);
        return;
      }

      const branches = buildExecutionBranches(executableSteps, edges);

      const allResults: { success: boolean; output?: string; error?: string; branchSteps: string[] }[] = [];

      let pipelineFailed = false;
      for (let i = 0; i < branches.length; i++) {
        const branchSteps = branches[i];
        if (branchSteps.length === 0) continue;

        const branchStepNames = branchSteps.map(s => s.alias || s.command.name);
        const branchName = branchStepNames.join(" -> ");
        addLog("info", `Executing branch ${i + 1}/${branches.length}: ${branchName}`);

        setBranchProgress({ current: i + 1, total: branches.length, name: branchName, status: "executing" });

        const commands = branchSteps.map((step, index) => {
          let params = step.command.parameters.map((param) => ({
            name: param.name,
            value: String(step.parameters[param.name] || param.default || ""),
            isPositional: param.isPositional,
          }));

          if (step.command.name === "run") {
            const mode = step.parameters.mode || "pipeline";
            params = params.filter(param => {
              if (mode === "script" && param.name === "pipeline") return false;
              if (mode === "pipeline" && param.name === "file") return false;
              return true;
            });
          }

          if (index === branchSteps.length - 1 && outputPath && !pipelineFailed) {
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

        const result = await invoke<any>("execute_xan_pipeline", {
          commands,
          inputFile,
          defaultDelimiter,
        });

        allResults.push({
          success: result.success,
          output: result.output,
          error: result.error,
          branchSteps: branchStepNames,
        });

        setBranchProgress({ current: i + 1, total: branches.length, name: branchName, status: result.success ? "completed" : "error" });

        if (result.success) {
          if (result.output) {
            const output = (result.output as string).trimStart().trimEnd();
            addLog("success", `${output}`);
          }
        } else {
          addLog("error", `${result.error}`);
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
        pipeline: currentPipeline,
        inputFile,
        defaultDelimiter,
        executedAt: formatDateTime(new Date()),
        success: allResults.every(r => r.success),
        output: allResults.map(r => r.output).filter(Boolean).join("\n---\n"),
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

      const successCount = allResults.filter(r => r.success).length;
      if (successCount === branches.length) {
        addLog("success", `All ${branches.length} branch(es) executed successfully`);
      }
    } catch (error) {
      showToast(`${error}`, 'error');
    } finally {
      setIsExecuting(false);
      progressHideTimerRef.current = setTimeout(() => {
        setShowProgressBar(false);
        setBranchProgress(null);
      }, 5000);
    }
  }, [getCurrentPipeline, getCurrentTab, defaultDelimiter, historicalPipelines, showToast, addLog, setIsExecuting, setShowLogPanel, setShowProgressBar, setBranchProgress, progressHideTimerRef, buildExecutionBranches, updateHistoricalPipelines, formatDateTime]);

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
