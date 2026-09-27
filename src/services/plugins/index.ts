/**
 * Plugin catalog and in-app install service.
 *
 * The single place that talks to the plugin commands and to the
 * `plugin://progress` event, so components never `invoke` them directly and the
 * "what the backend promises" contract lives in one file.
 *
 * Everything that decides trust — fetching the manifest, verifying its minisign
 * signature, pinning each asset by size and sha256 — happens in Rust. This layer
 * only shapes the results for the UI and keeps the error strings readable.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** Upstream repository, for "where do these come from" links. */
export const PLUGIN_REPO_URL = "https://github.com/tansen87/easy-csv-plugins";

/** Where a resolved binary came from. Mirrors Rust's `source` field. */
export type PluginSource = "registry" | "manual" | "path";

/**
 * One plugin as listed in the signed catalog.
 *
 * Field names are snake_case because Rust's `CatalogEntry` derives `Serialize`
 * without a rename attribute, so this is literally what crosses the IPC bridge.
 * Spelling them camelCase here would compile and then silently read `undefined`.
 */
export interface CatalogEntry {
  name: string;
  title: string;
  description: string;
  homepage: string;
  license: string;
  /** The app is barely usable without it (xan). */
  required: boolean;
  /**
   * Version the catalog offers, or `null` when it has no asset for this
   * platform — in that case the plugin cannot be installed here at all.
   */
  latest_version: string | null;
  available: boolean;
  /** Download size in bytes, when available. */
  size: number | null;
  /** Whether a binary resolves at all (plugin directory or `PATH`). */
  installed: boolean;
  /** Only known for binaries this app installed. */
  installed_version: string | null;
  installed_path: string | null;
  source: PluginSource | null;
  /** Only ever true for binaries this app installed, and only if semver says so. */
  update_available: boolean;
}

/** The whole catalog as the settings page needs it. Mirrors Rust `CatalogView`. */
export interface CatalogView {
  /** Unix seconds when the manifest was fetched. */
  fetched_at: number;
  /** The live fetch failed; this is the cached copy. */
  stale: boolean;
  /** Absolute path of the per-platform plugin directory. */
  plugin_dir: string;
  /** Platform directory name, e.g. `windows-x86_64`. */
  platform: string;
  entries: CatalogEntry[];
}

/** Install progress pushed over `plugin://progress`. */
export interface PluginProgress {
  name: string;
  phase: "downloading" | "verifying" | "done" | "cancelled" | "failed";
  downloaded: number;
  total: number;
}

/**
 * Sentinel the backend rejects with when the user cancelled.
 *
 * Kept as a constant so callers compare against one value instead of matching on
 * wording; the backend uses this exact string so a deliberate cancellation is
 * never rendered as an error.
 */
export const INSTALL_CANCELLED = "cancelled";

/** A registered plugin's availability. Mirrors Rust `PluginStatus`. */
export interface PluginStatus {
  name: string;
  executable: string;
  found: boolean;
  version: string;
}

/** Name of the progress event, kept in sync with Rust `PROGRESS_EVENT`. */
export const PROGRESS_EVENT = "plugin://progress";

/**
 * Loads the catalog.
 *
 * `refresh: true` forces a network round trip; otherwise a cached manifest is
 * reused for up to twelve hours, which is what makes opening the settings tab
 * cheap. Being offline is not an error as long as something was cached before —
 * the view then comes back with `stale: true`.
 */
export async function getPluginCatalog(refresh = false): Promise<CatalogView> {
  return invoke<CatalogView>("get_plugin_catalog", { refresh });
}

/**
 * Downloads, verifies and places a plugin, returning its status afterwards.
 *
 * The backend refreshes the manifest first, then verifies the download against
 * the size and sha256 pinned in the signed catalog. A failure leaves nothing
 * behind: the partial file dies in `.staging`.
 */
export async function installPlugin(name: string): Promise<PluginStatus> {
  return invoke<PluginStatus>("install_plugin", { name });
}

/**
 * Deletes a plugin this app installed.
 *
 * Refuses for a binary that resolves to `PATH` or that was dropped into the
 * plugin directory by hand — those belong to the user's package manager.
 */
export async function uninstallPlugin(name: string): Promise<void> {
  return invoke<void>("uninstall_plugin", { name });
}

/**
 * Asks an in-flight download to stop.
 *
 * The backend checks the flag between chunks, so cancellation is not instant —
 * it takes effect within one chunk. Resolves `false` when nothing was running,
 * which is not an error: the UI races with the final chunk.
 */
export async function cancelPluginInstall(name: string): Promise<boolean> {
  return invoke<boolean>("cancel_plugin_install", { name });
}

/** Whether an error means the user cancelled rather than something failing. */
export function isInstallCancelled(error: unknown): boolean {
  return describePluginError(error) === INSTALL_CANCELLED;
}

/** Registered plugins and whether each binary resolves. */
export async function checkPlugins(): Promise<PluginStatus[]> {
  return invoke<PluginStatus[]>("check_plugins");
}

/** Registered plugins without probing them (no subprocess spawned). */
export async function listPlugins(): Promise<PluginStatus[]> {
  return invoke<PluginStatus[]>("list_plugins");
}

/**
 * Whether xan is available at all.
 *
 * The app is built around xan, so a missing binary has to be surfaced instead of
 * failing later with an obscure pipeline error.
 */
export async function isXanInstalled(): Promise<boolean> {
  return invoke<boolean>("check_xan_installed");
}

/**
 * The user's download proxy prefix, or `null` when unset.
 *
 * Purely a transport hint for plugin downloads: it is prepended to each asset
 * URL and tried before the direct one. Integrity does not depend on it — every
 * download is checked against the size and sha256 pinned in the signed catalog,
 * so a proxy can make a download fail but never make it wrong.
 */
export async function getPluginDownloadPrefix(): Promise<string | null> {
  return invoke<string | null>("get_plugin_download_prefix");
}

/**
 * Stores or clears the download proxy prefix.
 *
 * Pass `null` (or an empty string) to go back to using the catalog's own URLs.
 * The backend rejects anything that is not an `https://` prefix, so a typo
 * surfaces here instead of at download time.
 */
export async function setPluginDownloadPrefix(prefix: string | null): Promise<void> {
  return invoke("set_plugin_download_prefix", { prefix });
}

/** Reveals one or more paths in the OS file manager. */
export async function revealPaths(paths: string[]): Promise<void> {
  return invoke("reveal_paths", { paths });
}

/**
 * Subscribes to install progress.
 *
 * Progress carries the plugin name, so a page with several installs can route
 * each event to the right row. Resolves with the unlisten function.
 */
export function onPluginProgress(
  handler: (progress: PluginProgress) => void,
): Promise<UnlistenFn> {
  return listen<PluginProgress>(PROGRESS_EVENT, (event) => handler(event.payload));
}

/**
 * Normalises a rejected `invoke`.
 *
 * Tauri rejects with a plain string for `Err(String)` commands, with an `Error`
 * for IPC failures, and occasionally with something else entirely — the UI must
 * never render `[object Object]`.
 */
export function describePluginError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    try {
      return JSON.stringify(error);
    } catch {
      // fall through
    }
  }
  return String(error);
}

/** Percentage for a progress bar, or `null` while the total is unknown. */
export function progressPercent(progress: PluginProgress): number | null {
  if (progress.total <= 0) return null;
  return Math.min(100, Math.round((progress.downloaded / progress.total) * 100));
}
