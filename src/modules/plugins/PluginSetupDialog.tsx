import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n";
import {
  describePluginError,
  getPluginCatalog,
  installPlugin,
  progressPercent,
  revealPaths,
  onPluginProgress,
  type PluginProgress,
} from "@/services/plugins";

interface PluginSetupDialogProps {
  onClose: () => void;
  /** Fired after xan is in place, so the app can re-check its own state. */
  onInstalled?: () => void;
}

/**
 * Startup guidance for a missing xan.
 *
 * The app is built around xan: without it almost every command fails with an
 * obscure "no such file" from a spawned process. This dialog turns that into a
 * one-click install, and — because the download can be unavailable (offline,
 * mainland network) — always offers the manual route as well.
 *
 * It does not go through `usePluginCatalog`: the dialog owns exactly one plugin
 * and must not pull the whole catalog into the settings page's state.
 */
export function PluginSetupDialog({
  onClose,
  onInstalled,
}: PluginSetupDialogProps) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState<PluginProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pluginDir, setPluginDir] = useState<string | null>(null);
  // Revealing the folder can take a moment on first launch: the backend
  // creates the (still missing) plugin directory before handing it to the OS
  // file manager. Keep the button disabled while that runs so a second click
  // does not queue another reveal.
  const [openingFolder, setOpeningFolder] = useState(false);

  // A dialog that cannot tell the user where to put the file manually is only
  // half useful, so the path is resolved as soon as it is needed.
  useEffect(() => {
    let cancelled = false;
    getPluginCatalog(false)
      .then((view) => {
        if (!cancelled) setPluginDir(view.plugin_dir);
      })
      .catch(() => {
        // The install path below still works; only the manual hint is lost.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    onPluginProgress((event) => {
      if (event.name !== "xan") return;
      setProgress(event);
    })
      .then((dispose) => {
        if (cancelled) dispose();
        else unlisten = dispose;
      })
      .catch(() => {
        // Without events the dialog simply shows no bar.
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setError(null);
    try {
      await installPlugin("xan");
      setDone(true);
      onInstalled?.();
    } catch (cause) {
      setError(describePluginError(cause));
    } finally {
      setInstalling(false);
    }
  }, [onInstalled]);

  const handleOpenFolder = useCallback(async () => {
    if (!pluginDir || openingFolder) return;
    setOpeningFolder(true);
    try {
      await revealPaths([pluginDir]);
    } catch (cause) {
      setError(describePluginError(cause));
    } finally {
      setOpeningFolder(false);
    }
  }, [pluginDir, openingFolder]);

  const percent = progress ? progressPercent(progress) : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-5 w-[min(460px,calc(100vw-32px))]">
        <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          {done ? t.pluginSetupInstalled : t.pluginSetupTitle}
        </h3>

        {!done && (
          <p className="text-sm text-muted-foreground mb-3">
            {t.pluginSetupDesc}
          </p>
        )}

        {installing && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                {progress?.phase === "verifying"
                  ? t.pluginVerifying
                  : t.pluginDownloading}
              </span>
              {percent !== null && <span>{percent}%</span>}
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${percent ?? 2}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive mb-3 break-words">{error}</p>
        )}

        {pluginDir && !done && (
          <p
            className="text-[11px] text-muted-foreground mb-3 break-all"
            title={pluginDir}
          >
            {pluginDir}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-3">
          {!done && (
            <Button
              variant="secondary"
              onClick={handleOpenFolder}
              disabled={installing || openingFolder || !pluginDir}
            >
              {t.pluginSetupOpenFolder}
            </Button>
          )}
          {done ? (
            <Button onClick={onClose}>{t.close}</Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={installing}
              >
                {t.pluginSetupLater}
              </Button>
              <Button onClick={handleInstall} disabled={installing}>
                {t.pluginSetupInstall}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
