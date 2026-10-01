import React from "react";
import { ListTree, ScrollText, Bot, Settings } from "lucide-react";

import { PipelineStep } from "@/types/xan";
import type { RunSession } from "@/types/execution";
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
  /** Tab strip + run registry backing the execute menu (design 028 §5.6). */
  tabs: { id: string; name: string }[];
  runs: Record<string, RunSession>;
  currentTabId: string;
  /** Switch to a tab without running it (clicking a running row). */
  onSelectTab: (tabId: string) => void;
  /** Switch to a tab and start its run (clicking an idle row). */
  onRunTab: (tabId: string) => void;
  /** Cancel one tab's run (the "取消" button inside a running row). */
  onCancelTab: (tabId: string) => void;
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
   * Whether the settings dialog is open. The Settings entry sits in the
   * right-hand icon group, which highlights the panel it toggles; the dialog is
   * that group's counterpart for this entry, so it drives the same
   * `commandButtonClass(active)` state.
   */
  showSettingsDialog: boolean;
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
  tabs,
  runs,
  currentTabId,
  onSelectTab,
  onRunTab,
  onCancelTab,
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
  showSettingsDialog,
  highlightCommandEntry = false,
}: MainMenuProps) {
  const { t } = useLanguage();

  // Execute menu
  // The toolbar "Execute" opens a per-tab menu instead of running immediately:
  // the current tab is pinned on top, a thin divider separates the rest.
  const [execMenuOpen, setExecMenuOpen] = React.useState(false);
  const execMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!execMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!execMenuRef.current?.contains(e.target as Node)) {
        setExecMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExecMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [execMenuOpen]);

  const currentTab = tabs.find((tab) => tab.id === currentTabId);
  const otherTabs = tabs.filter((tab) => tab.id !== currentTabId);

  /**
   * One row of the execute menu. Rows carry no "run" button: clicking the row
   * runs that tab (switching to it first). A running row keeps only "取消" and
   * shows its branch progress; clicking it just switches over to watch.
   */
  const renderExecRow = (
    tab: { id: string; name: string } | undefined,
    isCurrent: boolean,
  ) => {
    if (!tab) return null;
    const run = runs[tab.id];
    const busy = run?.state === "running";
    const queued = run?.state === "queued";
    const pending = run?.state === "preparing";
    const finished = run?.state === "done" || run?.state === "error";
    const activate = () => {
      setExecMenuOpen(false);
      // Running/queued rows only switch over; everyone else starts their run.
      if (busy || queued) onSelectTab(tab.id);
      else onRunTab(tab.id);
    };
    return (
      <div
        key={tab.id}
        role="menuitem"
        tabIndex={0}
        data-tab-id={tab.id}
        data-state={run?.state ?? "idle"}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        className={cn(
          "group flex h-8 cursor-pointer items-center gap-2 rounded-lg px-2.5 transition-colors hover:bg-accent/60",
          isCurrent && "bg-muted/60",
        )}
      >
        <span
          className="max-w-[96px] truncate text-xs font-medium text-foreground"
          title={tab.name}
        >
          {tab.name}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {busy ? (
            <>
              <span className="font-mono text-[11px] text-muted-foreground">
                {t.branchProgress}{" "}
                {run.branch ? `${run.branch.current}/${run.branch.total}` : "-"}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelTab(tab.id);
                }}
                className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                {t.cancelShort}
              </button>
            </>
          ) : queued ? (
            <>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t.runStateQueued}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancelTab(tab.id);
                }}
                className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10"
              >
                {t.cancelShort}
              </button>
            </>
          ) : pending ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t.runStatePending}
            </span>
          ) : finished ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                run?.state === "done"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-destructive/10 text-destructive",
              )}
            >
              {run?.state === "done" ? t.runStateDone : t.runStateFailed}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {t.execute}
            </span>
          )}
        </span>
      </div>
    );
  };

  // Menu-bar behaviour: a click opens a menu; while any menu is open, hovering
  // another menu button switches to it (design: File / Edit / View / Help).
  const toggleMenu = (menu: "file" | "edit" | "view" | "help") => {
    setExecMenuOpen(false);
    if (!isMenuActivated) {
      setIsMenuActivated(true);
      setActiveMenu(menu);
    } else {
      setActiveMenu(activeMenu === menu ? null : menu);
    }
  };

  const hoverMenu = (menu: "file" | "edit" | "view" | "help") => {
    // The execute menu is a peer of File/Edit/View/Help: hovering a menu-bar
    // button while it is open hands the menu bar over to that button.
    if (execMenuOpen) {
      setExecMenuOpen(false);
      setActiveMenu(menu);
      return;
    }
    if (activeMenu && activeMenu !== menu) setActiveMenu(menu);
  };

  /** Click on "执行": open its tab menu and disarm the other menus. */
  const toggleExecuteMenu = () => {
    setActiveMenu(null);
    setIsMenuActivated(true);
    if (!isMenuActivated) {
      setExecMenuOpen(true);
      return;
    }
    setExecMenuOpen((open) => !open);
  };

  /** Hover on "执行" while a menu is open: switch to the tab menu. */
  const hoverExecuteMenu = () => {
    if (execMenuOpen) return;
    if (!activeMenu && !isMenuActivated) return;
    setActiveMenu(null);
    setIsMenuActivated(true);
    setExecMenuOpen(true);
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
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-[180px] p-1">
              <button
                onClick={() => {
                  onOpenFile();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                className={`flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                  currentPipelineLength === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent/60"
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
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                className={`flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                  currentPipelineLength === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent/60"
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
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                {t.csvDiff}
              </button>
              <button
                onClick={() => {
                  onOpenCsvEncoding();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                {t.csvEncoding}
              </button>
              <button
                onClick={() => {
                  onOpenSeparateCsv();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                {t.separateGoodBad}
              </button>
              <button
                onClick={() => {
                  onOpenSplitLines();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                {t.splitLines}
              </button>
              <button
                onClick={() => {
                  onOpenMergeExcel();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
            <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-[180px] p-1">
              <button
                onClick={() => {
                  onUndo();
                  setActiveMenu(null);
                }}
                disabled={undoStack.length === 0}
                className={`flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                  undoStack.length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent/60"
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
                className={`flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                  redoStack.length === 0
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent/60"
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
              className="absolute left-0 top-full mt-2 bg-card border border-border rounded-lg shadow-lg z-50 w-[180px] p-1"
            >
              <button
                role="menuitem"
                onClick={() => {
                  onOpenPalette();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                    "flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                    !hasInputFile
                      ? "text-muted-foreground/40 cursor-not-allowed"
                      : showDataProfile
                        ? "text-foreground hover:bg-accent/60"
                        : "text-muted-foreground hover:bg-accent/60",
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
                  "flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                  showVersionPanel
                    ? "text-foreground hover:bg-accent/60"
                    : "text-muted-foreground hover:bg-accent/60",
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
                  "flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                  showLineagePanel
                    ? "text-foreground hover:bg-accent/60"
                    : "text-muted-foreground hover:bg-accent/60",
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
                  "flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                  showVariablePanel
                    ? "text-foreground hover:bg-accent/60"
                    : "text-muted-foreground hover:bg-accent/60",
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
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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

        {/* Help menu — help dialog + check update. The entry stays clickable in
            every state: a slow check must not lock away the Help Center. The
            "update found" dot inherited from the former standalone button lives
            on this button's top-right. The check itself gets the same 2px
            indeterminate bottom line as the "执行" button (design 022 §5.4): a
            manual check otherwise looks like a click that did nothing until the
            dialog finally opens. The marker is `data-checking`, deliberately not
            `data-busy` — the execute button is the only `data-busy` menu trigger
            (ExecuteMenu.test.tsx). */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("help")}
            onMouseEnter={() => hoverMenu("help")}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "help"}
            data-checking={isCheckingUpdate ? "true" : "false"}
            className={cn(
              "relative overflow-hidden flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeMenu === "help"
                ? "bg-accent text-foreground"
                : "text-primary hover:text-primary hover:bg-primary/10",
              // The in-flight line is purely additive — no dimming, no
              // `cursor-not-allowed`, no `disabled`.
              isCheckingUpdate && "update-busy",
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
              className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-[180px] p-1"
            >
              <button
                role="menuitem"
                onClick={() => {
                  onHelp();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
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
                  "flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium transition-colors",
                  isCheckingUpdate
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.checkUpdate}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* "Execute" became a per-tab menu. The button itself keeps
            its label and size in every state — while a run is in flight only a
            2px indeterminate line appears along its bottom edge (`.exec-busy`),
            no icon is added. The menu lists the current tab first, a thin divider,
            then the other tabs. */}
        <div className="relative" ref={execMenuRef}>
          <button
            onClick={toggleExecuteMenu}
            onMouseEnter={hoverExecuteMenu}
            disabled={currentPipelineLength === 0}
            aria-haspopup="menu"
            aria-expanded={execMenuOpen}
            data-busy={isExecuting ? "true" : "false"}
            className={cn(
              "relative overflow-hidden flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              currentPipelineLength === 0
                ? "text-muted-foreground/40 cursor-not-allowed"
                : isExecuting
                  ? "exec-busy text-muted-foreground cursor-pointer"
                  : "text-primary hover:bg-primary/10 cursor-pointer",
            )}
          >
            {t.execute}
          </button>

          {execMenuOpen && currentPipelineLength > 0 && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 z-50 w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg"
            >
              {renderExecRow(currentTab, true)}
              <div className="my-1 h-px bg-border" />
              {otherTabs.map((tab) => renderExecRow(tab, false))}
            </div>
          )}
        </div>

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
          {/* Settings sits last, right of AI, and is icon-only with a tooltip so
              the widest label in the bar stops pushing "Execute" around. Its
              highlight tracks the open dialog, matching the panel toggles it
              sits beside — including the 12px underline that marks them as
              "open" rather than merely hovered. */}
          <Tooltip content={t.settings}>
            <button
              onClick={onShowSettings}
              aria-label={t.settings}
              aria-expanded={showSettingsDialog}
              className={commandButtonClass(showSettingsDialog)}
            >
              <Settings className="h-4 w-4" />
              {showSettingsDialog && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-3 rounded-full bg-current" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});
