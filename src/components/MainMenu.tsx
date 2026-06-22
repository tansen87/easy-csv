import { File, Settings, Undo2, Redo2, Play, FolderOpen, FileText, Save, Upload, Download } from "lucide-react";
import { PipelineStep } from "@/types/xan";

interface MainMenuProps {
  activeMenu: "file" | "settings" | null;
  setActiveMenu: (menu: "file" | "settings" | null) => void;
  isMenuActivated: boolean;
  setIsMenuActivated: (activated: boolean) => void;
  undoStack: Array<{ pipeline: PipelineStep[] }>;
  redoStack: Array<{ pipeline: PipelineStep[] }>;
  onUndo: () => void;
  onRedo: () => void;
  onExecute: () => void;
  onOpenFile: () => void;
  onOpenNewTabWithFile: () => void;
  onSavePipeline: () => void;
  onImportPipeline: () => void;
  onExportPipeline: () => void;
  onOpenSettings: () => void;
  isExecuting: boolean;
  currentPipelineLength: number;
}

export function MainMenu({
  activeMenu,
  setActiveMenu,
  isMenuActivated,
  setIsMenuActivated,
  undoStack,
  redoStack,
  onUndo,
  onRedo,
  onExecute,
  onOpenFile,
  onOpenNewTabWithFile,
  onSavePipeline,
  onImportPipeline,
  onExportPipeline,
  onOpenSettings,
  isExecuting,
  currentPipelineLength,
}: MainMenuProps) {
  return (
    <div className="relative">
      <div className="flex bg-muted/50 rounded-lg p-0.5 border border-border/50">
        <div className="relative">
          <button
            onClick={() => {
              if (!isMenuActivated) {
                setIsMenuActivated(true);
                setActiveMenu("file");
              } else {
                if (activeMenu === "file") {
                  setActiveMenu(null);
                } else {
                  setActiveMenu("file");
                }
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeMenu === "file"
              ? "bg-accent text-foreground"
              : "text-primary hover:text-primary hover:bg-primary/10"
              }`}
          >
            <File className="h-3.5 w-3.5" />
            File
          </button>
          {activeMenu === "file" && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[160px]">
              <button
                onClick={() => {
                  onOpenFile();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open
              </button>
              <button
                onClick={() => {
                  onOpenNewTabWithFile();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Open New Tab
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onSavePipeline();
                  setActiveMenu(null);
                }}
                disabled={currentPipelineLength === 0}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors ${currentPipelineLength === 0
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                <Save className="h-3.5 w-3.5" />
                Save Pipeline
              </button>
              <button
                onClick={() => {
                  onImportPipeline();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                Import Workflow
              </button>
              <button
                onClick={() => {
                  onExportPipeline();
                  setActiveMenu(null);
                }}
                disabled={currentPipelineLength === 0}
                className={`flex items-center gap-2 w-full px-3 py-2 text-xs font-medium transition-colors ${currentPipelineLength === 0
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                <Download className="h-3.5 w-3.5" />
                Export Workflow
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>

        {/* Undo/Redo buttons */}
        <div className="flex items-center">
          <button
            onClick={onUndo}
            disabled={undoStack.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${undoStack.length === 0
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-primary hover:bg-primary/10"
              }`}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Undo
          </button>
          <button
            onClick={onRedo}
            disabled={redoStack.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${redoStack.length === 0
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-primary hover:bg-primary/10"
              }`}
          >
            <Redo2 className="h-3.5 w-3.5" />
            Redo
          </button>
        </div>

        <button
          onClick={onExecute}
          disabled={currentPipelineLength === 0 || isExecuting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isExecuting
            ? "text-primary opacity-70"
            : currentPipelineLength === 0
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-primary hover:text-primary hover:bg-primary/10"
            }`}
        >
          {isExecuting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Executing...
            </>
          ) : (
            <>
              <Play className="h-3 w-3 mr-1.5" />
              Execute
              {currentPipelineLength > 0 && (
                <span className="ml-0.5">({currentPipelineLength})</span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
