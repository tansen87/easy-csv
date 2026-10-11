import React, { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Plus, Trash2, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Select } from "@/components/ui/Select";
import { DelimiterModeSelect } from "@/components/ui/DelimiterModeSelect";
import { PluginSection } from "./PluginSection";
import { SettingsGroupCard } from "./SettingsGroupCard";
import { SettingsSectionHeading } from "./SettingsSectionHeading";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n";
import {
  AIConfig,
  PROVIDERS,
  AVAILABLE_MODELS,
  isBuiltinProvider,
} from "@/services/ai/types";
import { loadProviderApiKey } from "@/services/ai";
import type { DelimiterMode } from "@/types/xan";
import { SettingsRow } from "./SettingsRow";
import {
  sectionElementId,
  type SettingsGroupModel,
  type SettingsRowModel,
} from "./settingsSections";

/**
 * The settings content pane: a scrolling list of
 * `sticky group heading + one row per setting`. Structure lives in
 * `settingsSections.ts`; this file only knows how to render each control.
 */
interface SettingsTabContentProps {
  /** Search-filtered groups, in definition order. */
  groups: SettingsGroupModel[];
  /** Current query, used for `<mark>` highlighting only. */
  query: string;
  /** Scroll container handle - the dialog's scroll spy watches it. */
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  theme: "dark" | "light" | "system";
  onThemeChange: (theme: "dark" | "light" | "system") => void;
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
  /** Parallel run limit; backend clamps to 1..=16. */
  maxConcurrentRuns: number;
  onMaxConcurrentRunsChange: (value: number) => void;
  /** Clear the "intro seen" flag so the canvas guide shows again. */
  onResetOnboarding?: () => void;
  aiConfig: AIConfig;
  onAIConfigChange: (config: AIConfig) => void;
  /** Used by the plugins / clear-data actions to report outcomes. */
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

type ClearTarget = "conversations" | "feedback" | "corrections" | "history";

/** Row id → which dataset its 「清除」 button wipes. */
const CLEAR_TARGETS: Record<string, ClearTarget> = {
  "clear-execution-history": "history",
  "ai-clear-conversations": "conversations",
  "ai-clear-feedback": "feedback",
  "ai-clear-corrections": "corrections",
};

const CLEAR_COMMANDS: Record<ClearTarget, string> = {
  conversations: "clear_conversations",
  feedback: "clear_feedback",
  corrections: "clear_corrections",
  history: "clear_execution_history",
};

const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-input accent-foreground cursor-pointer";

/** Shared three-way picker (language / theme) — replaces two copies of the old markup. */
function SegmentChoice<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid h-8 w-[210px] grid-cols-3 rounded-md border border-border/60 bg-muted/50 p-0.5"
    >
      <div
        className="absolute bottom-0.5 top-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out"
        style={{
          width: "calc(33.333% - 1px)",
          left: `calc(${(index * 100) / 3}% + 1px)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "relative z-10 rounded-md text-[11px] font-medium transition-colors",
            option.value === value
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
            disabled && "opacity-60",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsTabContent({
  groups,
  query,
  scrollRootRef,
  theme,
  onThemeChange,
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
  aiConfig,
  onAIConfigChange,
  showToast,
}: SettingsTabContentProps) {
  const { language, setLanguage, t } = useLanguage();
  const [clearTarget, setClearTarget] = useState<ClearTarget | null>(null);
  const [clearing, setClearing] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(false);
  const [themeTransitioning, setThemeTransitioning] = useState(false);
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numberRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const passwordRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const checkboxRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const selectRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleClearData = useCallback(async () => {
    if (!clearTarget) return;
    setClearing(true);
    try {
      await invoke(CLEAR_COMMANDS[clearTarget]);
    } catch (error) {
      console.error("Failed to clear data:", error);
    } finally {
      setClearing(false);
      setClearTarget(null);
    }
  }, [clearTarget]);

  const handleThemeChange = useCallback(
    (next: "dark" | "light" | "system") => {
      if (themeTimerRef.current) clearTimeout(themeTimerRef.current);
      setThemeTransitioning(true);
      themeTimerRef.current = setTimeout(() => {
        onThemeChange(next);
        setThemeTransitioning(false);
      }, 50);
    },
    [onThemeChange],
  );

  const updateCustomModels = useCallback(
    (models: string[]) => {
      const cleaned = models.map((model) => model.trim()).filter(Boolean);
      onAIConfigChange({
        ...aiConfig,
        models,
        model: cleaned.includes(aiConfig.model)
          ? aiConfig.model
          : cleaned[0] || "",
      });
    },
    [aiConfig, onAIConfigChange],
  );

  const providerOptions = useMemo(
    () =>
      PROVIDERS.map((provider) => ({
        label: provider.name,
        value: provider.id,
      })),
    [],
  );

  const modelOptions = useMemo(
    () =>
      isBuiltinProvider(aiConfig.provider)
        ? (
            AVAILABLE_MODELS[
              aiConfig.provider as keyof typeof AVAILABLE_MODELS
            ] || []
          ).map((model) => ({ label: model.name, value: model.id }))
        : (aiConfig.models || [])
            .map((model) => model.trim())
            .filter(Boolean)
            .map((model) => ({ label: model, value: model })),
    [aiConfig.provider, aiConfig.models],
  );

  /** Whole-row delegation: it does what clicking the control would do. */
  const focusSelect = (id: string) => () =>
    selectRefs.current[id]?.querySelector<HTMLInputElement>("input")?.focus();

  const renderControl = (row: SettingsRowModel) => {
    switch (row.control) {
      case "delimiter":
        return (
          <div
            ref={(node) => {
              selectRefs.current[row.id] = node;
            }}
          >
            <DelimiterModeSelect
              value={delimiterMode}
              onChange={onDelimiterModeChange}
              placeholder={t.selectDelimiter}
              size="sm"
              width={160}
              listMaxHeight="max-h-36"
            />
          </div>
        );

      case "checkbox": {
        const checked =
          row.id === "no-headers"
            ? noHeaders
            : row.id === "notification"
              ? systemNotification
              : row.id === "tray"
                ? minimizeToTray
                : row.id === "fit-view"
                  ? doubleClickFitView
                  : autoCheckUpdate;
        const change =
          row.id === "no-headers"
            ? onNoHeadersChange
            : row.id === "notification"
              ? onSystemNotificationChange
              : row.id === "tray"
                ? onMinimizeToTrayChange
                : row.id === "fit-view"
                  ? onDoubleClickFitViewChange
                  : onAutoCheckUpdateChange;
        return (
          <input
            ref={(node) => {
              checkboxRefs.current[row.id] = node;
            }}
            type="checkbox"
            checked={checked}
            aria-label={row.title}
            onChange={(event) => change(event.target.checked)}
            className={CHECKBOX_CLASS}
          />
        );
      }

      case "number":
        return (
          <input
            ref={(node) => {
              numberRefs.current[row.id] = node;
            }}
            type="number"
            min={1}
            max={16}
            aria-label={row.title}
            value={maxConcurrentRuns}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isNaN(next)) return;
              onMaxConcurrentRunsChange(Math.min(16, Math.max(1, next)));
            }}
            className="h-8 w-16 rounded-md border border-input bg-background px-2 text-xs"
          />
        );

      case "language":
        return (
          <SegmentChoice
            ariaLabel={row.title}
            value={language}
            onChange={setLanguage}
            options={[
              { label: t.system, value: "system" as const },
              { label: "中文", value: "zh" as const },
              { label: "English", value: "en" as const },
            ]}
          />
        );

      case "theme":
        return (
          <SegmentChoice
            ariaLabel={row.title}
            value={theme}
            onChange={handleThemeChange}
            disabled={themeTransitioning}
            options={[
              { label: t.system, value: "system" as const },
              { label: t.light, value: "light" as const },
              { label: t.dark, value: "dark" as const },
            ]}
          />
        );

      case "action":
        return (
          <Button variant="secondary" size="sm" onClick={onResetOnboarding}>
            {t.onboardingReset}
          </Button>
        );

      case "disclosure": {
        const enabled = aiConfig.provider === "custom";
        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={!enabled}
            aria-expanded={customExpanded}
            onClick={() => setCustomExpanded((open) => !open)}
          >
            {customExpanded ? t.settingsCollapse : t.settingsExpand}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                customExpanded && "rotate-180",
              )}
            />
          </Button>
        );
      }

      case "provider":
        return (
          <div
            ref={(node) => {
              selectRefs.current[row.id] = node;
            }}
          >
            <Select
              ariaLabel={row.title}
              value={aiConfig.provider}
              onChange={async (provider) => {
                const next = provider as string;
                const apiKey = await loadProviderApiKey(next);
                if (next === "custom") {
                  onAIConfigChange({ ...aiConfig, provider: next, apiKey });
                } else {
                  const model =
                    AVAILABLE_MODELS[next as keyof typeof AVAILABLE_MODELS]?.[0]
                      ?.id || "";
                  onAIConfigChange({
                    ...aiConfig,
                    provider: next,
                    model,
                    baseUrl: "",
                    apiKey,
                  });
                }
              }}
              options={providerOptions}
              placeholder={t.aiSelectProvider}
              size="sm"
              width={160}
            />
          </div>
        );

      case "model":
        return (
          <div
            ref={(node) => {
              selectRefs.current[row.id] = node;
            }}
          >
            <Select
              ariaLabel={row.title}
              value={aiConfig.model}
              onChange={(model) => onAIConfigChange({ ...aiConfig, model })}
              options={modelOptions}
              placeholder={t.aiSelectModel}
              size="sm"
              width={160}
            />
          </div>
        );

      case "apiKey":
        return (
          <input
            ref={(node) => {
              passwordRefs.current[row.id] = node;
            }}
            type="password"
            aria-label={row.title}
            value={aiConfig.apiKey}
            onChange={(event) =>
              onAIConfigChange({ ...aiConfig, apiKey: event.target.value })
            }
            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
            className="h-8 w-[240px] rounded-md border border-input bg-background px-2 text-xs"
          />
        );

      case "danger": {
        const target = CLEAR_TARGETS[row.id];
        return (
          <Button
            variant="secondary"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => target && setClearTarget(target)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.settingsClear}
          </Button>
        );
      }
    }
  };

  const activate = (row: SettingsRowModel) => {
    if (row.dangerous) return undefined;
    switch (row.control) {
      case "checkbox":
        // Delegation toggles the switch — that is what clicking the row means
        // on macOS, and clicking the checkbox itself is not double-counted
        // (SettingsRow ignores clicks that land on a control).
        return () => checkboxRefs.current[row.id]?.click();
      case "number":
        return () => numberRefs.current[row.id]?.focus();
      case "apiKey":
        return () => passwordRefs.current[row.id]?.focus();
      // Every dropdown focuses its combobox, which opens it (`Select` opens on
      // focus) — the delimiter one has to be in this list too, or clicking its
      // row did nothing while the AI dropdowns worked.
      case "delimiter":
      case "provider":
      case "model":
        return focusSelect(row.id);
      case "action":
        return onResetOnboarding;
      case "disclosure":
        return () => setCustomExpanded((open) => !open);
      // Danger rows already returned above (`if (row.dangerous)`), but the kind
      // is still part of the union — listing it keeps the switch exhaustive.
      case "danger":
        return undefined;
      // A three-way picker has no single "activate" meaning, so its row stays
      // inert. Listing it explicitly (instead of a `default`) makes the switch
      // exhaustive: a new control kind cannot silently end up inert.
      case "language":
      case "theme":
        return undefined;
      default: {
        const unhandled: never = row.control;
        return unhandled;
      }
    }
  };

  return (
    // `flex-1 min-h-0`, not `h-full`: this pane sits *below* the dialog's search
    // bar in a flex column, so `height: 100%` would measure the parent's full
    // height and push the bottom ~53px of the list outside the dialog's clip.
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <ScrollArea
        ref={scrollRootRef}
        className="min-h-0 flex-1"
        hideHorizontalScrollbar
        blockContent
      >
        {/* `pb-16` leaves room for the dialog's floating footer buttons, which
            sit over this pane's bottom-centre (design 030 §4.1). */}
        <div
          className="px-4 pb-16"
          onContextMenu={(event) => event.preventDefault()}
        >
          {groups.map((group) => (
            <section key={group.id}>
              {/* Deliberately **no** z-index: `position: sticky` already paints
                  the heading above the (static) rows, and the scroll bar is a
                  sibling that comes later in the DOM — so it stays on top. With
                  a z-index here the heading (which spans to the right edge, the
                  bar's track) painted over the bar and made it disappear. */}
              {/* The plugin group renders itself: its rows are dynamic (one per
                  catalogue entry) and it owns the catalogue once, so the heading
                  summary and the rows cannot disagree. */}
              {group.summary === "plugins" ? (
                <section className="mb-6">
                  <PluginSection
                    sectionId={sectionElementId(group.id)}
                    name={group.name}
                    showToast={showToast}
                  />
                </section>
              ) : (
                <section className="mb-6">
                  <SettingsSectionHeading
                    id={sectionElementId(group.id)}
                    name={group.name}
                  />
                  <SettingsGroupCard>
                    {group.rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <SettingsRow
                          id={row.id}
                          title={row.title}
                          description={row.description}
                          highlight={query}
                          onActivate={activate(row)}
                        >
                          {renderControl(row)}
                        </SettingsRow>

                        {row.id === "ai-custom-provider" && customExpanded && (
                          <div className="space-y-3 border-b border-border/60 bg-muted/20 px-3 py-3">
                            <div>
                              <label className="block text-[11.5px] font-medium">
                                {t.aiProviderName}
                              </label>
                              <input
                                type="text"
                                value={aiConfig.providerName || ""}
                                onChange={(event) =>
                                  onAIConfigChange({
                                    ...aiConfig,
                                    providerName: event.target.value,
                                  })
                                }
                                placeholder="Provider"
                                className="mt-1 h-8 w-[280px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <label className="block text-[11.5px] font-medium">
                                {t.aiBaseUrl}
                              </label>
                              <input
                                type="text"
                                value={aiConfig.baseUrl}
                                onChange={(event) =>
                                  onAIConfigChange({
                                    ...aiConfig,
                                    baseUrl: event.target.value,
                                  })
                                }
                                placeholder="https://api.example.com/v1"
                                className="mt-1 h-8 w-full max-w-[420px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                            <div>
                              <span className="block text-[11.5px] font-medium">
                                {t.aiModels}
                              </span>
                              <div className="mt-1 space-y-2">
                                {(aiConfig.models && aiConfig.models.length > 0
                                  ? aiConfig.models
                                  : [""]
                                ).map((model, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center gap-2"
                                  >
                                    <input
                                      type="text"
                                      value={model}
                                      onChange={(event) => {
                                        const models = [
                                          ...(aiConfig.models &&
                                          aiConfig.models.length > 0
                                            ? aiConfig.models
                                            : [""]),
                                        ];
                                        models[index] = event.target.value;
                                        updateCustomModels(models);
                                      }}
                                      placeholder="Kimi-K2.6"
                                      className="h-8 w-[240px] rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      aria-label={t.remove}
                                      onClick={() => {
                                        const models = [
                                          ...(aiConfig.models || []),
                                        ];
                                        models.splice(index, 1);
                                        updateCustomModels(models);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="mt-2"
                                onClick={() =>
                                  updateCustomModels([
                                    ...(aiConfig.models || []),
                                    "",
                                  ])
                                }
                              >
                                <Plus className="h-3 w-3" />
                                {t.aiAddModel}
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Where to get a token / check the balance — only the
                        built-in providers have a console to point at. */}
                        {row.id === "ai-api-key" &&
                          isBuiltinProvider(aiConfig.provider) && (
                            <div className="flex flex-wrap items-center gap-4 border-b border-border/60 px-3 py-2 text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  open(
                                    aiConfig.provider === "deepseek"
                                      ? "https://platform.deepseek.com/api_keys"
                                      : aiConfig.provider === "qwen"
                                        ? "https://bailian.console.aliyun.com/?apiKey=1"
                                        : "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
                                  )
                                }
                                className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
                              >
                                {t.aiGetToken}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  open(
                                    aiConfig.provider === "deepseek"
                                      ? "https://platform.deepseek.com/account_topup"
                                      : aiConfig.provider === "qwen"
                                        ? "https://bailian.console.aliyun.com/"
                                        : "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
                                  )
                                }
                                className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
                              >
                                {t.aiCheckBalance}
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                      </React.Fragment>
                    ))}
                  </SettingsGroupCard>
                </section>
              )}
            </section>
          ))}

          {groups.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-xs text-foreground">
                {t.settingsSearchEmpty.replace("{query}", query)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t.settingsSearchEmptyHint}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {clearTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[min(400px,calc(100vw-32px))] rounded-lg bg-background p-4">
            <h3 className="mb-2 text-lg font-medium">
              {t.aiClearConfirmTitle}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {t.aiClearConfirmDesc}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setClearTarget(null)}
                disabled={clearing}
              >
                {t.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleClearData}
                disabled={clearing}
              >
                {clearing ? "..." : t.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
