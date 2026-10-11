import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Which section is the user looking at? (design 030 §4.4)
 *
 * Follows the *top-based* rule: the active section is the last one whose top
 * edge has reached the scroll container's top edge. Deliberately **not** an
 * `IntersectionObserver`: on short sections scrolled quickly, IO reports two
 * sections as visible at once and the highlight flickers between them, whereas
 * "what is at the top" has one answer by construction.
 *
 * The container is the Radix viewport inside `rootRef` (Radix marks it with
 * `data-radix-scroll-area-viewport`); plain scrollable elements work too, so a
 * test can hand over a bare div.
 */

/** How long a click-driven jump suppresses scroll updates (ms). */
const LOCK_MS = 350;

/** Slack in px: a heading that is this close to the top edge already counts. */
const HYSTERESIS = 8;

export interface UseScrollSpyOptions {
  /** Element id prefix; the hook looks up `${idPrefix}${id}`. */
  idPrefix: string;
  /**
   * Skip all work while false. Needed because a dialog that renders `null` when
   * closed attaches its refs *after* the first render — without this the scroll
   * listener would never be installed.
   */
  enabled?: boolean;
}

export interface ScrollSpy {
  activeId: string | null;
  /** Jump target: highlight `id` now and ignore scroll updates briefly. */
  lockTo: (id: string) => void;
}

export function useScrollSpy(
  ids: string[],
  rootRef: React.RefObject<HTMLElement | null>,
  { idPrefix, enabled = true }: UseScrollSpyOptions,
): ScrollSpy {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);
  const lockedUntilRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollerOf = useCallback((): HTMLElement | null => {
    const root = rootRef.current;
    if (!root) return null;
    return (
      root.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") ??
      root
    );
  }, [rootRef]);

  const compute = useCallback(() => {
    const scroller = scrollerOf();
    if (!scroller) return;
    const top = scroller.getBoundingClientRect().top;
    let current: string | null = ids[0] ?? null;
    for (const id of ids) {
      const section = document.getElementById(`${idPrefix}${id}`);
      if (!section) continue;
      if (section.getBoundingClientRect().top - top <= HYSTERESIS) {
        current = id;
      }
    }
    setActiveId(current);
  }, [ids, idPrefix, scrollerOf]);

  const lockTo = useCallback(
    (id: string) => {
      lockedUntilRef.current = Date.now() + LOCK_MS;
      setActiveId(id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lockedUntilRef.current = 0;
        compute();
      }, LOCK_MS + 20);
    },
    [compute],
  );

  useEffect(() => {
    if (!enabled) return;
    const scroller = scrollerOf();
    if (!scroller) return;

    const onScroll = () => {
      if (Date.now() < lockedUntilRef.current) return;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        compute();
      });
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, compute, scrollerOf]);

  return { activeId, lockTo };
}
