import { useState, useEffect } from "react";
import { CommandList } from "@/components/CommandList";
import { PipelineBuilder } from "@/components/PipelineBuilder";
import { ParameterPanel } from "@/components/ParameterPanel";
import { LogPanel } from "@/components/LogPanel";
import { xanCommands } from "@/data/commands";
import { PipelineStep, LogEntry, XanCommand, Workspace } from "@/types/xan";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/components/ui/button";

import { Settings, X, FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";

function App() {
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isXanInstalled, setIsXanInstalled] = useState<boolean | null>(null);
  const [xanVersion, setXanVersion] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [defaultDelimiter, setDefaultDelimiter] = useState<string>(',');
  const [xanPath, setXanPath] = useState<string>('');
  const [noQuoting, setNoQuoting] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  useEffect(() => {
    checkXanInstallation();
    loadXanPath();
    loadDefaultDelimiter();
    loadNoQuoting();
  }, []);

  const loadXanPath = async () => {
    try {
      const savedPath = await invoke<string | null>("get_xan_path");
      if (savedPath) {
        setXanPath(savedPath);
      }
    } catch (error) {
      console.error("Failed to load xan path:", error);
    }
  };

  const loadDefaultDelimiter = async () => {
    try {
      const savedDelimiter = await invoke<string | null>("get_default_delimiter");
      if (savedDelimiter) {
        setDefaultDelimiter(savedDelimiter);
      }
    } catch (error) {
      console.error("Failed to load default delimiter:", error);
    }
  };

  const loadNoQuoting = async () => {
    try {
      const savedNoQuoting = await invoke<boolean | null>("get_no_quoting");
      if (savedNoQuoting !== null) {
        setNoQuoting(savedNoQuoting);
      }
    } catch (error) {
      console.error("Failed to load no quoting setting:", error);
    }
  };

  const checkXanInstallation = async () => {
    try {
      const installed = await invoke<boolean>("check_xan_installed");
      setIsXanInstalled(installed);

      if (installed) {
        const version = await invoke<string>("get_xan_version");
        setXanVersion(version);
      }
    } catch (error) {
      setIsXanInstalled(false);
      addLog("error", `Failed to check xan installation: ${error}`);
    }
  };

  const addLog = (type: LogEntry["type"], message: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      type,
      message,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleCommandClick = (command: XanCommand) => {
    const newStep: PipelineStep = {
      id: `${command.id}-${Date.now()}`,
      command,
      parameters: {},
    };

    command.parameters.forEach((param) => {
      if (param.default !== undefined) {
        newStep.parameters[param.name] = param.default;
      }
    });

    setPipeline((prev) => [...prev, newStep]);
    setSelectedStep(newStep);
  };

  const handleStepClick = (step: PipelineStep) => {
    setSelectedStep(step);
  };

  const handleStepRemove = (stepId: string) => {
    setPipeline((prev) => prev.filter((s) => s.id !== stepId));
    if (selectedStep?.id === stepId) {
      setSelectedStep(null);
    }
  };

  const handleStepUpdate = (stepId: string, parameters: Record<string, any>) => {
    setPipeline((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, parameters } : step
      )
    );
    if (selectedStep?.id === stepId) {
      setSelectedStep({ ...selectedStep, parameters });
    }
  };

  const handleClearPipeline = () => {
    setPipeline([]);
    setSelectedStep(null);
    addLog("info", "Pipeline cleared");
  };

  const handleExecute = async () => {
    if (pipeline.length === 0) {
      addLog("warning", "No steps in pipeline to execute");
      return;
    }

    if (!inputFile) {
      addLog("warning", "No input file selected");
      return;
    }

    setIsExecuting(true);
    addLog("info", "Starting pipeline execution...");

    try {
      const commands = pipeline.map((step) => ({
        name: step.command.name,
        parameters: step.command.parameters.map((param) => ({
          name: param.name,
          value: String(step.parameters[param.name] || param.default || ''),
          isPositional: param.isPositional,
        })),
      }));

      const result = await invoke<any>("execute_xan_pipeline", { commands, inputFile, defaultDelimiter });

      if (result.success) {
        if (result.output) {
          addLog("info", `${result.output}`);
        }
        addLog("success", "Pipeline executed successfully");
      } else {
        addLog("error", `${result.error}`);
      }
    } catch (error) {
      addLog("error", `${error}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputFile(e.target.value);
    if (e.target.value) {
      addLog("info", `Selected input file: ${e.target.value.split('\\').pop()}`);
    }
  };

  const handleOpenFile = async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: "CSV Files", extensions: ["csv"] },
        { name: "JSON Files", extensions: ["json", "jsonl"] },
        { name: "Excel Files", extensions: ["xlsx"] },
        { name: "Parquet Files", extensions: ["parquet"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (file) {
      setInputFile(file);
      addLog("info", `Selected input file: ${file.split('\\').pop()}`);
    }
  };

  const handleExportWorkspace = async () => {
    try {
      const workspace: Workspace = {
        version: "1.0.0",
        name: `xan-workspace_${new Date().toISOString().split('T')[0]}`,
        description: `Exported on ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pipeline: pipeline,
        inputFile: inputFile,
        defaultDelimiter: defaultDelimiter,
        noQuoting: noQuoting,
      };

      const filePath = await save({
        filters: [
          { name: "JSON Files", extensions: ["json"] },
        ],
        defaultPath: `${workspace.name}.json`,
      });

      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(workspace, null, 2));
        addLog("success", `Workspace exported to ${filePath.split('\\').pop()}`);
      }
    } catch (error) {
      addLog("error", `Failed to export workspace: ${error}`);
    }
  };

  const handleImportWorkspace = async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
        ],
      });

      if (filePath) {
        const content = await readTextFile(filePath);
        const workspace: Workspace = JSON.parse(content);

        if (workspace.version && workspace.pipeline && workspace.inputFile !== undefined) {
          setPipeline(workspace.pipeline);
          setInputFile(workspace.inputFile);
          setDefaultDelimiter(workspace.defaultDelimiter || ',');
          setNoQuoting(workspace.noQuoting || false);
          setSelectedStep(null);
          addLog("success", `Workspace imported: ${workspace.name}`);
        } else {
          addLog("error", "Invalid workspace file format");
        }
      }
    } catch (error) {
      addLog("error", `Failed to import workspace: ${error}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-muted/20">
      <header className="h-16 border-b bg-card/80 backdrop-blur-sm shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Xan GUI
              </h1>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-2xl mx-8">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1.5 border border-border/50">
            <input
              type="text"
              value={inputFile || ''}
              onChange={handleFileInput}
              placeholder="Select or enter input file path..."
              className="flex-1 bg-transparent text-sm px-3 py-1.5 outline-none placeholder:text-muted-foreground/60"
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleOpenFile}
              className="h-7 px-3 text-xs font-medium hover:bg-accent"
            >
              Browse
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isXanInstalled === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Checking...</span>
            </div>
          ) : isXanInstalled ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-600 rounded-full text-xs font-medium border border-green-500/20">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>xan {xanVersion && `v${xanVersion.trim()}`}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-600 rounded-full text-xs font-medium border border-red-500/20">
              <XCircle className="h-3.5 w-3.5" />
              <span>xan not found</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSettings(true)}
            className="h-9 w-9 rounded-lg hover:bg-accent transition-colors"
          >
            <Settings className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[20%] flex-shrink-0">
          <CommandList
            commands={xanCommands}
            onCommandClick={handleCommandClick}
            selectedCommandId={selectedStep?.command.id}
          />
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <div className="w-[60%] flex-shrink-0">
              <PipelineBuilder
                steps={pipeline}
                onStepsChange={setPipeline}
                onStepClick={handleStepClick}
                onStepRemove={handleStepRemove}
                selectedStepId={selectedStep?.id}
                onExecute={handleExecute}
                onClear={handleClearPipeline}
                isExecuting={isExecuting}
                onExportWorkspace={handleExportWorkspace}
                onImportWorkspace={handleImportWorkspace}
              />
            </div>

            <aside className="flex-1">
              <ParameterPanel
                step={selectedStep}
                onStepUpdate={handleStepUpdate}
                onClose={() => setSelectedStep(null)}
              />
            </aside>
          </div>

          <LogPanel logs={logs} onClear={handleClearLogs} />
        </main>
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Settings</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Xan Executable Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={xanPath}
                    onChange={(e) => setXanPath(e.target.value)}
                    placeholder="Auto-detect if not specified"
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const file = await open({
                        multiple: false,
                        filters: [{ name: "Executable Files", extensions: ["exe"] }],
                      });
                      if (file) {
                        setXanPath(file);
                      }
                    }}
                  >
                    Browse
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Specify the path to xan.exe. Leave empty to auto-detect.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Default Delimiter</label>
                <select
                  value={defaultDelimiter}
                  onChange={(e) => setDefaultDelimiter(e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={"\t"}>Tab (\t)</option>
                  <option value="|">Pipe (|)</option>
                  <option value="^">Caret (^)</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  This delimiter will be used for all commands that require it
                </p>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noQuoting}
                    onChange={(e) => setNoQuoting(e.target.checked)}
                    className="w-4 h-4 rounded border-input"
                  />
                  <span className="text-sm font-medium">Disable Quoting</span>
                </label>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Disable quoting completely for input command
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      if (xanPath) {
                        await invoke("set_xan_path", { path: xanPath });
                        await checkXanInstallation();
                      }
                      await invoke("set_default_delimiter", { delimiter: defaultDelimiter });
                      await invoke("set_no_quoting", { noQuoting });
                      addLog("success", "Settings saved successfully");
                      setShowSettings(false);
                    } catch (error) {
                      addLog("error", `Failed to save settings: ${error}`);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
