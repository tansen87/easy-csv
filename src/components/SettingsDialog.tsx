import { useState } from "react";
import { X } from "lucide-react";
import { SettingsTabContent } from "@/components/SettingsTabContent";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

export function SettingsDialog({
  isOpen,
  onClose,
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
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"preference" | "general">("preference");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-none"
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="relative bg-card rounded-lg shadow-xl w-full max-w-2xl h-[48vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center">
            {/* Tab Switcher with sliding effect */}
            <div className="inline-flex bg-muted/50 rounded-md p-0.5 border border-border/50 relative h-8">
              <div
                className={`absolute top-0.5 bottom-0.5 left-0.5 right-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out ${
                  activeTab === "general" ? "translate-x-[calc(100%)]" : "translate-x-0"
                }`}
                style={{ width: "calc(50% + 4px)" }}
              />
              <button
                className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                  activeTab === "preference"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("preference")}
              >
                Preference
              </button>
              <button
                className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                  activeTab === "general"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("general")}
              >
                General
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(100%-48px)]">
          <SettingsTabContent
            activeTab={activeTab}
            theme={theme}
            onThemeChange={onThemeChange}
            defaultDelimiter={defaultDelimiter}
            onDefaultDelimiterChange={onDefaultDelimiterChange}
            noQuoting={noQuoting}
            onNoQuotingChange={onNoQuotingChange}
            noHeaders={noHeaders}
            onNoHeadersChange={onNoHeadersChange}
            onSave={onSave}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
