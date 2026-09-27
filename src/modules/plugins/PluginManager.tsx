import { useCallback, useState } from "react";
import { AlertCircle, FolderOpen, Loader2, Plug, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import { usePluginCatalog } from "@/hooks/usePluginCatalog";
import {
  describePluginError,
  revealPaths,
  type CatalogEntry,
} from "@/services/plugins";
import { DownloadPrefixSetting } from "./DownloadPrefixSetting";
import { PluginRow } from "./PluginRow";

interface PluginManagerProps {
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/**
 * The plugins tab of the settings dialog.
 *
 * Everything on screen comes from the signed catalog plus a local probe:
 * "available" is the publisher's decision, "installed"/"source" are this
 * machine's reality. The tab never downloads on mount beyond the cached
 * manifest, so opening settings stays cheap.
 */
export function PluginManager({ showToast }: PluginManagerProps) {
  const { t } = useLanguage();
  const {
    view,
    entries,
    isLoading,
    isRefreshing,
    installing,
    busy,
    cancelling,
    isBusy,
    error,
    install,
    cancel,
    uninstall,
    refresh,
    reload,
    dismissError,
  } = usePluginCatalog({ showToast, auto: true });

  const [pendingUninstall, setPendingUninstall] = useState<CatalogEntry | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  // Revealing a path can take a moment when the backend has to create the
  // plugin directory first; disable the trigger(s) until it returns so
  // repeated clicks do not queue duplicate reveals.
  const [revealing, setRevealing] = useState(false);

  const handleReveal = useCallback(
    async (path: string) => {
      if (revealing) return;
      setRevealing(true);
      try {
        await revealPaths([path]);
      } catch (cause) {
        showToast(describePluginError(cause), "error");
      } finally {
        setRevealing(false);
      }
    },
    [revealing, showToast],
  );

  const handleOpenFolder = useCallback(async () => {
    if (!view?.plugin_dir || revealing) return;
    setRevealing(true);
    try {
      await revealPaths([view.plugin_dir]);
    } catch (cause) {
      showToast(describePluginError(cause), "error");
    } finally {
      setRevealing(false);
    }
  }, [view?.plugin_dir, revealing, showToast]);

  const handleConfirmUninstall = useCallback(async () => {
    if (!pendingUninstall) return;
    setConfirming(true);
    // A refusal is usually "not installed by this app"; the hook already raised
    // a toast with the backend's own explanation.
    await uninstall(pendingUninstall.name);
    setConfirming(false);
    setPendingUninstall(null);
  }, [pendingUninstall, uninstall]);

  const installedCount = entries.filter((entry) => entry.installed).length;

  return (
    <div className="space-y-6">
      {/* Header + refresh */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Plug className="h-4 w-4" />
              {t.plugins}
              {entries.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {installedCount}/{entries.length}
                </span>
              )}
            </h3>
            <p className="text-sm text-muted-foreground">{t.pluginDesc}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Tooltip content={t.pluginOpenFolder}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.pluginOpenFolder}
                disabled={!view?.plugin_dir || revealing}
                onClick={handleOpenFolder}
              >
                {revealing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FolderOpen className="h-3.5 w-3.5" />
                )}
              </Button>
            </Tooltip>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.pluginRefreshHint}
              disabled={isRefreshing || isBusy}
              onClick={refresh}
            >
              {t.pluginRefresh}
            </Button>
          </div>
        </div>

        {/* Offline is not an error: say so instead of rendering an empty page. */}
        {view?.stale && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            {t.pluginStaleHint}
          </p>
        )}
      </div>

      {/* Catalog-level failure. A cached view still renders below, so this is a
          banner rather than a full-page error state. */}
      {error && (
        <div className="flex items-start justify-between gap-3 border border-destructive/40 rounded-md p-3 bg-destructive/5">
          <div className="min-w-0">
            <p className="text-sm text-destructive">{t.pluginCatalogFailed}</p>
            <p className="text-xs text-muted-foreground mt-0.5 break-words">
              {error}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={reload}>
              {t.pluginRetry}
            </Button>
            <Button variant="ghost" size="sm" onClick={dismissError}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading && entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t.pluginLoadingCatalog}
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.pluginNone}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <PluginRow
              key={entry.name}
              entry={entry}
              progress={installing[entry.name]}
              busy={Boolean(busy[entry.name])}
              cancelling={Boolean(cancelling[entry.name])}
              revealing={revealing}
              onInstall={install}
              onCancel={cancel}
              onUninstall={setPendingUninstall}
              onReveal={handleReveal}
            />
          ))}
        </div>
      )}

      {/* Below the list: it only matters when a download is actually struggling. */}
      <DownloadPrefixSetting showToast={showToast} />

      {/* Uninstall confirmation */}
      {pendingUninstall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-4 w-[min(400px,calc(100vw-32px))]">
            <h3 className="text-lg font-medium mb-2">
              {t.pluginUninstallConfirmTitle}
            </h3>
            <p className="text-sm text-muted-foreground mb-1">
              {t.pluginUninstallConfirmDesc}
            </p>
            <p className="text-xs text-muted-foreground mb-3 break-all">
              {pendingUninstall.installed_path}
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="secondary"
                onClick={() => setPendingUninstall(null)}
                disabled={confirming}
              >
                {t.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmUninstall}
                disabled={confirming}
              >
                {confirming ? "..." : t.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
