import { useEffect, useRef } from "react";

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
  onCommands: () => void;
  onLogs: () => void;
  onDataProfile: () => void;
}

interface KeyboardShortcutState {
  undoStackLength: number;
  redoStackLength: number;
  currentPipelineLength: number;
  isExecuting: boolean;
}

export function useKeyboardShortcuts(
  callbacks: KeyboardShortcutCallbacks,
  state: KeyboardShortcutState,
) {
  const callbacksRef = useRef(callbacks);
  const stateRef = useRef(state);

  callbacksRef.current = callbacks;
  stateRef.current = state;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const key = e.key.toLowerCase();

      if (ctrl && key === "o") {
        e.preventDefault();
        callbacksRef.current.onOpenFile();
      } else if (ctrl && key === "n") {
        e.preventDefault();
        callbacksRef.current.onOpenNewTabWithFile();
      } else if (ctrl && key === "s") {
        e.preventDefault();
        if (stateRef.current.currentPipelineLength > 0)
          callbacksRef.current.onSavePipeline();
      } else if (ctrl && key === "i") {
        e.preventDefault();
        callbacksRef.current.onImportPipeline();
      } else if (ctrl && key === "e") {
        e.preventDefault();
        if (stateRef.current.currentPipelineLength > 0)
          callbacksRef.current.onExportPipeline();
      } else if (ctrl && key === "z") {
        e.preventDefault();
        if (stateRef.current.undoStackLength > 0) callbacksRef.current.onUndo();
      } else if (ctrl && key === "y") {
        e.preventDefault();
        if (stateRef.current.redoStackLength > 0) callbacksRef.current.onRedo();
      } else if (ctrl && key === "r") {
        e.preventDefault();
        if (
          stateRef.current.currentPipelineLength > 0 &&
          !stateRef.current.isExecuting
        )
          callbacksRef.current.onExecute();
      } else if (shift && e.key === "h") {
        e.preventDefault();
        callbacksRef.current.onHelp();
      } else if (shift && e.key === "c") {
        e.preventDefault();
        callbacksRef.current.onCheckUpdate();
      } else if (shift && e.key === "s") {
        e.preventDefault();
        callbacksRef.current.onShowSettings();
      } else if (alt && key === "c") {
        e.preventDefault();
        callbacksRef.current.onCommands();
      } else if (alt && key === "q") {
        e.preventDefault();
        callbacksRef.current.onLogs();
      } else if (alt && key === "d") {
        e.preventDefault();
        callbacksRef.current.onDataProfile();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
