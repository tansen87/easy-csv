import React from "react";
import { createPortal } from "react-dom";
import { Command, ScrollText, Bot, Settings, Check } from "lucide-react";

import { PipelineStep } from "@/types/xan";
import type { RunSession } from "@/types/execution";
import { useLanguage } from "@/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";
import { usesCustomTitleBar } from "@/lib/platform";

/** "0.8.0" → "v0.8.0"; an already-prefixed value is left as is. */
const withVersionPrefix = (version: string) =>
  version.startsWith("v") ? version : `v${version}`;

/**
 * Width of the run panel. One constant so it can be tuned here; 240 still
 * leaves the name column ~100px after the lamp, readout and action.
 */
const RUN_PANEL_WIDTH = 240;

interface MainMenuProps {
  activeMenu: "file" | "edit" | "view" | "tools" | "help" | null;
  setActiveMenu: (menu: "file" | "edit" | "view" | "tools" | "help" | null) => void;
  isMenuActivated: boolean;
  setIsMenuActivated: (activated: boolean) => void;
  undoStack: Array<{ pipeline: PipelineStep[] }>;
  redoStack: Array<{ pipeline: PipelineStep[] }>;
  onUndo: () => void;
  onRedo: () => void;
  /** Tab strip + run registry backing the execute menu. */
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
  /** Opens the built-in sample. Sits first in the Help menu. */
  onLoadDemo: () => void;
  onHelp: () => void;
  /** Opens the GitHub issues page for bug reports. */
  onReportIssue: () => void;
  onCheckUpdate: () => void;
  onShowAbout: () => void;
  onShowSettings: () => void;
  onOpenPalette: () => void;
  onOpenSearch: () => void;
  onOpenCsvDiff: () => void;
  onOpenCsvEncoding: () => void;
  onOpenSeparateCsv: () => void;
  onOpenSplitLines: () => void;
  onOpenEnumerateByGroup: () => void;
  onOpenCsvToExcel: () => void;
  onOpenMergeExcel: () => void;
  isExecuting: boolean;
  /** Concurrency limit, shown in the run panel footer so queueing is explained. */
  maxConcurrentRuns: number;
  isCheckingUpdate: boolean;
  hasUpdate: boolean;
  /**
   * Remote version when `hasUpdate` is true (e.g. "0.8.0"). Shown next to the
   * "检查更新" item so the Help menu says which version is waiting; the dot
   * alone still renders if the version is not known yet.
   */
  updateVersion?: string;
  /**
   * Version of the running build, shown next to "检查更新" when no update is
   * waiting (and before any check has run). No dot in that state.
   */
  currentVersion?: string;
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
   * Referenced pipeline variables whose default value is empty (design 046).
   * Rendered as a small amber count next to the 管道变量 entry so the "this
   * run will stop and ask for values" state is visible before opening the
   * panel; 0 renders nothing.
   */
  pendingVariables?: number;
  /**
   * Whether the settings dialog is open. The Settings entry sits in the
   * right-hand icon group, which highlights the panel it toggles; the dialog is
   * that group's counterpart for this entry, so it drives the same
   * `commandButtonClass(active)` state.
   */
  showSettingsDialog: boolean;
  /**
   * Briefly highlight the command-panel entry while the first-run guide is up,
   * so the card's button and the real entry point
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
  onLoadDemo,
  onHelp,
  onReportIssue,
  onCheckUpdate,
  onShowAbout,
  onShowSettings,
  onOpenPalette,
  onOpenSearch,
  onOpenCsvDiff,
  onOpenCsvEncoding,
  onOpenSeparateCsv,
  onOpenSplitLines,
  onOpenEnumerateByGroup,
  onOpenCsvToExcel,
  onOpenMergeExcel,
  isExecuting,
  maxConcurrentRuns,
  isCheckingUpdate,
  hasUpdate,
  updateVersion,
  currentVersion,
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
  pendingVariables = 0,
  showSettingsDialog,
  highlightCommandEntry = false,
}: MainMenuProps) {
  const { t } = useLanguage();
  /** The version the Help menu advertises: the offered one, else the installed one. */
  const updateHintVersion = hasUpdate ? updateVersion : currentVersion;

  // Execute menu
  // The toolbar "Execute" opens a per-tab menu instead of running immediately:
  // the current tab is pinned on top, a thin divider separates the rest.
  const [execMenuOpen, setExecMenuOpen] = React.useState(false);
  const execMenuRef = React.useRef<HTMLDivElement>(null);
  const execButtonRef = React.useRef<HTMLButtonElement>(null);
  const execPanelRef = React.useRef<HTMLDivElement>(null);
  const [execPanelPos, setExecPanelPos] = React.useState<{
    left: number;
    top: number;
  } | null>(null);

  /**
   * The panel is portalled out of the title bar. Inside it, the empty rows and
   * footer were part of the header's `data-tauri-drag-region="deep"`, so
   * dragging or double-clicking them moved / maximised the window instead of
   * acting on the panel.
   */
  const placeExecPanel = React.useCallback(() => {
    const rect = execButtonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = RUN_PANEL_WIDTH;
    setExecPanelPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: rect.bottom + 6,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!execMenuOpen) {
      setExecPanelPos(null);
      return;
    }
    placeExecPanel();
    const onResize = () => placeExecPanel();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [execMenuOpen, placeExecPanel]);

  React.useEffect(() => {
    if (!execMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !execMenuRef.current?.contains(target) &&
        !execPanelRef.current?.contains(target)
      ) {
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

  /** Current tab first inside every group, so its action is always one glance away. */
  const withCurrentFirst = (list: typeof tabs) =>
    [...list].sort((a, b) =>
      a.id === currentTabId ? -1 : b.id === currentTabId ? 1 : 0,
    );

  const runningTabs = withCurrentFirst(
    tabs.filter((tab) => runs[tab.id]?.state === "running"),
  );
  const queuedTabs = withCurrentFirst(
    tabs.filter((tab) => runs[tab.id]?.state === "queued"),
  );
  const pendingTabs = withCurrentFirst(
    tabs.filter((tab) => runs[tab.id]?.state === "preparing"),
  );
  const idleTabs = withCurrentFirst(
    tabs.filter((tab) => {
      const state = runs[tab.id]?.state;
      return !state || state === "done" || state === "error" || state === "cancelled";
    }),
  );

  /** Drives the 6px dot after the label: another tab is running / queued / waiting. */
  const hasOtherActive = tabs.some((tab) => {
    if (tab.id === currentTabId) return false;
    const state = runs[tab.id]?.state;
    return state === "running" || state === "queued" || state === "preparing";
  });

  /**
   * One row of the run panel. The row itself only switches tabs; every action
   * lives in the trailing button, so a click never means two different things.
   * Left lamp + mono readout carry the state, never a coloured pill.
   */
  const renderExecRow = (
    tab: { id: string; name: string } | undefined,
    isCurrent: boolean,
  ) => {
    if (!tab) return null;
    const run = runs[tab.id];
    const state = run?.state ?? "idle";
    const running = state === "running";
    const queued = state === "queued";
    const pending = state === "preparing";
    const failed = state === "error";

    const switchTo = () => {
      setExecMenuOpen(false);
      onSelectTab(tab.id);
    };
    const runNow = () => {
      setExecMenuOpen(false);
      onRunTab(tab.id);
    };
    const stopNow = () => {
      setExecMenuOpen(false);
      onCancelTab(tab.id);
    };
    /** Idle rows run on click; a run that is already in flight only switches. */
    const activate = () => {
      if (running || queued || pending) switchTo();
      else runNow();
    };

    return (
      <div
        key={tab.id}
        role="menuitem"
        tabIndex={0}
        data-tab-id={tab.id}
        data-state={state}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activate();
          }
        }}
        className="group relative grid h-8 cursor-pointer grid-cols-[10px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-2 transition-colors hover:bg-accent/50"
      >
        {isCurrent && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-0 w-0.5 rounded-full bg-primary"
          />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "h-[7px] w-[7px] justify-self-center rounded-full",
            running && "bg-primary ring-[3px] ring-primary/10",
            queued && "border-[1.5px] border-muted-foreground/60",
            pending && "bg-warning",
            failed && "bg-destructive",
          )}
        />
        <span
          className="truncate text-[12.5px] font-medium text-foreground"
        >
          {tab.name}
        </span>
        <span className="whitespace-nowrap font-mono text-[10.5px] text-muted-foreground">
          {running
            ? `${t.branchProgress} ${
                run?.branch
                  ? `${run.branch.current}/${run.branch.total}`
                  : "-"
              }`
            : failed
              ? t.runStateFailed
              : ""}
        </span>
        {running || queued ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              stopNow();
            }}
            className="h-[22px] rounded-[5px] border border-destructive/25 px-2 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/5"
          >
            {t.runStop}
          </button>
        ) : pending ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              switchTo();
            }}
            className="h-[22px] rounded-[5px] bg-warning-soft px-2 text-[11px] font-medium text-warning transition-colors hover:bg-warning/15"
          >
            {t.runHandle}
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              runNow();
            }}
            className="h-[22px] rounded-[5px] bg-primary/10 px-2 text-[11px] font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {t.execute}
          </button>
        )}
      </div>
    );
  };

  const renderGroup = (
    key: "running" | "queued" | "preparing" | "idle",
    label: string,
    list: typeof tabs,
  ) => {
    if (list.length === 0) return null;
    return (
      <div data-group={key}>
        <div className="flex items-center gap-1.5 px-2 pt-2 pb-0.5 font-mono text-[10px] text-muted-foreground/70">
          {label}
          <span className="text-muted-foreground">{list.length}</span>
        </div>
        {list.map((tab) => renderExecRow(tab, tab.id === currentTabId))}
      </div>
    );
  };

  // Menu-bar behaviour: a click opens a menu; while any menu is open, hovering
  // another menu button switches to it (design: File / Edit / View / Tools / Help).
  const toggleMenu = (menu: "file" | "edit" | "view" | "tools" | "help") => {
    setExecMenuOpen(false);
    if (!isMenuActivated) {
      setIsMenuActivated(true);
      setActiveMenu(menu);
    } else {
      setActiveMenu(activeMenu === menu ? null : menu);
    }
  };

  const hoverMenu = (menu: "file" | "edit" | "view" | "tools" | "help") => {
    // The execute menu is a peer of File/Edit/View/Tools/Help: hovering a menu-bar
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
    setExecMenuOpen((open) => !open);
  };

  /**
   * Hover on "执行" follows the menu bar: it switches to this menu only while
   * another menu is already open. The guard must be `activeMenu`, not the
   * sticky `isMenuActivated` (it is never reset), otherwise a bare hover
   * expanded this menu after the first click of the session.
   */
  const hoverExecuteMenu = () => {
    if (execMenuOpen) return;
    if (!activeMenu) return;
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
                <span className="h-3 w-3 shrink-0" aria-hidden="true" />
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
                  <Check
                    className={cn(
                      "h-3 w-3 shrink-0 text-primary",
                      !showDataProfile && "opacity-0",
                    )}
                    aria-hidden="true"
                  />
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
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0 text-primary",
                    !showVersionPanel && "opacity-0",
                  )}
                  aria-hidden="true"
                />
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
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0 text-primary",
                    !showLineagePanel && "opacity-0",
                  )}
                  aria-hidden="true"
                />
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
                <Check
                  className={cn(
                    "h-3 w-3 shrink-0 text-primary",
                    !showVariablePanel && "opacity-0",
                  )}
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap">{t.variables}</span>
                {pendingVariables > 0 && (
                  <span
                    data-testid="pending-variable-count"
                    className="ml-auto rounded-full bg-warning-soft px-1.5 font-mono text-[9.5px] leading-[15px] tabular-nums text-warning"
                  >
                    {pendingVariables}
                  </span>
                )}
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
                <span className="h-3 w-3 shrink-0" aria-hidden="true" />
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

        {/* Tools menu — one-shot file utilities that never touch the pipeline:
            diff / encoding conversion / separate good-bad rows / split by line
            count / number rows by group / merge Excel workbooks. They open a
            dialog and call one backend command; unlike the File menu they do
            not participate in the pipeline lifecycle (open / new tab /
            templates / save / import / export), so they live in their own
            menu. */}
        <div className="relative">
          <button
            onClick={() => toggleMenu("tools")}
            onMouseEnter={() => hoverMenu("tools")}
            aria-haspopup="menu"
            aria-expanded={activeMenu === "tools"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeMenu === "tools"
                ? "bg-accent text-foreground"
                : "text-primary hover:text-primary hover:bg-primary/10"
            }`}
          >
            {t.tools}
          </button>
          {activeMenu === "tools" && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 w-[180px] p-1"
            >
              <button
                role="menuitem"
                onClick={() => {
                  onOpenCsvDiff();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.csvDiff}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenCsvEncoding();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.csvEncoding}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenSeparateCsv();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.separateGoodBad}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenSplitLines();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.splitLines}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenEnumerateByGroup();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.enumerateByGroup}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenCsvToExcel();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.csvToExcel}
                </span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onOpenMergeExcel();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.mergeExcel}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Help menu — help dialog + check update. The entry stays clickable in
            every state: a slow check must not lock away the Help Center. The
            "update found" dot inherited from the former standalone button lives
            on this button's top-right. The check itself gets the same 2px
            indeterminate bottom line as the "Execute" button: a
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
              <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-success" />
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
                  onLoadDemo();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.viewSample}
                </span>
              </button>
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
                  onReportIssue();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.reportIssue}
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
                {!isCheckingUpdate && (hasUpdate || currentVersion) && (
                  <span
                    title={
                      hasUpdate ? t.newVersionAvailable : t.currentVersion
                    }
                    className="flex flex-none items-center gap-1.5"
                  >
                    {hasUpdate && (
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    )}
                    {updateHintVersion && (
                      <span className="font-mono text-[10.5px] leading-none text-muted-foreground tabular-nums">
                        {withVersionPrefix(updateHintVersion)}
                      </span>
                    )}
                  </span>
                )}
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  onShowAbout();
                  setActiveMenu(null);
                }}
                className="flex items-center gap-2 w-full h-8 px-3 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent/60 transition-colors"
              >
                <span className="flex-1 text-left whitespace-nowrap">
                  {t.about}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* "Execute" became a per-tab menu. The button itself keeps
            its label and size in every state — while a run is in flight only a
            2px indeterminate line appears along its bottom edge (`.exec-busy`),
            no icon is added. The menu lists the current tab first, a thin divider,
            then the other tabs.

            It stays a peer of the other menu items: click opens it, and while
            another menu-bar menu is open a hover switches to it. Hovering with
            nothing open must do nothing — the old guard used the sticky
            `isMenuActivated` flag, so after the first menu click of the session
            a bare hover expanded it ("sometimes you must click, sometimes not"). */}
        <div className="relative" ref={execMenuRef}>
          <button
            ref={execButtonRef}
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
                : execMenuOpen
                  ? "bg-accent text-foreground"
                  : isExecuting
                    ? "exec-busy text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                    : "text-primary hover:text-primary hover:bg-primary/10 cursor-pointer",
            )}
          >
            {t.execute}
            {hasOtherActive && (
              <span
                aria-hidden="true"
                className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary"
              />
            )}
          </button>

          {execMenuOpen &&
            currentPipelineLength > 0 &&
            execPanelPos &&
            createPortal(
              <div
                ref={execPanelRef}
                role="menu"
                style={{
                  position: "fixed",
                  left: execPanelPos.left,
                  top: execPanelPos.top,
                  width: RUN_PANEL_WIDTH,
                }}
                className="z-50 overflow-hidden rounded-[10px] border border-border bg-popover shadow-lg"
              >
                <div className="max-h-[320px] overflow-y-auto p-1">
                  {renderGroup("running", t.runGroupRunning, runningTabs)}
                  {renderGroup("queued", t.runStateQueued, queuedTabs)}
                  {renderGroup("preparing", t.runStatePending, pendingTabs)}
                  {renderGroup("idle", t.runGroupIdle, idleTabs)}
                </div>
                <div className="flex h-8 items-center justify-between border-t border-border-soft px-2.5 text-[11px] text-muted-foreground">
                  <span>
                    {t.runLimitHint.replace(
                      "{count}",
                      String(maxConcurrentRuns),
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-card px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground">
                      Ctrl+R
                    </kbd>
                  </span>
                </div>
              </div>,
              document.body,
            )}
        </div>

        {/* Spacer — doubles as the window drag area under the custom title bar */}
        <div
          className="flex-1"
          {...(usesCustomTitleBar ? { "data-tauri-drag-region": "deep" } : {})}
        />

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
                  "bg-info-soft text-info ring-2 ring-info/70",
              )}
            >
              <Command className="h-4 w-4" />
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
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-danger" />
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
