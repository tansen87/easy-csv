import { useState, useEffect } from "react";
import { CommandList } from "@/components/CommandList";
import { PipelineBuilder } from "@/components/PipelineBuilder";
import { ParameterPanel } from "@/components/ParameterPanel";
import { LogPanel } from "@/components/LogPanel";
import { xanCommands } from "@/data/commands";
import { PipelineStep, LogEntry, XanCommand } from "@/types/xan";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";

import { Settings, PlayCircle, X } from "lucide-react";

function App() {
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<PipelineStep | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isXanInstalled, setIsXanInstalled] = useState<boolean | null>(null);
  const [xanVersion, setXanVersion] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [defaultDelimiter, setDefaultDelimiter] = useState<string>(',');

  useEffect(() => {
    checkXanInstallation();
  }, []);

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

    addLog("info", "Starting pipeline execution...");
    addLog("info", `Delimiter: "${defaultDelimiter}"`);

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
        addLog("success", "Pipeline executed successfully");
        if (result.output) {
          addLog("info", `${result.output}`);
        }
      } else {
        addLog("error", `${result.error}`);
      }
    } catch (error) {
      addLog("error", `${error}`);
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      addLog("info", `Dropped file: ${file.name}`);

      // In Tauri, the file object should have a path property
      if ('path' in file) {
        const filePath = (file as any).path;
        addLog("info", `File path: ${filePath}`);
        setInputFile(filePath);
        addLog("info", `Selected input file: ${file.name}`);
      } else {
        // Log all properties of the file object for debugging
        addLog("error", "File object does not have path property");
        addLog("error", `File properties: ${Object.keys(file).join(', ')}`);

        // Try to get path from dataTransfer
        if (e.dataTransfer.getData) {
          const data = e.dataTransfer.getData('text');
          addLog("info", `DataTransfer data: ${data}`);
        }
      }
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card">
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={inputFile || ''}
            onChange={handleFileInput}
            placeholder="Enter input file path"
            className="text-sm border border-input rounded-md px-3 py-2 w-full"
          />
          <Button variant="outline" size="sm" onClick={handleOpenFile}>
            Browse
          </Button>
        </div>
        <div className="flex items-center gap-4 ml-4">
          {isXanInstalled === null ? (
            <span className="text-sm text-muted-foreground">
              Checking xan installation...
            </span>
          ) : isXanInstalled ? (
            <span className="text-sm text-green-600">
              xan installed {xanVersion && `(${xanVersion.trim()})`}
            </span>
          ) : (
            <span className="text-sm text-red-600">
              xan not found - please install xan
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)}>
            <Settings className="h-5 w-5" />
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setShowSettings(false)}>
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
