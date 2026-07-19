import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { SettingsTabContent } from "@/components/setting/SettingsTabContent";
import { useLanguage } from "@/i18n";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
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

export function SettingsDialog({
  isOpen,
  onClose,
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
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<"preference" | "general">(
    "preference",
  );
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-xs"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative bg-card rounded-lg shadow-xl w-full max-w-4xl h-[64vh] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
          <div className="flex items-center">
            <div className="grid grid-cols-2 bg-muted/50 rounded-md p-0.5 border border-border/50 relative h-8">
              <div
                className={`absolute top-0.5 bottom-0.5 rounded-md bg-primary shadow-sm transition-all duration-300 ease-out ${
                  activeTab === "general" ? "left-[calc(50%+1px)]" : "left-0.5"
                }`}
                style={{ width: "calc(50% - 1px)" }}
              />
              <button
                className={`flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                  activeTab === "preference"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("preference")}
              >
                {t.preference}
              </button>
              <button
                className={`flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 relative z-10 ${
                  activeTab === "general"
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("general")}
              >
                {t.general}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
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
            noHeaders={noHeaders}
            onNoHeadersChange={onNoHeadersChange}
            systemNotification={systemNotification}
            onSystemNotificationChange={onSystemNotificationChange}
            minimizeToTray={minimizeToTray}
            onMinimizeToTrayChange={onMinimizeToTrayChange}
            historyLimit={historyLimit}
            onHistoryLimitChange={onHistoryLimitChange}
            onSave={onSave}
          />
        </div>
      </div>
    </div>
  );
}
