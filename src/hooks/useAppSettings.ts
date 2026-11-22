import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useAppSettings(
  showToastRef: React.RefObject<
    (message: string, type?: "info" | "success" | "warning" | "error") => void
  >,
) {
  const [defaultDelimiter, setDefaultDelimiter] = useState(",");
  const [autoDetectDelimiter, setAutoDetectDelimiter] = useState(true);
  const [noHeaders, setNoHeaders] = useState(false);
  const [systemNotification, setSystemNotification] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [doubleClickFitView, setDoubleClickFitView] = useState(true);
  const [autoCheckUpdate, setAutoCheckUpdate] = useState(true);
  /** Parallel run limit; the backend clamps to 1..=16. */
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState(4);
  /** Log file retention in days; 0 = memory only. */
  const [logRetentionDays, setLogRetentionDays] = useState(7);
  /** Auto-open the log drawer when a run starts (071); default off. */
  const [autoShowLogPanel, setAutoShowLogPanel] = useState(false);

  const loadDefaultDelimiter = useCallback(async () => {
    try {
      const saved = await invoke<string | null>("get_default_delimiter");
      if (saved) setDefaultDelimiter(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load default delimiter: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadAutoDetectDelimiter = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_auto_detect_delimiter");
      if (saved !== null) setAutoDetectDelimiter(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load auto-detect delimiter setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadNoHeaders = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_no_headers");
      if (saved !== null) setNoHeaders(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load no headers setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadSystemNotification = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_system_notification");
      if (saved !== null) setSystemNotification(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load notification setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadMinimizeToTray = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_minimize_to_tray");
      if (saved !== null) setMinimizeToTray(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load minimize to tray setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadDoubleClickFitView = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_double_click_fit_view");
      if (saved !== null) setDoubleClickFitView(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load double click fit view setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadAutoCheckUpdate = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_auto_check_update");
      if (saved !== null) setAutoCheckUpdate(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load update check setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadMaxConcurrentRuns = useCallback(async () => {
    try {
      const saved = await invoke<number | null>("get_max_concurrent_runs");
      if (saved !== null) setMaxConcurrentRuns(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load concurrency limit: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadLogRetentionDays = useCallback(async () => {
    try {
      const saved = await invoke<number | null>("get_log_retention_days");
      if (saved !== null) setLogRetentionDays(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load log retention setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadAutoShowLogPanel = useCallback(async () => {
    try {
      const saved = await invoke<boolean | null>("get_auto_show_log_panel");
      if (saved !== null) setAutoShowLogPanel(saved);
    } catch (error) {
      showToastRef.current(
        `Failed to load auto-open log setting: ${error}`,
        "error",
      );
    }
  }, [showToastRef]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadDefaultDelimiter(),
      loadAutoDetectDelimiter(),
      loadNoHeaders(),
      loadSystemNotification(),
      loadMinimizeToTray(),
      loadDoubleClickFitView(),
      loadAutoCheckUpdate(),
      loadMaxConcurrentRuns(),
      loadLogRetentionDays(),
      loadAutoShowLogPanel(),
    ]);
  }, [
    loadDefaultDelimiter,
    loadAutoDetectDelimiter,
    loadNoHeaders,
    loadSystemNotification,
    loadMinimizeToTray,
    loadDoubleClickFitView,
    loadAutoCheckUpdate,
    loadMaxConcurrentRuns,
    loadLogRetentionDays,
    loadAutoShowLogPanel,
  ]);

  return {
    defaultDelimiter,
    setDefaultDelimiter,
    autoDetectDelimiter,
    setAutoDetectDelimiter,
    noHeaders,
    setNoHeaders,
    systemNotification,
    setSystemNotification,
    minimizeToTray,
    setMinimizeToTray,
    doubleClickFitView,
    setDoubleClickFitView,
    autoCheckUpdate,
    setAutoCheckUpdate,
    maxConcurrentRuns,
    setMaxConcurrentRuns,
    logRetentionDays,
    setLogRetentionDays,
    autoShowLogPanel,
    setAutoShowLogPanel,
    loadAll,
  };
}
