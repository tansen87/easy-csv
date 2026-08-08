import { useState, useCallback, useRef } from "react";
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
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";
import { AIConfig, PROVIDERS, AVAILABLE_MODELS } from "@/services/ai/types";
import { loadProviderApiKey } from "@/services/ai";

interface SettingsTabContentProps {
  activeTab: "preference" | "general" | "ai";
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
          {activeTab === "preference" && (
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
            </div>
          )}

          {activeTab === "general" && (
            <div className="space-y-6">
              {/* Delimiter */}
              <div>
                <label className="block text-sm font-medium">
                  {t.csvDelimiter}
                </label>
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
                <label className="block text-sm font-medium">
                  {t.noHeaders}
                </label>
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
                    const typedProvider = provider as
                      | "deepseek"
                      | "qwen"
                      | "glm";
                    const newKey = await loadProviderApiKey(typedProvider);
                    onAIConfigChange({
                      ...aiConfig,
                      provider: typedProvider,
                      model:
                        AVAILABLE_MODELS[
                          provider as keyof typeof AVAILABLE_MODELS
                        ]?.[0]?.id || "",
                      apiKey: newKey,
                    });
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
                  options={(AVAILABLE_MODELS[aiConfig.provider] || []).map(
                    (m) => ({
                      label: m.name,
                      value: m.id,
                    }),
                  )}
                  placeholder={t.aiSelectModel}
                  size="sm"
                />
              </div>

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
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-3">
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
                  {(aiConfig.provider === "deepseek" ||
                    aiConfig.provider === "qwen" ||
                    aiConfig.provider === "glm") && (
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
