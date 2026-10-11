import { memo } from "react";
import {
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { useLanguage } from "@/i18n";
import { formatBytes } from "@/utils/format";
import { progressPercent, type CatalogEntry } from "@/services/plugins";
import type { PluginInstallState } from "@/hooks/usePluginCatalog";
import { SettingsRow } from "./SettingsRow";

interface PluginEntryRowProps {
  entry: CatalogEntry;
  /** Live download state, when an install is running for this plugin. */
  progress?: PluginInstallState;
  /** An install/uninstall is in flight and the row must not start another. */
  busy: boolean;
  cancelling?: boolean;
  /** A reveal (open in file manager) is in flight and must not be re-triggered. */
  revealing?: boolean;
  onInstall: (name: string) => void;
  onCancel: (name: string) => void;
  onUninstall: (entry: CatalogEntry) => void;
  onReveal: (path: string) => void;
}

/**
 * One catalogue entry, as a settings row.
 *
 * What the row offers is decided by the backend, not by the UI: `available`
 * means the catalogue has an asset for this platform, `installed` means a binary
 * resolves, `source` says who owns it, and `update_available` is only ever true
 * for something this app installed. "Uninstall" therefore disappears for a
 * `path` or `manual` binary — deleting the user's own copy is exactly what
 * `uninstall_plugin` refuses to do.
 *
 * The whole row is deliberately **not** clickable: it carries up to four
 * controls, so there is no single "activate" meaning, and delegating to a
 * download would fire 18 MB of traffic from a stray click.
 */
export const PluginEntryRow = memo(function PluginEntryRow({
  entry,
  progress,
  busy,
  cancelling = false,
  revealing = false,
  onInstall,
  onCancel,
  onUninstall,
  onReveal,
}: PluginEntryRowProps) {
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
  const size = entry.size && entry.size > 0 ? formatBytes(entry.size) : "";

  // The status is a single line of facts, in the order a reader asks them:
  // 必需 · 已安装 / 未安装 · 有可用更新 · 版本 · 来源 · 体积
  const status: string[] = [];
  if (entry.required) status.push(t.pluginRequiredBadge);
  status.push(entry.installed ? t.pluginInstalled : t.pluginMissing);
  if (progress) {
    status.push(
      `${cancelling ? t.pluginCancelling : progress.phase === "verifying" ? t.pluginVerifying : t.pluginDownloading} ${percent ?? 0}%`,
    );
  } else if (updatable) {
    status.push(t.pluginUpdateAvailable);
  }
  if (!progress) {
    if (entry.installed && entry.installed_version) {
      status.push(`v${entry.installed_version}`);
    } else if (!entry.installed && entry.latest_version) {
      status.push(`v${entry.latest_version}`);
    }
  }
  if (!entry.available) status.push(t.pluginMissing);
  if (size) status.push(size);

  return (
    <SettingsRow
      id={`plugin-${entry.name}`}
      title={entry.title}
      description={status.join(" · ")}
    >
      {/* The installed path is where a hand-dropped or PATH binary has to be
          updated, so it stays reachable from the row's folder button. */}
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
      {entry.installed_path && (
        <Tooltip content={t.pluginOpenFolder}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${t.pluginOpenFolder}: ${entry.title}`}
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
            aria-label={`${t.pluginUninstall}: ${entry.title}`}
            disabled={busy}
            onClick={() => onUninstall(entry)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
      {installable && (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => onInstall(entry.name)}
        >
          {t.pluginDownload}
        </Button>
      )}
      {updatable && !progress && (
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
      {/* Cancel sits with the numbers while a slow download runs. */}
      {progress && progress.phase === "downloading" && (
        <Button
          variant="secondary"
          size="sm"
          disabled={cancelling}
          onClick={() => onCancel(entry.name)}
        >
          <X className="h-3 w-3" />
          {t.pluginCancel}
        </Button>
      )}
    </SettingsRow>
  );
});
