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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useLanguage } from "@/i18n";

interface SettingsTabContentProps {
  activeTab: "preference" | "general";
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
  historyLimit: number;
  onHistoryLimitChange: (limit: number) => void;
  onSave: () => void;
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
  historyLimit,
  onHistoryLimitChange,
  onSave,
}: SettingsTabContentProps) {
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { language, setLanguage, t } = useLanguage();

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
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "preference" && (
          <div className="space-y-6">
            {/* Language */}
            <div className="max-w-md">
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
            <div className="max-w-md">
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
            <div className="max-w-xl">
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
            <div className="max-w-xl">
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
          <div className="space-y-6 max-w-md">
            {/* Delimiter */}
            <div className="w-[220px]">
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
              <p className="text-sm text-muted-foreground">{t.delimiterDesc}</p>
            </div>
            {/* No Headers */}
            <div>
              <label className="block text-sm font-medium">{t.noHeaders}</label>
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
            {/* History Limit */}
            <div>
              <label className="block text-sm font-medium">
                {t.historyLimit}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={historyLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 0) {
                      onHistoryLimitChange(val);
                    }
                  }}
                  className="w-24 px-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  variant={historyLimit === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => onHistoryLimitChange(0)}
                  className="h-8 text-xs"
                >
                  {t.unlimited}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.historyLimitDesc}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            onThemeChange("light");
            onDefaultDelimiterChange(",");
            onNoHeadersChange(false);
            onSystemNotificationChange(true);
            onMinimizeToTrayChange(true);
            onHistoryLimitChange(100);
          }}
        >
          <RotateCcw className="h-4 w-4" />
          {t.resetToDefaults}
        </Button>
        <Button variant="secondary" onClick={onSave}>
          <Save className="h-4 w-4" />
          {t.saveSettings}
        </Button>
      </div>
    </div>
  );
}
