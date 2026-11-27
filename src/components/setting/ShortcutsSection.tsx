import { useEffect, useState } from "react";

import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SHORTCUT_ACTION_IDS,
  comboFromEvent,
  comboTokens,
  conflictingAction,
  isModifierOnly,
  isUsableCombo,
  shortcutsDiffer,
  type ShortcutActionId,
  type ShortcutMap,
} from "@/lib/shortcuts";
import { SettingsGroupCard } from "./SettingsGroupCard";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionHeading } from "./SettingsSectionHeading";
import type { SettingsTextKey } from "./settingsSections";

/** Reuses the labels the menus already use, so a binding never contradicts one. */
const LABEL_KEYS: Record<ShortcutActionId, SettingsTextKey> = {
  openFile: "openFile",
  openNewTab: "openNewTab",
  savePipeline: "savePipeline",
  importPipeline: "importWorkflow",
  exportPipeline: "exportWorkflow",
  undo: "undo",
  redo: "redo",
  execute: "execute",
  openTemplates: "newFromTemplate",
  commandPalette: "commandPalette",
  toggleLogs: "logPanel",
  toggleAI: "ai",
};

interface ShortcutsSectionProps {
  sectionId: string;
  name: string;
  index: number;
  shortcuts: ShortcutMap;
  onChange: (id: ShortcutActionId, combo: string) => void;
  onReset: () => void;
}

/**
 * Design 083: a keycap per row, recorded in place.
 *
 * The row keeps the settings dialog's rhythm (`SettingsRow`), so the shortcut
 * list reads as one more group rather than a separate tool. Recording takes
 * over the keyboard in the capture phase — the app's own dispatcher must not
 * fire while the user is typing their new binding — and Esc is the only way out.
 */
export function ShortcutsSection({
  sectionId,
  name,
  index,
  shortcuts,
  onChange,
  onReset,
}: ShortcutsSectionProps) {
  const { t } = useLanguage();
  const [recording, setRecording] = useState<ShortcutActionId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // Capture + stop: the recorded chord must never reach the app's global
      // shortcuts (Ctrl+S would otherwise save the pipeline mid-recording).
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecording(null);
        setError(null);
        return;
      }
      if (isModifierOnly(event)) return;

      const combo = comboFromEvent(event);
      if (!combo || !isUsableCombo(combo)) {
        setError(t.shortcutNeedsModifier);
        return;
      }
      const clash = conflictingAction(combo, shortcuts, recording);
      if (clash) {
        setError(
          t.shortcutConflict.replace("{action}", t[LABEL_KEYS[clash]]),
        );
        return;
      }
      onChange(recording, combo);
      setRecording(null);
      setError(null);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recording, shortcuts, onChange, t]);

  const changed = shortcutsDiffer(shortcuts);

  return (
    <>
      <SettingsSectionHeading id={sectionId} name={name} index={index} />
      <SettingsGroupCard>
        {SHORTCUT_ACTION_IDS.map((id) => {
          const isRecording = recording === id;
          return (
            <SettingsRow
              key={id}
              id={`shortcut-${id}`}
              title={t[LABEL_KEYS[id]]}
            >
              <button
                type="button"
                onClick={() => {
                  setRecording(id);
                  setError(null);
                }}
                aria-label={`${t[LABEL_KEYS[id]]}: ${
                  isRecording ? t.shortcutRecording : shortcuts[id]
                }`}
                className={cn(
                  "flex h-7 min-w-[84px] items-center justify-center rounded-md border px-2 font-mono text-[11px] transition-colors",
                  isRecording
                    ? "border-primary text-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {isRecording
                  ? t.shortcutRecording
                  : comboTokens(shortcuts[id]).join(" + ")}
              </button>
            </SettingsRow>
          );
        })}
      </SettingsGroupCard>
      <div className="mt-2 flex items-center justify-between gap-4">
        <span
          className={cn(
            "text-[11px]",
            error ? "text-danger" : "text-muted-foreground",
          )}
        >
          {error}
        </span>
        {changed && (
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t.shortcutResetAll}
          </button>
        )}
      </div>
    </>
  );
}
