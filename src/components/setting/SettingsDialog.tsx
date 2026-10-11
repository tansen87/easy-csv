import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw, Save, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";
import { useTheme } from "@/components/setting/ThemeProvider";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { AIConfig } from "@/services/ai/types";
import type { DelimiterMode } from "@/types/xan";
import { countMatches, filterSettings } from "@/utils/settingsSearch";
import { SettingsNav } from "./SettingsNav";
import { SettingsSearch } from "./SettingsSearch";
import { SettingsTabContent } from "./SettingsTabContent";
import {
  SECTION_ID_PREFIX,
  SETTINGS_GROUP_IDS,
  buildSettingsModel,
  sectionElementId,
} from "./settingsSections";

/**
 * The settings dialog. Two columns inside one frame:
 *
 * ```
 * ┌ title ────────────────────────────────── ✕ ┐
 * │ directory   │ search                        │
 * │ (7 groups)  │ sticky group heading          │
 * │             │ one row per setting           │
 * ├─────────────┴───────────────────────────────┤
 * │                    [reset] [save]           │
 * └─────────────────────────────────────────────┘
 * ```
 *
 * The dialog owns the search query and the layout; the directory answers "where
 * else can I go", the search answers "where is the one I want".
 */
interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** `"auto"` = detect on open; a concrete delimiter turns detection off. */
  delimiterMode: DelimiterMode;
  onDelimiterModeChange: (mode: DelimiterMode) => void;
  noHeaders: boolean;
  onNoHeadersChange: (value: boolean) => void;
  systemNotification: boolean;
  onSystemNotificationChange: (value: boolean) => void;
  minimizeToTray: boolean;
  onMinimizeToTrayChange: (value: boolean) => void;
  doubleClickFitView: boolean;
  onDoubleClickFitViewChange: (value: boolean) => void;
  autoCheckUpdate: boolean;
  onAutoCheckUpdateChange: (value: boolean) => void;
  /** Parallel run limit. */
  maxConcurrentRuns: number;
  onMaxConcurrentRunsChange: (value: number) => void;
  /** Clear the "intro seen" flag so the canvas guide shows again. */
  onResetOnboarding?: () => void;
  onSave: () => void;
  aiConfig: AIConfig;
  onAIConfigChange: (config: AIConfig) => void;
  /** Forwarded to the plugins tab, which reports install/remove outcomes. */
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/** Typing `/` must not steal the keystroke from a field the user is in. */
function isTextEntry(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (element as HTMLElement).isContentEditable
  );
}

export function SettingsDialog({
  isOpen,
  onClose,
  delimiterMode,
  onDelimiterModeChange,
  noHeaders,
  onNoHeadersChange,
  systemNotification,
  onSystemNotificationChange,
  minimizeToTray,
  onMinimizeToTrayChange,
  doubleClickFitView,
  onDoubleClickFitViewChange,
  autoCheckUpdate,
  onAutoCheckUpdateChange,
  maxConcurrentRuns,
  onMaxConcurrentRunsChange,
  onResetOnboarding,
  onSave,
  aiConfig,
  onAIConfigChange,
  showToast,
}: SettingsDialogProps) {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [isSaveClicked, setIsSaveClicked] = useState(false);
  const [isResetClicked, setIsResetClicked] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = useMemo(() => buildSettingsModel(t), [t]);
  const filtered = useMemo(() => filterSettings(model, query), [model, query]);
  const searching = query.length > 0;
  const resultCount = useMemo(() => countMatches(filtered), [filtered]);
  const dimmedIds = useMemo(() => {
    const kept = new Set(filtered.map((group) => group.id));
    return new Set(model.filter((group) => !kept.has(group.id)).map((g) => g.id));
  }, [model, filtered]);

  // Scroll-linked highlight. Off while searching: "the group I am in" has no
  // meaning in a filtered list, and a stale highlight would mislead.
  const { activeId, lockTo } = useScrollSpy(SETTINGS_GROUP_IDS, scrollRootRef, {
    idPrefix: SECTION_ID_PREFIX,
    enabled: isOpen && !searching,
  });

  const handleNavigate = useCallback(
    (groupId: string) => {
      const section = document.getElementById(sectionElementId(groupId));
      if (!section) return;
      lockTo(groupId);
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      // Keyboard users land on the heading, so the next Tab walks that group's
      // rows instead of restarting at the top of the dialog.
      section.focus({ preventScroll: true });
    },
    [lockTo],
  );

  const handleReset = useCallback(() => {
    // Same six values the pre-030 footer reset — the set is unchanged.
    setTheme("light");
    onDelimiterModeChange("auto");
    onNoHeadersChange(false);
    onSystemNotificationChange(true);
    onMinimizeToTrayChange(true);
    onDoubleClickFitViewChange(true);
    setIsResetClicked(true);
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => setIsResetClicked(false), 3000);
  }, [
    setTheme,
    onDelimiterModeChange,
    onNoHeadersChange,
    onSystemNotificationChange,
    onMinimizeToTrayChange,
    onDoubleClickFitViewChange,
  ]);

  const handleSave = useCallback(() => {
    onSave();
    setIsSaveClicked(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setIsSaveClicked(false), 3000);
  }, [onSave]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // First Escape clears the search, a second one closes the dialog.
        if (query.length > 0) setQuery("");
        else onClose();
        return;
      }
      if (event.key === "/" && !isTextEntry(document.activeElement)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    },
    [onClose, query],
  );

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-xs"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.settings}
        tabIndex={-1}
        className="relative flex h-[72vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-card shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
          <h2 className="text-sm font-medium">{t.settings}</h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <SettingsNav
            groups={model.map((group) => ({ id: group.id, name: group.name }))}
            activeId={searching ? null : activeId}
            dimmedIds={dimmedIds}
            onNavigate={handleNavigate}
          />
          <div className="relative flex min-w-0 flex-1 flex-col">
            <SettingsSearch
              value={query}
              onChange={setQuery}
              resultCount={resultCount}
              inputRef={searchInputRef}
            />
            <SettingsTabContent
              groups={filtered}
              query={query}
              scrollRootRef={scrollRootRef}
              theme={theme}
              onThemeChange={setTheme}
              delimiterMode={delimiterMode}
              onDelimiterModeChange={onDelimiterModeChange}
              noHeaders={noHeaders}
              onNoHeadersChange={onNoHeadersChange}
              systemNotification={systemNotification}
              onSystemNotificationChange={onSystemNotificationChange}
              minimizeToTray={minimizeToTray}
              onMinimizeToTrayChange={onMinimizeToTrayChange}
              doubleClickFitView={doubleClickFitView}
              onDoubleClickFitViewChange={onDoubleClickFitViewChange}
              autoCheckUpdate={autoCheckUpdate}
              onAutoCheckUpdateChange={onAutoCheckUpdateChange}
              maxConcurrentRuns={maxConcurrentRuns}
              onMaxConcurrentRunsChange={onMaxConcurrentRunsChange}
              onResetOnboarding={onResetOnboarding}
              aiConfig={aiConfig}
              onAIConfigChange={onAIConfigChange}
              showToast={showToast}
            />

            {/* Floating actions, bottom-centre of the content pane (not the
                whole dialog: the directory column is not part of the centre).
                Deliberately not a footer band — no divider, no reserved strip;
                the list keeps the full height and scrolls under these two, and
                `SettingsTabContent` carries extra bottom padding so the last row
                can still be scrolled clear of them. */}
            <div className="absolute bottom-3 left-1/2 z-panel flex -translate-x-1/2 items-center gap-2">
              <Button variant="secondary" onClick={handleReset}>
                {isResetClicked ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                {t.resetToDefaults}
              </Button>
              <Button variant="secondary" onClick={handleSave}>
                {isSaveClicked ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t.saveSettings}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
