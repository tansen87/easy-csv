import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelPluginInstall,
  checkPlugins,
  describePluginError,
  getPluginCatalog,
  installPlugin,
  isInstallCancelled,
  isXanInstalled,
  onPluginProgress,
  uninstallPlugin,
  type CatalogEntry,
  type CatalogView,
  type PluginProgress,
  type PluginStatus,
} from "@/services/plugins";

/** Download progress for one plugin, as rendered by the row. */
export interface PluginInstallState {
  phase: PluginProgress["phase"];
  downloaded: number;
  total: number;
}

interface UsePluginCatalogOptions {
  showToast?: (
    message: string,
    type?: "info" | "success" | "warning" | "error",
  ) => void;
  /**
   * Load as soon as the hook mounts. Off by default so a page that is not the
   * plugins tab does not hit the network just by existing.
   */
  auto?: boolean;
}

/**
 * Owns the plugin catalog state: loading, refreshing, installs and removals.
 *
 * Two rules shape this hook:
 *
 * 1. **The catalog is the source of truth for "what exists"; `check_plugins` is
 *    the source of truth for "what resolves".** Both are needed — the catalog
 *    lists plugins the app has never downloaded, while only a probe knows
 *    whether a binary is actually on disk.
 * 2. **A failed install must not strand the row.** Whatever the backend says
 *    afterwards (`install_plugin` resolves with the fresh status) is applied
 *    directly; on failure the authoritative catalog is re-read instead of
 *    guessing from the error.
 */
export function usePluginCatalog({
  showToast,
  auto = false,
}: UsePluginCatalogOptions = {}) {
  const [view, setView] = useState<CatalogView | null>(null);
  const [statuses, setStatuses] = useState<PluginStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [installing, setInstalling] = useState<Record<string, PluginInstallState>>(
    {},
  );
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  /** Names the user asked to stop, while the download finishes unspooling. */
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // `showToast` often arrives as an inline arrow function. Keeping it in a ref
  // stops every callback below from being rebuilt on each render, which would
  // in turn re-run the progress subscription effect.
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      // Sequenced, not `Promise.all`: the catalog is the expensive one and the
      // probe spawns processes, so running them together gains little.
      const next = await getPluginCatalog(refresh);
      setView(next);
      try {
        setStatuses(await checkPlugins());
      } catch (cause) {
        // Probing is advisory; the catalog already carries `installed`, which
        // is resolved without spawning anything.
        console.error("Failed to probe plugins:", cause);
      }
    } catch (cause) {
      setError(describePluginError(cause));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (auto) void load(false);
  }, [auto, load]);

  // One subscription for the whole page: progress events carry the plugin name,
  // so each one is routed to its own row.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    onPluginProgress((progress) => {
      setInstalling((previous) => ({
        ...previous,
        [progress.name]: {
          phase: progress.phase,
          downloaded: progress.downloaded,
          total: progress.total,
        },
      }));
    })
      .then((dispose) => {
        // The page can be gone before `listen` resolves.
        if (cancelled) dispose();
        else unlisten = dispose;
      })
      .catch((cause) => {
        // Without the event the row just shows no bar; the install still runs.
        console.error("Failed to subscribe to plugin progress:", cause);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const setBusyFor = useCallback((name: string, value: boolean) => {
    setBusy((previous) => {
      if (!value) {
        const next = { ...previous };
        delete next[name];
        return next;
      }
      return { ...previous, [name]: true };
    });
  }, []);

  const setCancellingFor = useCallback((name: string, value: boolean) => {
    setCancelling((previous) => {
      if (!value) {
        const next = { ...previous };
        delete next[name];
        return next;
      }
      return { ...previous, [name]: true };
    });
  }, []);

  /**
   * Asks a running download to stop.
   *
   * Deliberately does not clear `installing`: the backend only checks the flag
   * between chunks, so the actual end comes from the event stream (the
   * `cancelled` phase, or `install` rejecting) — which is also what keeps the
   * row from blinking back to "download" for a moment before it settles.
   */
  const cancel = useCallback(
    async (name: string): Promise<void> => {
      setCancellingFor(name, true);
      try {
        const wasRunning = await cancelPluginInstall(name);
        // Nothing running means the last chunk already landed and the file is
        // being verified; saying so is friendlier than a silent no-op.
        if (!wasRunning) showToastRef.current?.(`${name} was already finished`, "info");
      } catch (cause) {
        setCancellingFor(name, false);
        showToastRef.current?.(describePluginError(cause), "error");
      }
    },
    [setCancellingFor],
  );

  /** Downloads and installs one plugin. Resolves with the fresh status. */
  const install = useCallback(
    async (name: string): Promise<PluginStatus | null> => {
      setBusyFor(name, true);
      setInstalling((previous) => ({
        ...previous,
        [name]: { phase: "downloading", downloaded: 0, total: 0 },
      }));
      try {
        const status = await installPlugin(name);
        // The backend returns the status it resolved after placing the binary,
        // so the row can be updated without another round trip.
        setStatuses((previous) => {
          const others = previous.filter((entry) => entry.name !== name);
          return [...others, status];
        });
        // `installed` / `installed_version` / `update_available` live only in
        // the catalog view, which changed the moment the binary landed. A free
        // re-read (cache is warm, no network) is cheaper than reproducing the
        // backend's version comparison here.
        void load(false);
        showToastRef.current?.(`${name} installed`, "success");
        return status;
      } catch (cause) {
        // A cancellation is the user's own doing, so it gets an informational
        // line rather than the error banner and the red toast a real failure
        // gets — painting an intentional action as a fault trains people to
        // ignore the banner.
        if (isInstallCancelled(cause)) {
          showToastRef.current?.(`${name} download cancelled`, "info");
          return null;
        }
        const message = describePluginError(cause);
        setError(message);
        showToastRef.current?.(`Failed to install ${name}: ${message}`, "error");
        return null;
      } finally {
        setBusyFor(name, false);
        setCancellingFor(name, false);
        setInstalling((previous) => {
          const next = { ...previous };
          delete next[name];
          return next;
        });
      }
    },
    [load, setBusyFor, setCancellingFor],
  );

  /** Removes a plugin this app installed. */
  const uninstall = useCallback(
    async (name: string): Promise<boolean> => {
      setBusyFor(name, true);
      try {
        await uninstallPlugin(name);
        void load(false);
        showToastRef.current?.(`${name} removed`, "success");
        return true;
      } catch (cause) {
        const message = describePluginError(cause);
        setError(message);
        showToastRef.current?.(`Failed to remove ${name}: ${message}`, "error");
        return false;
      } finally {
        setBusyFor(name, false);
      }
    },
    [load, setBusyFor],
  );

  /** Forces a network round trip for the manifest. */
  const refresh = useCallback(() => load(true), [load]);

  /** Re-reads the catalog without forcing a fetch (uses the cache/TTL). */
  const reload = useCallback(() => load(false), [load]);

  /** Whether any entry is doing something, for a page-level spinner. */
  const isInstalling = Object.keys(installing).length > 0;
  const isBusy = Object.keys(busy).length > 0;

  return {
    view,
    entries: view?.entries ?? ([] as CatalogEntry[]),
    statuses,
    isLoading,
    isRefreshing,
    installing,
    busy,
    cancelling,
    isInstalling,
    isBusy,
    error,
    install,
    cancel,
    uninstall,
    refresh,
    reload,
    dismissError: useCallback(() => setError(null), []),
  };
}

/**
 * Whether a required plugin is missing, checked once at startup.
 *
 * Returns `null` while the check is in flight, so the caller can hold off on
 * showing anything. A failure resolves to `null` too: an app that cannot tell
 * must not nag about a plugin that is probably there.
 *
 * The probe is delayed a little so it does not compete with session restore and
 * version warm-up, and so the guidance never flashes in front of a window that
 * is still assembling itself.
 */
export function useRequiredPluginCheck(enabled = true, delayMs = 1200) {
  const [missingXan, setMissingXan] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      isXanInstalled()
        .then((installed) => {
          if (!cancelled) setMissingXan(!installed);
        })
        .catch((cause) => {
          console.error("Failed to check for xan:", cause);
          if (!cancelled) setMissingXan(null);
        });
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, delayMs]);

  return {
    /** `true` only when xan is definitely absent and the user has not dismissed. */
    missingXan: missingXan === true && !dismissed,
    recheck: useCallback(() => {
      isXanInstalled()
        .then((installed) => setMissingXan(!installed))
        .catch(() => setMissingXan(null));
    }, []),
    dismiss: useCallback(() => setDismissed(true), []),
  };
}
