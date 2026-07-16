import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useAppSettings(
  showToastRef: React.RefObject<
    (message: string, type?: "info" | "success" | "warning" | "error") => void
  >,
) {
  const [defaultDelimiter, setDefaultDelimiter] = useState(",");
  const [noHeaders, setNoHeaders] = useState(false);
  const [systemNotification, setSystemNotification] = useState(true);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [historyLimit, setHistoryLimit] = useState(100);

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

  const loadHistoryLimit = useCallback(async () => {
    try {
      const saved = await invoke<number | null>("get_history_limit");
      if (saved !== null) setHistoryLimit(saved);
    } catch (error) {
      showToastRef.current(`Failed to load history limit: ${error}`, "error");
    }
  }, [showToastRef]);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadDefaultDelimiter(),
      loadNoHeaders(),
      loadSystemNotification(),
      loadMinimizeToTray(),
      loadHistoryLimit(),
    ]);
  }, [
    loadDefaultDelimiter,
    loadNoHeaders,
    loadSystemNotification,
    loadMinimizeToTray,
    loadHistoryLimit,
  ]);

  return {
    defaultDelimiter,
    setDefaultDelimiter,
    noHeaders,
    setNoHeaders,
    systemNotification,
    setSystemNotification,
    minimizeToTray,
    setMinimizeToTray,
    historyLimit,
    setHistoryLimit,
    loadAll,
  };
}
