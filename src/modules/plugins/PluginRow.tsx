import { memo } from "react";
import {
  CircleCheck,
  CircleX,
  Download,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import { open } from "@tauri-apps/plugin-shell";
import {
  progressPercent,
  type CatalogEntry,
  type PluginSource,
} from "@/services/plugins";
import type { PluginInstallState } from "@/hooks/usePluginCatalog";

interface PluginRowProps {
  entry: CatalogEntry;
  /** Live download state, when an install is running for this plugin. */
  progress?: PluginInstallState;
  /** An install/uninstall is in flight and the row must not start another. */
  busy: boolean;
  /** The user has asked this download to stop and it is winding down. */
  cancelling?: boolean;
  /** A reveal (open in file manager) is in flight and must not be re-triggered. */
  revealing?: boolean;
  onInstall: (name: string) => void;
  onCancel: (name: string) => void;
  onUninstall: (entry: CatalogEntry) => void;
  onReveal: (path: string) => void;
}

/** Human-readable byte count. Plugin binaries are tens of megabytes. */
function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

function sourceLabel(
  source: PluginSource | null,
  t: ReturnType<typeof useLanguage>["t"],
): string {
  switch (source) {
    case "registry":
      return t.pluginSourceRegistry;
    case "manual":
      return t.pluginSourceManual;
    case "path":
      return t.pluginSourcePath;
    default:
      return "";
  }
}

/**
 * One catalog entry.
 *
 * What the row offers is driven by what the backend decided, not by the UI:
 * `available` means the catalog has an asset for this platform, `installed`
 * means a binary resolves, `source` says who owns it, and `update_available` is
 * only ever true for something this app installed. "Uninstall" therefore
 * disappears for a `path` or `manual` binary — deleting the user's own copy is
 * exactly what `uninstall_plugin` refuses to do.
 */
export const PluginRow = memo(function PluginRow({
  entry,
  progress,
  busy,
  cancelling = false,
  revealing = false,
  onInstall,
  onCancel,
  onUninstall,
  onReveal,
}: PluginRowProps) {
  const { t } = useLanguage();
  const percent = progress
    ? progressPercent({
        name: entry.name,
        phase: progress.phase,
        downloaded: progress.downloaded,
        total: progress.total,
      })
    : null;

  const installable = entry.available && !entry.installed;
  const updatable = entry.update_available;
  const removable = entry.installed && entry.source === "registry";

  const phaseLabel =
    progress?.phase === "verifying"
      ? t.pluginVerifying
      : progress?.phase === "done"
        ? t.pluginInstalled
        : t.pluginDownloading;

  return (
    <div className="border rounded-md p-3 bg-muted/20">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {entry.installed ? (
            <CircleCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <CircleX className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{entry.title}</p>
              {entry.required && (
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {t.pluginRequiredBadge}
                </span>
              )}
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${
                  entry.installed
                    ? "bg-green-600/10 text-green-700"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {entry.installed ? t.pluginInstalled : t.pluginMissing}
              </span>
              {updatable && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {t.pluginUpdateAvailable}
                </span>
              )}
            </div>

            {entry.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {entry.description}
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {/* Installed version is only known for something we installed;
                  otherwise show what the catalog offers. */}
              {entry.installed && entry.installed_version && (
                <span>v{entry.installed_version}</span>
              )}
              {!entry.installed && entry.latest_version && (
                <span>v{entry.latest_version}</span>
              )}
              {entry.source && <span>{sourceLabel(entry.source, t)}</span>}
              {entry.available && <span>{formatSize(entry.size)}</span>}
              {!entry.available && (
                <span className="text-destructive">{t.pluginMissing}</span>
              )}
            </p>

            {/* The path is useful when a binary came from PATH or was dropped in
                by hand — that is where a user has to go to update it. */}
            {entry.installed_path && !removable && (
              <p
                className="text-[11px] text-muted-foreground mt-1 truncate"
                title={entry.installed_path}
              >
                {entry.installed_path}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {entry.homepage && (
            <Tooltip content={t.pluginHomepage}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.pluginHomepage}
                onClick={() => open(entry.homepage)}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {entry.installed && entry.installed_path && (
            <Tooltip content={t.pluginOpenFolder}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={t.pluginOpenFolder}
                disabled={revealing}
                onClick={() => onReveal(entry.installed_path!)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {removable && (
            <Tooltip content={t.pluginUninstall}>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                aria-label={t.pluginUninstall}
                disabled={busy}
                onClick={() => onUninstall(entry)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          )}
          {installable && entry.available && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => onInstall(entry.name)}
            >
              {t.pluginDownload}
            </Button>
          )}
          {updatable && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => onInstall(entry.name)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t.pluginUpdate}
            </Button>
          )}
        </div>
      </div>

      {/* Progress replaces nothing else — it sits under the row so the version
          information stays readable while the bytes arrive. */}
      {progress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
            <span>{cancelling ? t.pluginCancelling : phaseLabel}</span>
            <div className="flex items-center gap-2">
              <span>
                {formatSize(progress.downloaded)}
                {progress.total > 0 ? ` / ${formatSize(progress.total)}` : ""}
                {percent !== null ? ` · ${percent}%` : ""}
              </span>
              {/* Cancel sits with the numbers because that is where the eye
                  already is while a slow download runs. */}
              {progress.phase === "downloading" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[11px]"
                  disabled={cancelling}
                  onClick={() => onCancel(entry.name)}
                >
                  <X className="h-3 w-3" />
                  {t.pluginCancel}
                </Button>
              )}
            </div>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{ width: `${percent ?? 2}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
});
