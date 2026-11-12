// Design 053: the command palette ranks instead of filtering.
//
// The old palette kept whatever `haystack.includes(query)` returned in array
// order, so typing `fi` put `filter` third-screen behind 26 actions. Everything
// scoring-related lives here as pure functions: the component only renders.
//
// Pure on purpose — no React, no i18n, no DOM — so the rules can be unit-tested
// without mounting the palette.
import { pinyinInitials } from "@/utils/pinyinInitials";

import type { PaletteItem, PaletteSource } from "./paletteTypes";

export interface MatchRange {
  start: number;
  end: number;
}

export interface ItemMatch {
  score: number;
  /** Ranges of `item.label` to highlight (original string indices). */
  labelRanges: MatchRange[];
  /** Ranges of `item.description` to highlight. */
  descRanges: MatchRange[];
}

export interface ScoredItem {
  item: PaletteItem;
  match: ItemMatch;
  /** Position in the input array, used as the last tie-break. */
  index: number;
}

export const SCORE = {
  /** The label is exactly the query. */
  labelExact: 100,
  /** The label starts with the query. */
  labelPrefix: 80,
  /** The label contains the query somewhere. */
  labelContains: 60,
  /** Pinyin initials of the label (`dk` → 打开文件). */
  initials: 55,
  /** Description / keywords / group / shortcut contains the query. */
  meta: 30,
} as const;

/**
 * Tie-break for equal scores. Commands come before files on purpose: the thing
 * you look for in a *command* palette is usually a command. This is separate
 * from the browsing order of the empty state (actions first), which the item
 * array itself defines.
 */
export const SOURCE_ORDER: Record<PaletteSource, number> = {
  action: 0,
  command: 1,
  tab: 2,
  file: 3,
  template: 4,
};

/** Longest query we bother scoring; longer input is treated as "no match". */
const MAX_QUERY = 128;

function rangesOf(haystack: string, needle: string): MatchRange[] {
  const out: MatchRange[] = [];
  if (!needle) return out;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return out;
    out.push({ start: at, end: at + needle.length });
    from = at + needle.length;
  }
}

/**
 * Score one item against a query. Returns `null` when it does not match.
 *
 * An empty query matches everything with score 0 — callers keep the original
 * order in that case (browsing, not searching).
 */
export function matchItem(item: PaletteItem, query: string): ItemMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, labelRanges: [], descRanges: [] };
  if (q.length > MAX_QUERY) return null;

  // Lowercasing is length-preserving for everything we index, so the ranges
  // computed on the lowercased label are valid for the original string too.
  const label = item.label.toLowerCase();
  if (label === q) {
    return {
      score: SCORE.labelExact,
      labelRanges: [{ start: 0, end: label.length }],
      descRanges: [],
    };
  }
  if (label.startsWith(q)) {
    return {
      score: SCORE.labelPrefix,
      labelRanges: [{ start: 0, end: q.length }],
      descRanges: [],
    };
  }
  const at = label.indexOf(q);
  if (at >= 0) {
    return {
      score: SCORE.labelContains,
      labelRanges: [{ start: at, end: at + q.length }],
      descRanges: [],
    };
  }

  // Pinyin initials only make sense for a pure-letter query; `dk` must not
  // match on digits or symbols, where the mapping is undefined.
  if (/^[a-z]+$/.test(q)) {
    const initials = pinyinInitials(item.label);
    if (initials.length >= q.length && initials.includes(q)) {
      // No character highlight: initials do not map back to a visible run.
      return { score: SCORE.initials, labelRanges: [], descRanges: [] };
    }
  }

  const meta = [
    item.description,
    item.keywords,
    item.search,
    item.group,
    item.shortcut,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (meta.includes(q)) {
    return {
      score: SCORE.meta,
      labelRanges: [],
      descRanges: rangesOf((item.description ?? "").toLowerCase(), q),
    };
  }

  return null;
}

/**
 * Filter + rank. Disabled entries never make it out: offering an action that
 * cannot run is worse than not offering it at all (the palette shows
 * `matched / available` so the filtering is at least accounted for).
 */
export function searchItems(items: PaletteItem[], query: string): ScoredItem[] {
  const out: ScoredItem[] = [];
  items.forEach((item, index) => {
    if (item.disabled) return;
    const match = matchItem(item, query);
    if (match) out.push({ item, match, index });
  });

  if (!query.trim()) return out;

  out.sort((a, b) => {
    if (b.match.score !== a.match.score) return b.match.score - a.match.score;
    const rankA = a.item.source ? SOURCE_ORDER[a.item.source] : 9;
    const rankB = b.item.source ? SOURCE_ORDER[b.item.source] : 9;
    if (rankA !== rankB) return rankA - rankB;
    return a.index - b.index;
  });
  return out;
}
