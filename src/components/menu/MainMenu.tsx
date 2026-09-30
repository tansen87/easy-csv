import React from "react";
import { ListTree, ScrollText, Bot } from "lucide-react";

import { PipelineStep } from "@/types/xan";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

interface MainMenuProps {
  activeMenu: "file" | "edit" | "view" | "help" | null;
  setActiveMenu: (menu: "file" | "edit" | "view" | "help" | null) => void;
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
  onOpenSearch: () => void;
  onOpenCsvDiff: () => void;
  onOpenCsvEncoding: () => void;
  onOpenSeparateCsv: () => void;
  onOpenSplitLines: () => void;
  onOpenMergeExcel: () => void;
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
  /**
   * Briefly highlight the command-panel entry while the first-run guide is up
   * (design 027 §4.2 item 3), so the card's button and the real entry point
   * become associated. Visual only — no click behaviour changes.
   */
  highlightCommandEntry?: boolean;
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
  onOpenSearch,
  onOpenCsvDiff,
  onOpenCsvEncoding,
  onOpenSeparateCsv,
  onOpenSplitLines,
  onOpenMergeExcel,
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
  highlightCommandEntry = false,
}: MainMenuProps) {
  const { t } = useLanguage();

  // Menu-bar behaviour: a click opens a menu; while any menu is open, hovering
  // another menu button switches to it (design: File / Edit / View / Help).
  const toggleMenu = (menu: "file" | "edit" | "view" | "help") => {
    if (!isMenuActivated) {
      setIsMenuActivated(true);
      setActiveMenu(menu);
    } else {
      setActiveMenu(activeMenu === menu ? null : menu);
    }
  };

  const hoverMenu = (menu: "file" | "edit" | "view" | "help") => {
    if (activeMenu && activeMenu !== menu) setActiveMenu(menu);
  };

  React.useEffect(() => {
    if (!activeMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeMenu, setActiveMenu]);

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
            onClick={() => toggleMenu("file")}
            onMouseEnter={() => hoverMenu("file")}
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
              <button
                onClick={() => {
                  onOpenSeparateCsv();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.separateGoodBad}
              </button>
              <button
                onClick={() => {
                  onOpenSplitLines();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.splitLines}
              </button>
              <button
                onClick={() => {
                  onOpenMergeExcel();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {t.mergeExcel}
              </button>
            </div>
          )}
        </div>

        {/* Edit menu — undo/redo */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("edit")}
            onMouseEnter={() => hoverMenu("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeMenu === "edit"
                ? "bg-accent text-foreground"
                : "text-primary hover:text-primary hover:bg-primary/10"
            }`}
          >
            {t.edit}
          </button>
          {activeMenu === "edit" && (
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-max">
              <button
                onClick={() => {
                  onUndo();
                  setActiveMenu(null);
                }}
                disabled={undoStack.length === 0}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  undoStack.length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex-1 text-left">{t.undo}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+Z
                </kbd>
              </button>
              <button
                onClick={() => {
                  onRedo();
                  setActiveMenu(null);
                }}
                disabled={redoStack.length === 0}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  redoStack.length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <span className="flex-1 text-left">{t.redo}</span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+Y
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* View menu — renamed from "More panels"; command palette sits first */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("view")}
            onMouseEnter={() => hoverMenu("view")}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "view"}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              anyCollapsedPanelOpen || activeMenu === "view"
                ? "bg-accent text-foreground"
                : "text-primary hover:text-primary hover:bg-primary/10",
            )}
          >
            {t.view}
          </button>
          {activeMenu === "view" && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-2 bg-card border border-border rounded-lg shadow-lg z-50 w-max p-1"
            >
              <button
                role="menuitem"
                onClick={() => {
                  onOpenPalette();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.commandPalette}
                </span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+K
                </kbd>
              </button>
              <div className="border-t border-border my-1" />
              <div
                role="menuitemcheckbox"
                aria-checked={showDataProfile}
                aria-disabled={!hasInputFile}
              >
                <button
                  onClick={() => {
                    if (!hasInputFile) return;
                    onToggleDataProfile();
                    setActiveMenu(null);
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
                  setActiveMenu(null);
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
                  setActiveMenu(null);
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
                  setActiveMenu(null);
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
                  onOpenSearch();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.search}
                </span>
                <kbd className="text-[10px] text-muted-foreground/60 border border-border rounded px-1 leading-4">
                  Ctrl+F
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* Help menu — help dialog + check update. While a check is running the
            entry is disabled (no icon); the "update found" dot inherited from the
            former standalone button lives on this button's top-right. */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("help")}
            onMouseEnter={() => hoverMenu("help")}
            disabled={isCheckingUpdate}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "help"}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              isCheckingUpdate
                ? "text-muted-foreground/40 cursor-not-allowed"
                : activeMenu === "help"
                  ? "bg-accent text-foreground"
                  : "text-primary hover:text-primary hover:bg-primary/10",
            )}
          >
            {t.help}
            {hasUpdate && !isCheckingUpdate && (
              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-green-500" />
            )}
          </button>
          {activeMenu === "help" && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-max"
            >
              <button
                role="menuitem"
                onClick={() => {
                  onHelp();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.helpCenter}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onCheckUpdate();
                  setActiveMenu(null);
                }}
                disabled={isCheckingUpdate}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors",
                  isCheckingUpdate
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.checkUpdate}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Settings — text entry placed to the left of Execute */}
        <button
          onClick={onShowSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-colors"
        >
          {t.settings}
        </button>

        {/* Design 027 §4.2 item 3: this button used to be a silent dead end —
            greyed out with no explanation. `pointer-events-none` lets the
            tooltip wrapper receive hover, which a disabled button would
            otherwise swallow. */}
        <Tooltip
          content={
            currentPipelineLength === 0
              ? `${t.onboardingExecuteNeedsStep} · ${t.onboardingExecuteHint}`
              : `${t.execute} (Ctrl+R)`
          }
        >
          <button
            onClick={onExecute}
            disabled={currentPipelineLength === 0 || isExecuting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              isExecuting
                ? "text-primary opacity-70"
                : currentPipelineLength === 0
                  ? "text-muted-foreground/40 cursor-not-allowed pointer-events-none"
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
        </Tooltip>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side buttons */}
        <div className="flex items-center rounded-md gap-0.5">
          {/* High-frequency panel toggles */}
          <Tooltip content={t.commandPanel}>
            <button
              onClick={onToggleCommandPanel}
              className={cn(
                commandButtonClass(showCommandPanel),
                highlightCommandEntry &&
                  !showCommandPanel &&
                  "bg-blue-100 text-blue-700 ring-2 ring-blue-400/70 dark:bg-blue-900/60 dark:text-blue-300",
              )}
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
        </div>
      </div>
    </div>
  );
});
