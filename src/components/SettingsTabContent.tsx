import { useState, useCallback, useRef } from "react";
import { Sun, Moon, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface SettingsTabContentProps {
  theme: "dark" | "light" | "system";
  onThemeChange: (theme: "dark" | "light" | "system") => void;
  defaultDelimiter: string;
  onDefaultDelimiterChange: (delimiter: string) => void;
  noQuoting: boolean;
  onNoQuotingChange: (value: boolean) => void;
  noHeaders: boolean;
  onNoHeadersChange: (value: boolean) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function SettingsTabContent({
  theme,
  onThemeChange,
  defaultDelimiter,
  onDefaultDelimiterChange,
  noQuoting,
  onNoQuotingChange,
  noHeaders,
  onNoHeadersChange,
  onSave,
  isSaving,
}: SettingsTabContentProps) {
  const [activeTab, setActiveTab] = useState<"preference" | "general">("preference");
  const [isThemeTransitioning, setIsThemeTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleThemeChange = useCallback((newTheme: "dark" | "light" | "system") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setIsThemeTransitioning(true);

    timeoutRef.current = setTimeout(() => {
      onThemeChange(newTheme);
      setIsThemeTransitioning(false);
    }, 50);
  }, [onThemeChange]);

  return (
    <div className="h-full flex flex-col bg-background" onContextMenu={(e) => e.preventDefault()}>
      {/* Settings Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("preference")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "preference"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Preference
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === "general"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          General
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === "preference" && (
          <div className="space-y-6">
            <div className="max-w-md">
              <h3 className="text-lg font-semibold mb-4">Theme</h3>
              <div className="inline-flex bg-muted/50 rounded-md p-0.5 border border-border/50 relative">
                <div
                  className={`absolute top-0.5 bottom-0.5 left-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out ${
                    theme === "dark" ? "translate-x-[calc(100%+2px)]" : "translate-x-0"
                  }`}
                  style={{ width: "calc(50% - 2px)" }}
                />
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                    theme === "light"
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } ${isThemeTransitioning ? "pointer-events-none opacity-60" : ""}`}
                  onClick={() => handleThemeChange("light")}
                  disabled={isThemeTransitioning}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
                <button
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                    theme === "dark"
                      ? "text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  } ${isThemeTransitioning ? "pointer-events-none opacity-60" : ""}`}
                  onClick={() => handleThemeChange("dark")}
                  disabled={isThemeTransitioning}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "general" && (
          <div className="space-y-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">CSV Settings</h3>

            {/* Delimiter */}
            <div>
              <label className="block text-sm font-medium mb-2">
                CSV Delimiter
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
                placeholder="Select delimiter"
                size="sm"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Default delimiter for reading CSV files
              </p>
            </div>

            {/* No Headers */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noHeaders}
                  onChange={(e) => onNoHeadersChange(e.target.checked)}
                  className="w-4 h-4 rounded border-input accent-foreground"
                />
                <div className="text-left">
                  <p className="text-sm font-medium">No Headers</p>
                  <p className="text-sm text-muted-foreground">Indicate that input file has no headers</p>
                </div>
              </label>
            </div>

            {/* No Quoting */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noQuoting}
                  onChange={(e) => onNoQuotingChange(e.target.checked)}
                  className="w-4 h-4 rounded border-input accent-foreground"
                />
                <div className="text-left">
                  <p className="text-sm font-medium">Disable Quoting</p>
                  <p className="text-sm text-muted-foreground">Disable quoting completely for input command</p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4 flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            onThemeChange("light");
            onDefaultDelimiterChange(",");
            onNoQuotingChange(false);
            onNoHeadersChange(false);
          }}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
        <Button
          variant="outline"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
