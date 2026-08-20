import { useState, useCallback, useRef, useEffect } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Save,
  RotateCcw,
  Languages,
  SunMoon,
  Bell,
  Minimize2,
  Check,
  Bot,
  Key,
  Brain,
  ExternalLink,
  Trash2,
  Database,
  Server,
  Plus,
  X,
  Plug,
  RefreshCw,
  CircleCheck,
  CircleX,
  MousePointer2,
  SeparatorVertical,
  RectangleEllipsis,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";
import {
  AIConfig,
  PROVIDERS,
  AVAILABLE_MODELS,
  isBuiltinProvider,
} from "@/services/ai/types";
import { loadProviderApiKey } from "@/services/ai";
import { PluginInfo } from "@/types/xan";

interface SettingsTabContentProps {
  activeTab: "general" | "ai" | "plugins";
  theme: "dark" | "light" | "system";
  onThemeChange: (theme: "dark" | "light" | "system") => void;
  defaultDelimiter: string;
  onDefaultDelimiterChange: (delimiter: string) => void;
  noHeaders: boolean;
  onNoHeadersChange: (value: boolean) => void;
  systemNotification: boolean;
  onSystemNotificationChange: (value: boolean) => void;
  minimizeToTray: boolean;
  onMinimizeToTrayChange: (value: boolean) => void;
  doubleClickFitView: boolean;
  onDoubleClickFitViewChange: (value: boolean) => void;
  onSave: () => void;
  aiConfig: AIConfig;
  onAIConfigChange: (config: AIConfig) => void;
}

export function SettingsTabContent({
  activeTab,
  theme,
  onThemeChange,
  defaultDelimiter,
  onDefaultDelimiterChange,
  noHeaders,
  onNoHeadersChange,
  systemNotification,
  onSystemNotificationChange,
  minimizeToTray,
  onMinimizeToTrayChange,
  doubleClickFitView,
  onDoubleClickFitViewChange,
  onSave,
  aiConfig,
  onAIConfigChange,
}: SettingsTabContentProps) {
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaveClicked, setIsSaveClicked] = useState(false);
  const [isResetClicked, setIsResetClicked] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { language, setLanguage, t } = useLanguage();
  const [clearTarget, setClearTarget] = useState<
    "conversations" | "feedback" | "corrections" | null
  >(null);
  const [clearing, setClearing] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [checkingPlugins, setCheckingPlugins] = useState(false);

  const loadPlugins = useCallback(async () => {
    setPluginsLoading(true);
    try {
      const statuses = await invoke<PluginInfo[]>("check_plugins");
      setPlugins(statuses || []);
    } catch (error) {
      console.error("Failed to check plugins:", error);
      try {
        const list = await invoke<PluginInfo[]>("list_plugins");
        setPlugins(list || []);
      } catch (err) {
        console.error("Failed to load plugins:", err);
      }
    } finally {
      setPluginsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "plugins") {
      loadPlugins();
    }
  }, [activeTab, loadPlugins]);

  const handleCheckPlugins = useCallback(async () => {
    setCheckingPlugins(true);
    try {
      const statuses = await invoke<PluginInfo[]>("check_plugins");
      setPlugins(statuses || []);
    } catch (error) {
      console.error("Failed to check plugins:", error);
    } finally {
      setCheckingPlugins(false);
    }
  }, []);

  const updateCustomModels = useCallback(
    (models: string[]) => {
      const cleaned = models.map((m) => m.trim()).filter((m) => m.length > 0);
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

  const handleClearData = useCallback(async () => {
    if (!clearTarget) return;
    setClearing(true);
    try {
      const cmdMap = {
        conversations: "clear_conversations",
        feedback: "clear_feedback",
        corrections: "clear_corrections",
      };
      await invoke(cmdMap[clearTarget]);
    } catch (error) {
      console.error("Failed to clear data:", error);
    } finally {
      setClearing(false);
      setClearTarget(null);
    }
  }, [clearTarget]);

  const handleThemeChange = useCallback(
    (newTheme: "dark" | "light" | "system") => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setIsThemeTransitioning(true);

      timeoutRef.current = setTimeout(() => {
        onThemeChange(newTheme);
        setIsThemeTransitioning(false);
      }, 50);
    },
    [onThemeChange],
  );

  return (
    <div
      className="h-full flex flex-col bg-background"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Content Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Language */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Languages className="h-4 w-4" />
                  {t.language}
                </h3>
                <div className="grid grid-cols-2 bg-muted/50 rounded-md p-0.5 border border-border/50 relative w-[200px]">
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out ${
                      language === "zh" ? "left-[calc(50%+1px)]" : "left-0.5"
                    }`}
                    style={{ width: "calc(50% - 1px)" }}
                  />
                  <button
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                      language === "en"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </button>
                  <button
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                      language === "zh"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setLanguage("zh")}
                  >
                    中文
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <SunMoon className="h-4 w-4" />
                  {t.theme}
                </h3>
                <div className="grid grid-cols-3 bg-muted/50 rounded-md border border-border/50 relative w-[300px]">
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out ${
                      theme === "dark"
                        ? "left-[calc(33.333%+1px)]"
                        : theme === "system"
                          ? "left-[calc(66.666%)]"
                          : "left-0.5"
                    }`}
                    style={{ width: "calc(33.333% - 1px)" }}
                  />
                  <button
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                      theme === "light"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    } ${isThemeTransitioning ? "pointer-events-none opacity-60" : ""}`}
                    onClick={() => handleThemeChange("light")}
                    disabled={isThemeTransitioning}
                  >
                    <Sun className="h-4 w-4" />
                    {t.light}
                  </button>
                  <button
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                      theme === "dark"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    } ${isThemeTransitioning ? "pointer-events-none opacity-60" : ""}`}
                    onClick={() => handleThemeChange("dark")}
                    disabled={isThemeTransitioning}
                  >
                    <Moon className="h-4 w-4" />
                    {t.dark}
                  </button>
                  <button
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                      theme === "system"
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    } ${isThemeTransitioning ? "pointer-events-none opacity-60" : ""}`}
                    onClick={() => handleThemeChange("system")}
                    disabled={isThemeTransitioning}
                  >
                    <Monitor className="h-4 w-4" />
                    {t.system}
                  </button>
                </div>
              </div>

              {/* Execution Notification */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  {t.systemNotification}
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemNotification}
                    onChange={(e) =>
                      onSystemNotificationChange(e.target.checked)
                    }
                    className="w-4 h-4 rounded border-input accent-foreground"
                  />
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      {t.systemNotificationDesc}
                    </p>
                  </div>
                </label>
              </div>

              {/* Minimize to Tray */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Minimize2 className="h-4 w-4" />
                  {t.minimizeToTray}
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={minimizeToTray}
                    onChange={(e) => onMinimizeToTrayChange(e.target.checked)}
                    className="w-4 h-4 rounded border-input accent-foreground"
                  />
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      {t.minimizeToTrayDesc}
                    </p>
                  </div>
                </label>
              </div>

              {/* Double-click Canvas to Fit View */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4" />
                  {t.doubleClickFitView}
                </h3>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={doubleClickFitView}
                    onChange={(e) =>
                      onDoubleClickFitViewChange(e.target.checked)
                    }
                    className="w-4 h-4 rounded border-input accent-foreground"
                  />
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">
                      {t.doubleClickFitViewDesc}
                    </p>
                  </div>
                </label>
              </div>

              {/* Delimiter */}
              <div className="w-1/3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <SeparatorVertical className="h-4 w-4" />
                  {t.csvDelimiter}
                </h3>
                <SearchableSelect
                  value={defaultDelimiter}
                  onChange={onDefaultDelimiterChange}
                  options={[
                    { label: "Comma (,)", value: "," },
                    { label: "Semicolon (;)", value: ";" },
                    { label: "Tab (\\t)", value: "\t" },
                    { label: "Pipe (|)", value: "|" },
                    { label: "Caret (^)", value: "^" },
                  ]}
                  placeholder={t.selectDelimiter}
                  size="sm"
                />
                <p className="text-sm text-muted-foreground">
                  {t.delimiterDesc}
                </p>
              </div>
              {/* No Headers */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <RectangleEllipsis className="h-4 w-4" />
                  {t.noHeaders}
                </h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noHeaders}
                    onChange={(e) => onNoHeadersChange(e.target.checked)}
                    className="w-4 h-4 rounded border-input accent-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    {t.noHeadersDesc}
                  </p>
                </label>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {t.aiProvider}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.aiProviderDesc}
                </p>
                <SearchableSelect
                  value={aiConfig.provider}
                  onChange={async (provider) => {
                    const typedProvider = provider as string;
                    const newKey = await loadProviderApiKey(typedProvider);
                    if (typedProvider === "custom") {
                      onAIConfigChange({
                        ...aiConfig,
                        provider: typedProvider,
                        apiKey: newKey,
                      });
                    } else {
                      const model =
                        AVAILABLE_MODELS[
                          typedProvider as keyof typeof AVAILABLE_MODELS
                        ]?.[0]?.id || "";
                      onAIConfigChange({
                        ...aiConfig,
                        provider: typedProvider,
                        model,
                        baseUrl: "",
                        apiKey: newKey,
                      });
                    }
                  }}
                  options={PROVIDERS.map((p) => ({
                    label: p.name,
                    value: p.id,
                  }))}
                  placeholder={t.aiSelectProvider}
                  size="sm"
                />
              </div>

              {/* Model Selection */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  {t.aiModel}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.aiModelDesc}
                </p>
                <SearchableSelect
                  value={aiConfig.model}
                  onChange={(model) => onAIConfigChange({ ...aiConfig, model })}
                  options={
                    isBuiltinProvider(aiConfig.provider)
                      ? (
                          AVAILABLE_MODELS[
                            aiConfig.provider as keyof typeof AVAILABLE_MODELS
                          ] || []
                        ).map((m) => ({
                          label: m.name,
                          value: m.id,
                        }))
                      : (aiConfig.models || [])
                          .map((m) => m.trim())
                          .filter((m) => m.length > 0)
                          .map((m) => ({
                            label: m,
                            value: m,
                          }))
                  }
                  placeholder={t.aiSelectModel}
                  size="sm"
                />
              </div>

              {/* Custom Provider Settings (only when provider is custom) */}
              {aiConfig.provider === "custom" && (
                <div className="space-y-4 border rounded-md p-3 bg-muted/20">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    {t.aiCustomProviderSettings}
                  </h3>
                  <div>
                    <label className="block text-sm font-medium">
                      {t.aiProviderName}
                    </label>
                    <input
                      type="text"
                      value={aiConfig.providerName || ""}
                      onChange={(e) =>
                        onAIConfigChange({
                          ...aiConfig,
                          providerName: e.target.value,
                        })
                      }
                      placeholder="Provider"
                      className="w-full h-7 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      {t.aiBaseUrl}
                    </label>
                    <input
                      type="text"
                      value={aiConfig.baseUrl}
                      onChange={(e) =>
                        onAIConfigChange({
                          ...aiConfig,
                          baseUrl: e.target.value,
                        })
                      }
                      placeholder="https://api.example.com/v1"
                      className="w-full h-7 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring mt-1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {t.aiModels}
                    </label>
                    <div className="space-y-2">
                      {(aiConfig.models && aiConfig.models.length > 0
                        ? aiConfig.models
                        : [""]
                      ).map((model, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={model}
                            onChange={(e) => {
                              const models = [
                                ...(aiConfig.models &&
                                aiConfig.models.length > 0
                                  ? aiConfig.models
                                  : [""]),
                              ];
                              models[index] = e.target.value;
                              updateCustomModels(models);
                            }}
                            placeholder="Kimi-K2.6"
                            className="flex-1 h-7 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const models = [...(aiConfig.models || [])];
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
                        updateCustomModels([...(aiConfig.models || []), ""])
                      }
                    >
                      <Plus className="h-3 w-3" />
                      {t.aiAddModel}
                    </Button>
                  </div>
                </div>
              )}

              {/* API Key */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  {t.aiApiKey}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.aiApiKeyDesc}
                </p>
                <input
                  type="password"
                  value={aiConfig.apiKey}
                  onChange={(e) =>
                    onAIConfigChange({ ...aiConfig, apiKey: e.target.value })
                  }
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full h-7 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
                  {isBuiltinProvider(aiConfig.provider) && (
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
                      className="text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {t.aiGetToken}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                  {isBuiltinProvider(aiConfig.provider) && (
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
                      className="text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {t.aiCheckBalance}
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </p>
              </div>

              {/* AI Learning Data */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  {t.aiClearData}
                </h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {t.aiClearDataDesc}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setClearTarget("conversations")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.aiClearConversations}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setClearTarget("feedback")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.aiClearFeedback}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setClearTarget("corrections")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.aiClearCorrections}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "plugins" && (
            <div className="space-y-6">
              {/* Description + Check */}
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Plug className="h-4 w-4" />
                  {t.plugins}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {t.pluginDesc}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCheckPlugins}
                  disabled={checkingPlugins || pluginsLoading}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${checkingPlugins ? "animate-spin" : ""}`}
                  />
                  {checkingPlugins ? t.pluginChecking : t.pluginCheck}
                </Button>
              </div>

              {/* Plugin list */}
              <div>
                <h4 className="text-sm font-medium mb-2">
                  {t.plugins} ({plugins.length})
                </h4>
                {plugins.length === 0 && !pluginsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {t.pluginNone}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {plugins.map((plugin) => (
                      <div
                        key={plugin.name}
                        className="flex items-center justify-between gap-3 border rounded-md p-3 bg-muted/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {plugin.found ? (
                            <CircleCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <CircleX className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{plugin.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {plugin.version ? `${plugin.version}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              plugin.found
                                ? "bg-green-600/10 text-green-700"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {plugin.found ? t.pluginInstalled : t.pluginMissing}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 flex justify-end gap-2 shrink-0">
        <Button
          variant="secondary"
          onClick={() => {
            onThemeChange("light");
            onDefaultDelimiterChange(",");
            onNoHeadersChange(false);
            onSystemNotificationChange(true);
            onMinimizeToTrayChange(true);
            onDoubleClickFitViewChange(true);
            setIsResetClicked(true);
            if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = setTimeout(
              () => setIsResetClicked(false),
              3000,
            );
          }}
        >
          {isResetClicked ? (
            <Check className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {t.resetToDefaults}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            onSave();
            setIsSaveClicked(true);
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(
              () => setIsSaveClicked(false),
              3000,
            );
          }}
        >
          {isSaveClicked ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t.saveSettings}
        </Button>
      </div>

      {/* Clear Data Confirmation Dialog */}
      {clearTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-4 w-[min(400px,calc(100vw-32px))]">
            <h3 className="text-lg font-medium mb-2">
              {t.aiClearConfirmTitle}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t.aiClearConfirmDesc}
            </p>
            <div className="flex justify-end gap-2 mt-3">
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
