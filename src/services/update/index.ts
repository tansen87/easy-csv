/**
 * Auto-update service (design 022).
 *
 * The single place that talks to `@tauri-apps/plugin-updater` and
 * `@tauri-apps/plugin-process`, so UI code never imports them directly and the
 * "who may self-update" rule stays in one spot.
 *
 * The update source is fixed to GitHub Releases; the endpoint itself lives in
 * `src-tauri/tauri.conf.json` (`plugins.updater.endpoints`).
 */
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** Manual-download fallback, used whenever the in-app path can't run. */
export const RELEASES_PAGE_URL =
  "https://github.com/tansen87/easy-csv/releases/latest";

/** Where the running build is installed. Mirrors Rust `InstallForm`. */
export type InstallForm =
  | "userScoped"
  | "machineScoped"
  | "appBundleUser"
  | "appBundleSystem"
  | "appImage"
  | "debOrUnpacked"
  | "unknown";

export interface InstallFormInfo {
  form: InstallForm;
  /** Whether "Download and install" may be offered. Decided in Rust. */
  canSelfUpdate: boolean;
  exePath: string | null;
}

export interface UpdateCheck {
  available: boolean;
  /** Version offered by the release manifest. */
  version: string;
  /** Version of the running bundle (same source the updater compares against). */
  currentVersion: string;
  /** Release notes (markdown). */
  notes: string;
  /** ISO-8601 date from the manifest, when present. */
  date: string | null;
}

/**
 * A completed check. `update` is the live plugin handle and is only non-null
 * when an update is actually available — pass it back to `installUpdate`.
 */
export interface UpdateSession extends UpdateCheck {
  update: Update | null;
}

/** Normalised download progress. */
export type UpdateProgress =
  | { phase: "started"; total: number | null }
  | { phase: "downloading"; downloaded: number; total: number | null }
  | { phase: "installing" };

/** How the build is installed; decides whether one-click update is offered. */
export async function getInstallForm(): Promise<InstallFormInfo> {
  return invoke<InstallFormInfo>("get_install_form");
}

/**
 * Ask GitHub for the latest release.
 *
 * Resolves with `available: false` when the build is current — that is a normal
 * outcome, not an error. Network, manifest and signature failures reject with a
 * readable message.
 */
export async function checkForUpdate(): Promise<UpdateSession> {
  const currentVersion = await getVersion();

  let update: Update | null;
  try {
    // An explicit timeout matters: the default has none, and a blocked GitHub
    // connection would hang the check indefinitely.
    update = await check({ timeout: 30_000 });
  } catch (error) {
    throw new Error(describeUpdateError(error));
  }

  if (!update) {
    return {
      available: false,
      version: currentVersion,
      currentVersion,
      notes: "",
      date: null,
      update: null,
    };
  }

  return {
    available: true,
    version: update.version,
    currentVersion: update.currentVersion || currentVersion,
    notes: update.body ?? "",
    date: update.date ?? null,
    update,
  };
}

/**
 * Download and install a previously checked update, then relaunch.
 *
 * On Windows the installer replaces the app and the plugin exits the process,
 * so the code after `downloadAndInstall` may never run there; the relaunch is
 * therefore best-effort and every other platform relies on it.
 *
 * The caller must persist user state *before* calling this — see
 * `useUpdater.install`.
 */
export async function installUpdate(
  session: UpdateSession,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
  const { update } = session;
  if (!update) {
    throw new Error("No update available to install");
  }

  try {
    // Track totals locally so a percentage can be shown; the plugin reports
    // the total once (Started) and then only chunk sizes.
    let total: number | null = null;
    let downloaded = 0;
    await update.downloadAndInstall((event) => {
      if (!onProgress) return;
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? null;
          onProgress({ phase: "started", total });
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress({ phase: "downloading", downloaded, total });
          break;
        case "Finished":
          onProgress({ phase: "installing" });
          break;
      }
    });
  } catch (error) {
    throw new Error(describeUpdateError(error));
  }
}

/** Restart into the freshly installed build. */
export async function relaunchApp(): Promise<void> {
  await relaunch();
}

/**
 * The plugin surfaces a mix of `Error`, strings and reqwest descriptions.
 * Normalise so the dialog never renders `[object Object]`.
 */
function describeUpdateError(error: unknown): string {
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
