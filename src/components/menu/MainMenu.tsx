import React from "react";
import {
  CloudDownload,
  RefreshCw,
  Settings,
  Command,
  ListTree,
  ScrollText,
  Bot,
  PanelLeft,
} from "lucide-react";

import { PipelineStep } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  onUseOrSaveTemplate: () => void;
  onHelp: () => void;
  onCheckUpdate: () => void;
  onShowSettings: () => void;
  onOpenPalette: () => void;
  onOpenCsvDiff: () => void;
  onOpenCsvEncoding: () => void;
  isExecuting: boolean;
  isCheckingUpdate: boolean;
  hasUpdate: boolean;
  showLogErrorBadge: boolean;
  currentPipelineLength: number;
  showCommandPanel: boolean;
  onToggleCommandPanel: () => void;
  showLogPanel: boolean;
  onToggleLogPanel: () => void;
  showDataProfile: boolean;
  onToggleDataProfile: () => void;
  hasInputFile: boolean;
  showVersionPanel: boolean;
  onToggleVersionPanel: () => void;
  showLineagePanel: boolean;
  onToggleLineagePanel: () => void;
  showAIPanel: boolean;
  onToggleAIPanel: () => void;
  showVariablePanel: boolean;
  onToggleVariablePanel: () => void;
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
  onUseOrSaveTemplate,
  onHelp,
  onCheckUpdate,
  onShowSettings,
  onOpenPalette,
  onOpenCsvDiff,
  onOpenCsvEncoding,
  isExecuting,
  isCheckingUpdate,
  hasUpdate,
  showLogErrorBadge,
  currentPipelineLength,
  showCommandPanel,
  onToggleCommandPanel,
  showLogPanel,
  onToggleLogPanel,
  showDataProfile,
  onToggleDataProfile,
  hasInputFile,
  showVersionPanel,
  onToggleVersionPanel,
  showLineagePanel,
  onToggleLineagePanel,
  showAIPanel,
  onToggleAIPanel,
  showVariablePanel,
  onToggleVariablePanel,
}: MainMenuProps) {
  const { t } = useLanguage();

  const [openMenu, setOpenMenu] = React.useState(false);
  const rightRef = React.useRef<HTMLDivElement>(null);

  const closeDropdowns = React.useCallback(() => setOpenMenu(false), []);

  React.useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdowns();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (rightRef.current && !rightRef.current.contains(e.target as Node)) {
        closeDropdowns();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openMenu, closeDropdowns]);

  const anyCollapsedPanelOpen =
    showDataProfile ||
    showVersionPanel ||
    showLineagePanel ||
    showVariablePanel;

  const commandButtonClass = (active: boolean) =>
    cn(
      "relative flex items-center justify-center h-7 w-7 rounded-md text-primary transition-colors",
      active ? "bg-accent text-foreground" : "hover:bg-accent/60",
    );

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
            {t.file}
          </button>
          {activeMenu === "file" && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-max">
              <button
                onClick={() => {
                  onOpenFile();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex-1 text-left">{t.open}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+O
                </kbd>
              </button>
              <button
                onClick={() => {
                  onOpenNewTabWithFile();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex-1 text-left">{t.openNewTab}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+N
                </kbd>
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
                <span className="flex-1 text-left">{t.savePipeline}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+S
                </kbd>
              </button>
              <button
                onClick={() => {
                  onImportPipeline();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex-1 text-left">{t.importWorkflow}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+I
                </kbd>
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
                <span className="flex-1 text-left">{t.exportWorkflow}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+E
                </kbd>
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => {
                  onUseOrSaveTemplate();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex-1 text-left">{t.paletteTemplates}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+T
                </kbd>
              </button>
              <button
                onClick={() => {
                  onOpenCsvDiff();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.csvDiff}
              </button>
              <button
                onClick={() => {
                  onOpenCsvEncoding();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.csvEncoding}
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
            <>{t.execute}</>
          )}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side buttons */}
        <div ref={rightRef} className="flex items-center rounded-md gap-0.5">
          {/* ── Group 1: Command entry ─────────────────────────────── */}
          <Tooltip content={t.commandPalette}>
            <button
              onClick={onOpenPalette}
              className="relative flex items-center justify-center h-7 w-7 rounded-md text-primary hover:bg-accent/60 transition-colors"
            >
              <Command className="h-4 w-4" />
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-1.5" />

          {/* ── Group 2: High-frequency panel toggles ──────────────── */}
          <Tooltip content={t.commandPanel}>
            <button
              onClick={onToggleCommandPanel}
              className={commandButtonClass(showCommandPanel)}
            >
              <ListTree className="h-4 w-4" />
              {showCommandPanel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-current" />
              )}
            </button>
          </Tooltip>
          <Tooltip content={t.logPanel}>
            <button
              onClick={onToggleLogPanel}
              className={commandButtonClass(showLogPanel)}
            >
              <ScrollText className="h-4 w-4" />
              {showLogPanel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-current" />
              )}
              {showLogErrorBadge && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500" />
              )}
            </button>
          </Tooltip>
          <Tooltip content={t.ai}>
            <button
              onClick={onToggleAIPanel}
              className={commandButtonClass(showAIPanel)}
            >
              <Bot className="h-4 w-4" />
              {showAIPanel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-current" />
              )}
            </button>
          </Tooltip>

          {/* ── Group 3: More panels dropdown ───────────────────────── */}
          <div className="relative">
            <Tooltip content={t.morePanels}>
              <button
                onClick={() => setOpenMenu(!openMenu)}
                aria-haspopup="menu"
                aria-expanded={openMenu}
                className={cn(
                  "relative flex items-center justify-center h-7 w-7 gap-0.5 rounded-md transition-colors",
                  anyCollapsedPanelOpen || openMenu
                    ? "bg-accent text-foreground"
                    : "text-primary hover:bg-accent/60",
                )}
              >
                <PanelLeft className="h-4 w-4" />
                {anyCollapsedPanelOpen && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-current" />
                )}
              </button>
            </Tooltip>
            {openMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 bg-card border border-border rounded-lg shadow-lg z-50 w-max p-1"
              >
                <div
                  role="menuitemcheckbox"
                  aria-checked={showDataProfile}
                  aria-disabled={!hasInputFile}
                >
                  <button
                    onClick={() => {
                      if (!hasInputFile) return;
                      onToggleDataProfile();
                      closeDropdowns();
                    }}
                    disabled={!hasInputFile}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors",
                      !hasInputFile
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : showDataProfile
                          ? "text-foreground hover:bg-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                  >
                    <span className="whitespace-nowrap">{t.dataProfile}</span>
                  </button>
                </div>
                <button
                  role="menuitemcheckbox"
                  aria-checked={showVersionPanel}
                  onClick={() => {
                    onToggleVersionPanel();
                    closeDropdowns();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    showVersionPanel
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <span className="whitespace-nowrap">{t.versionHistory}</span>
                </button>
                <button
                  role="menuitemcheckbox"
                  aria-checked={showLineagePanel}
                  onClick={() => {
                    onToggleLineagePanel();
                    closeDropdowns();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    showLineagePanel
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <span className="whitespace-nowrap">{t.dataLineage}</span>
                </button>
                <button
                  role="menuitemcheckbox"
                  aria-checked={showVariablePanel}
                  onClick={() => {
                    onToggleVariablePanel();
                    closeDropdowns();
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium rounded-md transition-colors",
                    showVariablePanel
                      ? "text-foreground hover:bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  <span className="whitespace-nowrap">{t.variables}</span>
                </button>
                <div className="border-t border-border my-1" />
                <button
                  role="menuitem"
                  onClick={() => {
                    onHelp();
                    closeDropdowns();
                  }}
                  aria-label={t.helpCenter}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                >
                  <span className="whitespace-nowrap">{t.helpCenter}</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Group 4: Global actions ─────────────────────────────── */}
          <Tooltip content={t.checkUpdate}>
            <button
              onClick={onCheckUpdate}
              disabled={isCheckingUpdate}
              className="relative flex items-center justify-center h-7 w-7 rounded-md text-primary hover:bg-accent/60 transition-colors disabled:opacity-70"
            >
              {isCheckingUpdate ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CloudDownload className="h-4 w-4" />
              )}
              {hasUpdate && (
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500" />
              )}
            </button>
          </Tooltip>

          <div className="w-px h-4 bg-border mx-1.5" />

          <Tooltip content={t.settings}>
            <button
              onClick={onShowSettings}
              className="relative flex items-center justify-center h-7 w-7 rounded-md text-primary hover:bg-accent/60 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
