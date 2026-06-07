import { useState } from "react";
import { Sun, Moon, Palette, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface SettingsTabContentProps {
  theme: "dark" | "light" | "animal-island" | "system";
  onThemeChange: (theme: "dark" | "light" | "animal-island" | "system") => void;
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Settings Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab("preference")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "preference"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Preference
        </button>
        <button
          onClick={() => setActiveTab("general")}
          className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "general"
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
              
              <div className="flex gap-4">
                {/* Light Theme */}
                <button
                  onClick={() => onThemeChange("light")}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    theme === "light"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                    <Sun className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Light</p>
                  </div>
                </button>

                {/* Dark Theme */}
                <button
                  onClick={() => onThemeChange("dark")}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    theme === "dark"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                    <Moon className="h-6 w-6 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Dark</p>
                  </div>
                </button>

                {/* Animal Island Theme */}
                <button
                  onClick={() => onThemeChange("animal-island")}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                    theme === "animal-island"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                    <Palette className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Animal Island</p>
                  </div>
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
                  className="w-4 h-4 rounded border-input"
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
                  className="w-4 h-4 rounded border-input"
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