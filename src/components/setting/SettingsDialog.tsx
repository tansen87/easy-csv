import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";

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
  const { theme, setTheme, accent, setAccent } = useTheme();
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
    return new Set(
      model.filter((group) => !kept.has(group.id)).map((g) => g.id),
    );
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
    // Appearance + accent back to their defaults, plus the five other values
    // the pre-030 footer reset (design 034 §2.5).
    setTheme("system");
    setAccent("ink");
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
    setAccent,
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
        className="relative flex h-[min(680px,86vh)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-muted shadow-xl outline-none dark:bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        {/* No divider and no tinted strip: the window's own grey is the header's
            background, so the title, the directory and the content read as one
            surface (design 040 §2). */}
        <div className="flex h-13 flex-none items-center justify-between pl-5 pr-3">
          <h2 className="text-[13px] font-medium">{t.settings}</h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <SettingsNav
            groups={model.map((group) => ({
              id: group.id,
              name: group.name,
              index: group.index,
            }))}
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
              accent={accent}
              onAccentChange={setAccent}
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
          </div>
        </div>

        {/* A real footer band, not buttons floating over the list: rows used
            to scroll underneath the old overlay, which read as a
            rendering bug. The left side states when a change takes effect -
            appearance applies live, everything else is written on save. */}
        <div className="flex h-14 flex-none items-center justify-between gap-4 border-t border-border px-5">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px] text-muted-foreground">
            {t.settingsLiveNote}
          </span>
          <div className="flex flex-none items-center gap-2">
            <Button variant="secondary" onClick={handleReset}>
              {isResetClicked && <Check className="h-4 w-4" />}
              {t.resetToDefaults}
            </Button>
            <Button onClick={handleSave}>
              {isSaveClicked && <Check className="h-4 w-4" />}
              {t.saveSettings}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
