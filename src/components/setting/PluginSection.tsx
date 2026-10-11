import { useCallback, useState } from "react";
import { AlertCircle, FolderOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import { usePluginCatalog } from "@/hooks/usePluginCatalog";
import {
  describePluginError,
  revealPaths,
  type CatalogEntry,
} from "@/services/plugins";
import { DownloadPrefixSetting } from "@/modules/plugins/DownloadPrefixSetting";
import { PluginEntryRow } from "./PluginEntryRow";
import { SettingsGroupCard } from "./SettingsGroupCard";
import { SettingsSectionHeading } from "./SettingsSectionHeading";

interface PluginSectionProps {
  /** Anchor id of the group, i.e. `sectionElementId("plugins")`. */
  sectionId: string;
  /** The group's display name. */
  name: string;
  showToast: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
}

/**
 * The plugin group.
 *
 * The group renders its own content instead of going through
 * `SettingsTabContent`'s generic row list, because its rows are **dynamic** —
 * one per catalogue entry. Everything on screen comes from the signed catalogue
 * plus a local probe, and the group owns the catalogue once so the heading
 * summary and the rows can never disagree.
 *
 * The heading carries the summary (`2/3 · [open folder] · [fetch latest]`), and
 * below it each plugin is an ordinary settings row: name · status · actions.
 * That was the point of the redesign — the pane used to embed a bespoke list
 * that matched nothing else in settings.
 */
export function PluginSection({
  sectionId,
  name,
  showToast,
}: PluginSectionProps) {
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
  // Revealing can take a moment when the backend has to create the plugin
  // directory first; disable the trigger(s) until it returns so repeated clicks
  // do not queue duplicate reveals.
  const [revealing, setRevealing] = useState(false);

  const reveal = useCallback(
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
    if (!view?.plugin_dir) return;
    await reveal(view.plugin_dir);
  }, [view?.plugin_dir, reveal]);

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
    <>
      <SettingsSectionHeading id={sectionId} name={name}>
        {/* Spans the rest of the heading: the count sits right after the group
            name, the two actions stay at the far right. */}
        <span className="flex flex-1 items-center justify-between gap-3">
          <span className="text-[11.5px] text-muted-foreground">
            {entries.length > 0 ? `${installedCount}/${entries.length}` : null}
          </span>
          <span className="flex flex-shrink-0 items-center gap-1.5">
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
          </span>
        </span>
      </SettingsSectionHeading>

      {/* Offline is not an error: say so instead of rendering an empty list. */}
      {view?.stale && (
        <p className="flex items-center gap-1.5 px-1 pb-2 text-[11.5px] text-muted-foreground">
          <AlertCircle className="h-3 w-3 flex-none" />
          {t.pluginStaleHint}
        </p>
      )}

      {/* A catalogue-level failure. A cached view still renders below, so this
          is a notice rather than a full-page error state. */}
      {error && (
        <div className="flex items-center gap-3 px-1 pb-2">
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-destructive">
            {t.pluginCatalogFailed} · {error}
          </p>
          <Button variant="secondary" size="sm" onClick={reload}>
            {t.pluginRetry}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissError}>
            {t.cancel}
          </Button>
        </div>
      )}

      <SettingsGroupCard>
      {isLoading && entries.length === 0 ? (
        <p className="py-3 text-[11.5px] text-muted-foreground">
          {t.pluginLoadingCatalog}
        </p>
      ) : entries.length === 0 ? (
        <p className="py-3 text-[11.5px] text-muted-foreground">
          {t.pluginNone}
        </p>
      ) : (
        entries.map((entry) => (
          <PluginEntryRow
            key={entry.name}
            entry={entry}
            progress={installing[entry.name]}
            busy={Boolean(busy[entry.name])}
            cancelling={Boolean(cancelling[entry.name])}
            revealing={revealing}
            onInstall={install}
            onCancel={cancel}
            onUninstall={setPendingUninstall}
            onReveal={reveal}
          />
        ))
      )}

      {/* Not a per-plugin thing: it is a transport hint for slow networks, so it
          is a row like every other setting. */}
      <DownloadPrefixSetting showToast={showToast} />
      </SettingsGroupCard>

      {pendingUninstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-[min(400px,calc(100vw-32px))] rounded-lg bg-background p-4">
            <h3 className="mb-2 text-lg font-medium">
              {t.pluginUninstallConfirmTitle}
            </h3>
            <p className="mb-1 text-sm text-muted-foreground">
              {t.pluginUninstallConfirmDesc}
            </p>
            <p className="mb-3 break-all text-xs text-muted-foreground">
              {pendingUninstall.installed_path}
            </p>
            <div className="mt-3 flex justify-end gap-2">
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
    </>
  );
}
