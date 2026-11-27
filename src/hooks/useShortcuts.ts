import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import {
  DEFAULT_SHORTCUTS,
  mergeShortcuts,
  type ShortcutActionId,
  type ShortcutMap,
} from "@/lib/shortcuts";

/**
 * Loads the persisted shortcut map and writes every change straight through
 * (design 083). Bindings apply immediately, unlike the dialog's other settings
 * which wait for "save" — a shortcut the user just recorded has to work now.
 */
export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutMap>({
    ...DEFAULT_SHORTCUTS,
  });
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    let cancelled = false;
    invoke<string | null>("get_shortcuts")
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          setShortcuts(mergeShortcuts(JSON.parse(raw)));
        } catch {
          // A corrupt blob falls back to the defaults rather than blocking.
        }
      })
      .catch(() => {
        // No backend (tests, browser preview): defaults are already in place.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback((next: ShortcutMap) => {
    latest.current = next;
    setShortcuts(next);
    void invoke("set_shortcuts", { json: JSON.stringify(next) }).catch(() => {
      // A refused write leaves the session on the new binding; the next
      // successful change persists the whole map again.
    });
  }, []);

  const setShortcut = useCallback(
    (id: ShortcutActionId, combo: string) => {
      apply({ ...latest.current, [id]: combo });
    },
    [apply],
  );

  const resetShortcuts = useCallback(() => {
    apply({ ...DEFAULT_SHORTCUTS });
  }, [apply]);

  return { shortcuts, setShortcut, resetShortcuts };
}
