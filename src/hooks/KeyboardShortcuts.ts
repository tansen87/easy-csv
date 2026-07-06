import { useEffect } from 'react';

interface KeyboardShortcutCallbacks {
  onOpenFile: () => void;
  onOpenNewTabWithFile: () => void;
  onSavePipeline: () => void;
  onImportPipeline: () => void;
  onExportPipeline: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExecute: () => void;
  onHelp: () => void;
  onCheckUpdate: () => void;
  onShowSettings: () => void;
}

interface KeyboardShortcutState {
  undoStackLength: number;
  redoStackLength: number;
  currentPipelineLength: number;
  isExecuting: boolean;
}

export function useKeyboardShortcuts(
  callbacks: KeyboardShortcutCallbacks,
  state: KeyboardShortcutState
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrl && e.key === 'o') {
        e.preventDefault();
        callbacks.onOpenFile();
      } else if (ctrl && e.key === 'n') {
        e.preventDefault();
        callbacks.onOpenNewTabWithFile();
      } else if (ctrl && e.key === 's') {
        e.preventDefault();
        if (state.currentPipelineLength > 0) callbacks.onSavePipeline();
      } else if (ctrl && e.key === 'i') {
        e.preventDefault();
        callbacks.onImportPipeline();
      } else if (ctrl && e.key === 'e') {
        e.preventDefault();
        if (state.currentPipelineLength > 0) callbacks.onExportPipeline();
      } else if (ctrl && e.key === 'z') {
        e.preventDefault();
        if (state.undoStackLength > 0) callbacks.onUndo();
      } else if (ctrl && e.key === 'y') {
        e.preventDefault();
        if (state.redoStackLength > 0) callbacks.onRedo();
      } else if (ctrl && e.key === 'r') {
        e.preventDefault();
        if (state.currentPipelineLength > 0 && !state.isExecuting) callbacks.onExecute();
      } else if (shift && e.key === 'H') {
        e.preventDefault();
        callbacks.onHelp();
      } else if (shift && e.key === 'C') {
        e.preventDefault();
        callbacks.onCheckUpdate();
      } else if (shift && e.key === 'S') {
        e.preventDefault();
        callbacks.onShowSettings();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callbacks, state]);
}
