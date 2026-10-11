/**
 * Settings search. Pure data in, data out - no DOM, no React
 * state — so the whole matching contract is unit-testable.
 *
 * Rules, in one place:
 * - a query is split on whitespace; **every** term must hit for a row to match;
 * - a term hits if it appears (case-insensitively) in the row's title,
 *   description or one of its `keywords` aliases;
 * - Chinese is matched as a substring (no word segmentation);
 * - a group survives when a row inside it matches — with only the matching rows
 *   kept — or when the **group name** itself matches, in which case the whole
 *   group is kept (that is how the plugin panel, which has no rows, is found);
 * - the result keeps the input order: settings must not shuffle around.
 */

export interface TextSegment {
  text: string;
  hit: boolean;
}

export interface SearchableRow {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
}

export interface SearchableGroup {
  id: string;
  name: string;
  groupKeywords?: string[];
  rows: SearchableRow[];
  /** A group summarised by its heading rather than by rows. */
  summary?: "plugins";
}

/** Lower-cased terms; an empty array means "no filter". */
export function parseQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function rowFields(row: SearchableRow): string[] {
  return [row.title, row.description ?? "", ...(row.keywords ?? [])];
}

function groupFields(group: SearchableGroup): string[] {
  return [group.name, ...(group.groupKeywords ?? [])];
}

function hits(fields: string[], terms: string[]): boolean {
  const haystack = fields.map((field) => field.toLowerCase());
  return terms.every((term) =>
    haystack.some((field) => field.includes(term.toLowerCase())),
  );
}

export function rowMatches(row: SearchableRow, terms: string[]): boolean {
  return hits(rowFields(row), terms);
}

export function groupMatches(
  group: SearchableGroup,
  terms: string[],
): boolean {
  return hits(groupFields(group), terms);
}

export function filterSettings<T extends SearchableGroup>(
  groups: T[],
  query: string,
): T[] {
  const terms = parseQuery(query);
  if (terms.length === 0) return groups;

  const out: T[] = [];
  for (const group of groups) {
    // A category name is a legitimate search term ("插件" / "llm"), and for the
    // plugin panel it is the *only* way in — the group holds no rows.
    if (groupMatches(group, terms)) {
      out.push(group);
      continue;
    }
    const rows = group.rows.filter((row) => rowMatches(row, terms));
    if (rows.length > 0) out.push({ ...group, rows });
  }
  return out;
}

/** Number of rows a filtered result would render (panels count as one). */
export function countMatches(groups: SearchableGroup[]): number {
  return groups.reduce(
    (total, group) => total + (group.summary ? 1 : group.rows.length),
    0,
  );
}

/**
 * Split `text` into segments so the UI can wrap the hits in `<mark>`. Used for
 * both the title and the description. Overlapping matches are merged, and the
 * query is treated as literal text — `(`, `*` and friends must not act as a
 * regular expression.
 */
export function highlightSegments(
  text: string,
  query: string,
): TextSegment[] {
  const terms = parseQuery(query).filter((term) => term.length > 0);
  if (!text || terms.length === 0) return [{ text, hit: false }];

  const lowered = text.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    let from = lowered.indexOf(term);
    while (from !== -1) {
      ranges.push([from, from + term.length]);
      from = lowered.indexOf(term, from + term.length);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (const [start, end] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false });
    segments.push({ text: text.slice(start, end), hit: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}
