import React from "react";
import {
  File,
  Undo2,
  Redo2,
  Play,
  FolderOpen,
  FileText,
  Save,
  Upload,
  Download,
  CloudDownload,
  RefreshCw,
  Settings,
  MessageCircleQuestionMark,
  CommandIcon,
  BarChart3,
} from "lucide-react";
import { PipelineStep } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/tooltip";

interface MainMenuProps {
  activeMenu: "file" | null;
  setActiveMenu: (menu: "file" | null) => void;
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
  onHelp: () => void;
  onCheckUpdate: () => void;
  onShowSettings: () => void;
  isExecuting: boolean;
  isCheckingUpdate: boolean;
  currentPipelineLength: number;
  showCommandPanel: boolean;
  onToggleCommandPanel: () => void;
  showLogPanel: boolean;
  onToggleLogPanel: () => void;
  showDataProfile: boolean;
  onToggleDataProfile: () => void;
  hasInputFile: boolean;
}

export const MainMenu = React.memo(function MainMenu({
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
  onHelp,
  onCheckUpdate,
  onShowSettings,
  isExecuting,
  isCheckingUpdate,
  currentPipelineLength,
  showCommandPanel,
  onToggleCommandPanel,
  showLogPanel,
  onToggleLogPanel,
  showDataProfile,
  onToggleDataProfile,
  hasInputFile,
}: MainMenuProps) {
  const { t } = useLanguage();

  return (
    <div className="relative w-full">
      <div className="flex rounded-md">
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeMenu === "file"
                ? "bg-accent text-foreground"
                : "text-primary hover:text-primary hover:bg-primary/10"
            }`}
          >
            <File className="h-3.5 w-3.5" />
            {t.file}
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
                {t.open}
              </button>
              <button
                onClick={() => {
                  onOpenNewTabWithFile();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                {t.openNewTab}
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onSavePipeline();
                  setActiveMenu(null);
                }}
                disabled={currentPipelineLength === 0}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPipelineLength === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                {t.savePipeline}
              </button>
              <button
                onClick={() => {
                  onImportPipeline();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {t.importWorkflow}
              </button>
              <button
                onClick={() => {
                  onExportPipeline();
                  setActiveMenu(null);
                }}
                disabled={currentPipelineLength === 0}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentPipelineLength === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Download className="h-3.5 w-3.5" />
                {t.exportWorkflow}
              </button>
            </div>
          )}
        </div>

        {/* Undo/Redo buttons */}
        <div className="flex items-center">
          <button
            onClick={onUndo}
            disabled={undoStack.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              undoStack.length === 0
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-primary hover:bg-primary/10"
            }`}
          >
            <Undo2 className="h-3.5 w-3.5" />
            {t.undo}
          </button>
          <button
            onClick={onRedo}
            disabled={redoStack.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              redoStack.length === 0
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-primary hover:bg-primary/10"
            }`}
          >
            <Redo2 className="h-3.5 w-3.5" />
            {t.redo}
          </button>
        </div>

        <button
          onClick={onExecute}
          disabled={currentPipelineLength === 0 || isExecuting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isExecuting
              ? "text-primary opacity-70"
              : currentPipelineLength === 0
                ? "text-muted-foreground/40 cursor-not-allowed"
                : "text-primary hover:text-primary hover:bg-primary/10"
          }`}
        >
          {isExecuting ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {t.executing}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              {t.execute}
              {currentPipelineLength > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold rounded-full bg-primary/15 text-primary/80 leading-none">
                  {currentPipelineLength}
                </span>
              )}
            </>
          )}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side buttons */}
        <div className="flex items-center rounded-md gap-1">
          {/* Panel Toggle Buttons */}
          <Tooltip content={t.commandPanel} side="bottom">
            <button
              onClick={onToggleCommandPanel}
              aria-label={t.commandPanel}
              className={`flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showCommandPanel
                  ? "text-primary bg-primary/10"
                  : "text-primary hover:bg-primary/10"
              }`}
            >
              <CommandIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content={t.logPanel} side="bottom">
            <button
              onClick={onToggleLogPanel}
              aria-label={t.logPanel}
              className={`flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                showLogPanel
                  ? "text-primary bg-primary/10"
                  : "text-primary hover:bg-primary/10"
              }`}
            >
              <FileText className="h-4 w-4" />
            </button>
          </Tooltip>
          {hasInputFile && (
            <Tooltip content={t.dataProfilePanel} side="bottom">
              <button
                onClick={onToggleDataProfile}
                aria-label={t.dataProfilePanel}
                className={`flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showDataProfile
                    ? "text-primary bg-primary/10"
                    : "text-primary hover:bg-primary/10"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            </Tooltip>
          )}
          <Tooltip content={t.checkUpdate} side="bottom">
            <button
              onClick={onCheckUpdate}
              disabled={isCheckingUpdate}
              aria-label={t.checkUpdate}
              className={`flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isCheckingUpdate
                  ? "text-primary opacity-70"
                  : "text-primary hover:bg-primary/10"
              }`}
            >
              {isCheckingUpdate ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          <Tooltip content={t.help} side="bottom">
            <button
              onClick={onHelp}
              aria-label={t.help}
              className="flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <MessageCircleQuestionMark className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip content={t.settings} side="bottom">
            <button
              onClick={onShowSettings}
              aria-label={t.settings}
              className="flex items-center px-1.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
