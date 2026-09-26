import { useCallback, useEffect, useState } from "react";

import {
  checkForUpdate,
  getInstallForm,
  installUpdate,
  relaunchApp,
  type InstallFormInfo,
  type UpdateProgress,
  type UpdateSession,
} from "@/services/update";

/** Progress as rendered by the dialog. */
export interface UpdateProgressState {
  phase: "started" | "downloading" | "installing";
  downloaded: number;
  total: number | null;
}

interface UseUpdaterOptions {
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  /**
   * Persist user state immediately before the installer takes over. On Windows
   * the installer quits the app, so this is the last reliable moment to flush —
   * it is deliberately called here rather than from a Rust exit hook, which
   * cannot build the snapshot the frontend owns.
   */
  beforeInstall?: () => Promise<void> | void;
}

/**
 * Owns the auto-update state machine: silent/interactive checks, download
 * progress and the install hand-off. Dialog visibility stays with the caller,
 * because a silent check must not open a dialog on its own.
 */
export function useUpdater({ showToast, beforeInstall }: UseUpdaterOptions) {
  const [updateInfo, setUpdateInfo] = useState<UpdateSession | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState<UpdateProgressState | null>(null);
  const [installForm, setInstallForm] = useState<InstallFormInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Installing replaces files on disk; knowing the layout lets the dialog grey
  // out the button for builds the updater cannot write to (deb, /Applications).
  useEffect(() => {
    let cancelled = false;
    getInstallForm()
      .then((info) => {
        if (!cancelled) setInstallForm(info);
      })
      .catch(() => {
        // Detection is advisory — without it the dialog simply keeps the
        // button enabled and relies on the installer's own error reporting.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const check = useCallback(
    async (options?: { silent?: boolean }): Promise<UpdateSession | null> => {
      setIsChecking(true);
      setError(null);
      try {
        const session = await checkForUpdate();
        setUpdateInfo(session);
        // No success toast: the dialog already reports both outcomes, and a
        // silent check must stay silent.
        return session;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        // A silent check must never interrupt the user with a toast.
        if (!options?.silent) {
          showToast(`Failed to check for updates: ${message}`, "error");
        }
        return null;
      } finally {
        setIsChecking(false);
      }
    },
    [showToast],
  );

  const install = useCallback(async () => {
    const session = updateInfo;
    if (!session?.update) return;

    setIsInstalling(true);
    setError(null);
    setProgress({ phase: "started", downloaded: 0, total: null });

    try {
      await beforeInstall?.();

      await installUpdate(session, (event: UpdateProgress) => {
        setProgress((previous) => {
          switch (event.phase) {
            case "started":
              return { phase: "started", downloaded: 0, total: event.total };
            case "downloading":
              return {
                phase: "downloading",
                downloaded: event.downloaded,
                total: event.total,
              };
            case "installing":
              return {
                phase: "installing",
                downloaded: previous?.downloaded ?? 0,
                total: previous?.total ?? null,
              };
          }
        });
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      showToast(`Failed to install the update: ${message}`, "error");
      setIsInstalling(false);
      setProgress(null);
      return;
    }

    // Installed. Come back up in the new build; on Windows the installer may
    // already have exited the process, so a relaunch failure is not an error
    // and must not be reported as one.
    try {
      await relaunchApp();
    } catch (cause) {
      console.error("Relaunch after update failed:", cause);
    }
    setIsInstalling(false);
    setProgress(null);
  }, [updateInfo, beforeInstall, showToast]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    updateInfo,
    isChecking,
    isInstalling,
    progress,
    installForm,
    error,
    check,
    install,
    dismissError,
  };
}
