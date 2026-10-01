import { useCallback, useEffect, useState } from "react";

/**
 * First-run onboarding state.
 *
 * One flag, stored in `localStorage`, meaning "the canvas guide has been shown
 * and dismissed". Like the other `easy-csv-*` keys it is read/written behind
 * guarded helpers so a corrupt or unavailable store degrades to "already seen"
 * rather than throwing on startup or re-showing the guide forever.
 *
 * The `-v1` suffix lets a future guide replay itself without colliding with
 * this one.
 */
export const ONBOARDING_SEEN_KEY = "easy-csv-onboarding-v1";

const SEEN = "done";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === SEEN;
  } catch {
    // Storage unavailable (privacy mode, quota, …): treat as seen so the guide
    // cannot nag on every open.
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, SEEN);
  } catch {
    // Best effort — the in-memory state still hides the guide this session.
  }
}

export function clearOnboarding(): void {
  try {
    localStorage.removeItem(ONBOARDING_SEEN_KEY);
  } catch {
    // Best effort.
  }
}

export interface UseOnboardingResult {
  /** False while the guide still has to be shown once. */
  seen: boolean;
  markSeen: () => void;
  /** Settings → "Show the intro again". */
  reset: () => void;
}

export function useOnboarding(): UseOnboardingResult {
  const [seen, setSeen] = useState<boolean>(() => hasSeenOnboarding());

  const markSeen = useCallback(() => {
    setSeen((prev) => {
      if (!prev) markOnboardingSeen();
      return true;
    });
  }, []);

  const reset = useCallback(() => {
    clearOnboarding();
    setSeen(false);
  }, []);

  return { seen, markSeen, reset };
}

/**
 * Mark the guide as seen once the user has added a step themselves - the guide
 * has done its job and must not come back. Kept as a hook so the effect lives
 * where the state does.
 */
export function useAutoDismissOnboarding(
  seen: boolean,
  shouldDismiss: boolean,
  markSeen: () => void,
): void {
  useEffect(() => {
    if (!seen && shouldDismiss) {
      markSeen();
    }
  }, [seen, shouldDismiss, markSeen]);
}
