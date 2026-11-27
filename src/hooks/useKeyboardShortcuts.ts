import { useEffect, useRef } from "react";

import {
  SHORTCUT_ACTION_IDS,
  comboMatches,
  type ShortcutActionId,
  type ShortcutMap,
} from "@/lib/shortcuts";

interface KeyboardShortcutCallbacks {
  onOpenFile: () => void;
  onOpenNewTabWithFile: () => void;
  onSavePipeline: () => void;
  onImportPipeline: () => void;
  onExportPipeline: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExecute: () => void;
  onLogs: () => void;
  onAI: () => void;
  onCommandPalette: () => void;
  onOpenTemplates: () => void;
}

interface KeyboardShortcutState {
  undoStackLength: number;
  redoStackLength: number;
  currentPipelineLength: number;
  isExecuting: boolean;
}

/**
 * Global shortcut dispatcher (design 074 / 083). The bindings come from the
 * user-editable map; this hook only owns the dispatch rules:
 * - Ctrl F (the palette) keeps working while typing, but dialogs keep their own;
 * - every other shortcut yields to text fields;
 * - guarded actions stay no-ops when there is nothing to act on.
 */
export function useKeyboardShortcuts(
  callbacks: KeyboardShortcutCallbacks,
  state: KeyboardShortcutState,
  shortcuts: ShortcutMap,
) {
  const callbacksRef = useRef(callbacks);
  const stateRef = useRef(state);
  const shortcutsRef = useRef(shortcuts);

  callbacksRef.current = callbacks;
  stateRef.current = state;
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const map = shortcutsRef.current;
      const action: ShortcutActionId | undefined = SHORTCUT_ACTION_IDS.find(
        (id) => comboMatches(e, map[id]),
      );
      if (!action) return;

      // Design 074: Ctrl F is the only command-search shortcut. It works while
      // typing, but dialogs keep their own Ctrl+F (help search, etc.).
      if (action === "commandPalette") {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        callbacksRef.current.onCommandPalette();
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      e.preventDefault();
      const cb = callbacksRef.current;
      const current = stateRef.current;

      switch (action) {
        case "openFile":
          cb.onOpenFile();
          break;
        case "openNewTab":
          cb.onOpenNewTabWithFile();
          break;
        case "savePipeline":
          if (current.currentPipelineLength > 0) cb.onSavePipeline();
          break;
        case "importPipeline":
          cb.onImportPipeline();
          break;
        case "exportPipeline":
          if (current.currentPipelineLength > 0) cb.onExportPipeline();
          break;
        case "undo":
          if (current.undoStackLength > 0) cb.onUndo();
          break;
        case "redo":
          if (current.redoStackLength > 0) cb.onRedo();
          break;
        case "execute":
          if (current.currentPipelineLength > 0 && !current.isExecuting) {
            cb.onExecute();
          }
          break;
        case "openTemplates":
          cb.onOpenTemplates();
          break;
        case "toggleLogs":
          cb.onLogs();
          break;
        case "toggleAI":
          cb.onAI();
          break;
        default: {
          const unhandled: never = action;
          return unhandled;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
