import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/Button";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Select } from "@/components/ui/Select";
import { DelimiterModeSelect } from "@/components/ui/DelimiterModeSelect";
import { PluginSection } from "./PluginSection";
import { SettingsGroupCard } from "./SettingsGroupCard";
import { SettingsSectionHeading } from "./SettingsSectionHeading";
import { SettingsSwitch } from "./SettingsSwitch";
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
import { ACCENTS, type Accent } from "./ThemeProvider";
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
  accent: Accent;
  onAccentChange: (accent: Accent) => void;
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

/**
 * The header of the sample file the app ships with
 * (`src-tauri/samples/easy-csv-sample-sales.csv`), shown under the delimiter
 * setting so the choice explains itself: switch to `;` and the line collapses
 * to one column. Kept in sync by hand - the dialog has no file open, so there
 * is nothing to read it from.
 */
const SAMPLE_HEADER = "日期,地区,品类,金额,数量";

/**
 * Shared segmented picker (language / theme).
 *
 * 040 §3: the thumb is positioned by `transform` and sized by `width`, both
 * fixed, so the only animated property is `transform`. The old version animated
 * `left` (a layout property) through `transition-all`, which stuttered and made
 * every neighbouring style change a candidate for animation.
 */
function SegmentChoice<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  width = 280,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  width?: number;
}) {
  const columns = options.length;
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative grid h-8 rounded-lg border border-border/60 bg-muted p-0.5"
      style={{
        width,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      <div
        className="absolute top-0.5 left-0.5 h-7 rounded-md bg-primary transition-transform duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${columns})`,
          transform: `translateX(${index * 100}%)`,
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
            "relative z-10 rounded-md text-[11.5px] font-medium transition-colors",
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

/**
 * The four accent presets as real colour chips (040 §3, the screen's one
 * colourful moment). The colour itself comes from `index.css`
 * (`[data-swatch="…"]`), which owns every accent value - the component only
 * picks which preset to show.
 */
function AccentChips({
  value,
  onChange,
  labels,
  ariaLabel,
}: {
  value: Accent;
  onChange: (value: Accent) => void;
  labels: Record<Accent, string>;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex items-center">
      <span className="mr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
        {labels[value]}
      </span>
      <div className="flex items-center gap-2.5">
        {ACCENTS.map((preset) => (
          <button
            key={preset}
            type="button"
            role="radio"
            aria-checked={preset === value}
            aria-label={labels[preset]}
            data-swatch={preset}
            onClick={() => onChange(preset)}
            className={cn(
              "h-5 w-5 rounded-[5px] outline outline-1 outline-offset-2",
              "transition-[outline-color]",
              "focus-visible:outline-2 focus-visible:outline-ring",
              preset === value ? "outline-foreground" : "outline-transparent",
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function SettingsTabContent({
  groups,
  query,
  scrollRootRef,
  theme,
  onThemeChange,
  accent,
  onAccentChange,
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
  const [keyVisible, setKeyVisible] = useState(false);
  const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const numberRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const passwordRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const switchRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
          <SettingsSwitch
            ref={(node) => {
              switchRefs.current[row.id] = node;
            }}
            checked={checked}
            onChange={change}
            label={row.title}
          />
        );
      }

      case "number":
        return (
          <div className="flex h-8 items-center overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              aria-label={t.settingsDecrease}
              disabled={maxConcurrentRuns <= 1}
              onClick={() =>
                onMaxConcurrentRunsChange(Math.max(1, maxConcurrentRuns - 1))
              }
              className="flex h-full w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Minus className="h-3 w-3" />
            </button>
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
              className="h-full w-9 border-x border-border/60 bg-transparent text-center font-mono text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label={t.settingsIncrease}
              disabled={maxConcurrentRuns >= 16}
              onClick={() =>
                onMaxConcurrentRunsChange(Math.min(16, maxConcurrentRuns + 1))
              }
              className="flex h-full w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
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

      case "accent":
        return (
          <AccentChips
            ariaLabel={row.title}
            value={accent}
            onChange={onAccentChange}
            labels={{
              ink: t.accentInk,
              teal: t.accentTeal,
              clay: t.accentClay,
              graphite: t.accentGraphite,
            }}
          />
        );

      case "action":
        return (
          <Button variant="secondary" size="sm" onClick={onResetOnboarding}>
            {t.settingsShowAgain}
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
          <div className="flex h-8 w-[280px] items-center rounded-lg border border-border bg-card pl-2.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
            <input
              ref={(node) => {
                passwordRefs.current[row.id] = node;
              }}
              type={keyVisible ? "text" : "password"}
              aria-label={row.title}
              value={aiConfig.apiKey}
              onChange={(event) =>
                onAIConfigChange({ ...aiConfig, apiKey: event.target.value })
              }
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
            />
            {/* A masked key you cannot read back is a key you retype. */}
            <button
              type="button"
              aria-label={keyVisible ? t.settingsHideKey : t.settingsShowKey}
              onClick={() => setKeyVisible((visible) => !visible)}
              className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {keyVisible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        );

      case "danger": {
        const target = CLEAR_TARGETS[row.id];
        return (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => target && setClearTarget(target)}
          >
            {t.settingsClear}
          </Button>
        );
      }
    }
  };

  /**
   * The description column's second line (design 040 §3).
   *
   * Both cases used to be **extra rows** in the card - a bordered sub-row under
   * the delimiter and another under the API key - which made two settings 60px
   * tall for reasons unrelated to their controls. As a second line they cost 16px
   * and stay attached to what they explain.
   */
  const renderExtra = (row: SettingsRowModel) => {
    if (row.id === "delimiter") {
      const separator = delimiterMode === "auto" ? "," : delimiterMode;
      const cells = SAMPLE_HEADER.split(separator);
      const splits = cells.length > 1;
      return (
        <span className="mt-1 flex items-center gap-2 font-mono text-[10.5px] leading-none text-muted-foreground">
          <span className="flex min-w-0 items-center overflow-hidden rounded border border-border">
            {cells.map((cell, index) => (
              <span
                key={index}
                className="max-w-[180px] truncate border-r border-border px-1.5 py-0.5 last:border-r-0"
              >
                {cell.replace(/\t/g, "⇥")}
              </span>
            ))}
          </span>
          <span className={cn("shrink-0 tabular-nums", !splits && "text-destructive")}>
            {t.settingsSampleColumns.replace("{count}", String(cells.length))}
          </span>
        </span>
      );
    }

    // Where to get a token / check the balance - only the built-in providers
    // have a console to point at.
    if (row.id === "ai-api-key" && isBuiltinProvider(aiConfig.provider)) {
      const links = [
        {
          label: t.aiGetToken,
          url:
            aiConfig.provider === "deepseek"
              ? "https://platform.deepseek.com/api_keys"
              : aiConfig.provider === "qwen"
                ? "https://bailian.console.aliyun.com/?apiKey=1"
                : "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
        },
        {
          label: t.aiCheckBalance,
          url:
            aiConfig.provider === "deepseek"
              ? "https://platform.deepseek.com/account_topup"
              : aiConfig.provider === "qwen"
                ? "https://bailian.console.aliyun.com/"
                : "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
        },
      ];
      return (
        <span className="mt-1 flex items-center gap-4 text-[11.5px]">
          {links.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => open(link.url)}
              className="inline-flex cursor-pointer items-center gap-1 text-primary hover:underline"
            >
              {link.label}
              <ExternalLink className="h-3 w-3" />
            </button>
          ))}
        </span>
      );
    }

    return undefined;
  };

  const activate = (row: SettingsRowModel) => {
    if (row.dangerous) return undefined;
    switch (row.control) {
      case "checkbox":
        // Delegation toggles the switch - that is what clicking the row means
        // on macOS, and clicking the switch itself is not double-counted
        // (SettingsRow ignores clicks that land on a control).
        return () => switchRefs.current[row.id]?.click();
      case "number":
        return () => numberRefs.current[row.id]?.focus();
      case "apiKey":
        return () => passwordRefs.current[row.id]?.focus();
      // Every dropdown focuses its combobox, which opens it (`Select` opens on
      // focus) - the delimiter one has to be in this list too, or clicking its
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
      // is still part of the union - listing it keeps the switch exhaustive.
      case "danger":
        return undefined;
      // A segmented picker has no single "activate" meaning, so its row stays
      // inert. Listing it explicitly (instead of a `default`) makes the switch
      // exhaustive: a new control kind cannot silently end up inert.
      case "language":
      case "theme":
      case "accent":
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea
        ref={scrollRootRef}
        className="min-h-0 flex-1"
        hideHorizontalScrollbar
        blockContent
      >
        {/* `pb-6`, not the old `pb-16`: the actions moved out of an overlay and
            into a real footer band (design 040 §2), so the list no longer has
            to reserve room for buttons floating on top of it. */}
        <div
          className="px-6 pb-6"
          onContextMenu={(event) => event.preventDefault()}
        >
          {groups.map((group) => (
            <section key={group.id}>
              {/* Deliberately **no** z-index: `position: sticky` already paints
                  the heading above the (static) rows, and the scroll bar is a
                  sibling that comes later in the DOM - so it stays on top. With
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
                    index={group.index}
                    showToast={showToast}
                  />
                </section>
              ) : (
                <section className="mb-6">
                  <SettingsSectionHeading
                    id={sectionElementId(group.id)}
                    name={group.name}
                    index={group.index}
                  />
                  <SettingsGroupCard>
                    {group.rows.map((row) => (
                      <React.Fragment key={row.id}>
                        <SettingsRow
                          id={row.id}
                          title={row.title}
                          description={row.description}
                          highlight={query}
                          extra={renderExtra(row)}
                          onActivate={activate(row)}
                        >
                          {renderControl(row)}
                        </SettingsRow>

                        {row.id === "ai-custom-provider" && customExpanded && (
                          <div className="space-y-3 border-b border-border/60 bg-muted/30 px-4 py-3">
                            <div>
                              <label className="block text-xs font-medium">
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
                                className="mt-1 h-8 w-[280px] rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium">
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
                                className="mt-1 h-8 w-full max-w-[420px] rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                              />
                            </div>
                            <div>
                              <span className="block text-xs font-medium">
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
                                      className="h-8 w-[240px] rounded-lg border border-border bg-card px-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
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
        <div className="z-modal fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="w-[min(400px,calc(100vw-32px))] rounded-xl border border-border bg-card p-5 shadow-lg">
            <h3 className="mb-2 text-sm font-medium">
              {t.aiClearConfirmTitle}
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
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
