import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PipelineTab } from "@/types/xan";
import { deserializeTabSnapshot, serializeTabSnapshot } from "@/utils/session";

const SAVE_DEBOUNCE_MS = 800;

export function useSession(
  tabs: PipelineTab[],
  setTabs: React.Dispatch<React.SetStateAction<PipelineTab[]>>,
  selectedTabId: string,
  setSelectedTabId: React.Dispatch<React.SetStateAction<string>>,
) {
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const markHydrated = useCallback(() => {
    hydratedRef.current = true;
  }, []);

  const persistSession = useCallback(() => {
    if (!hydratedRef.current) return;
    const snapshots = tabs.map(serializeTabSnapshot);
    invoke("save_session", {
      tabs: JSON.stringify(snapshots),
      selectedTabId,
    }).catch((error) => console.error("Failed to save session:", error));
  }, [tabs, selectedTabId]);

  const restoreSession = useCallback(async (): Promise<PipelineTab[]> => {
    try {
      const content = await invoke<string>("load_session");
      const session = JSON.parse(content) as {
        tabs: any[];
        selectedTabId: string;
      };
      const restored: PipelineTab[] = [];
      for (const snap of session.tabs || []) {
        const tab = deserializeTabSnapshot(snap);
        if (tab) restored.push(tab);
      }
      if (restored.length > 0) {
        setTabs(restored);
        const target =
          restored.find((t) => t.id === session.selectedTabId) || restored[0];
        setSelectedTabId(target.id);
      }
      return restored;
    } catch (error) {
      console.error("Failed to restore session:", error);
      return [];
    } finally {
      hydratedRef.current = true;
    }
  }, [setTabs, setSelectedTabId]);

  const persistRef = useRef(persistSession);
  persistRef.current = persistSession;

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      persistRef.current();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [tabs, selectedTabId]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!hydratedRef.current) return;
      const snapshots = tabs.map(serializeTabSnapshot);
      invoke("save_session", {
        tabs: JSON.stringify(snapshots),
        selectedTabId,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tabs, selectedTabId]);

  return { restoreSession, markHydrated };
}
