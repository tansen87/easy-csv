/**
 * Presentation helpers for the results dock (design 084).
 *
 * Rules that matter:
 * - Numeric detection only decides **alignment**; the string is never rewritten
 *   (`1,200` stays `1,200`, and a copy out of the table matches the screen).
 * - Empty cells are counted so the footer can say "空值 1 处" without inspecting
 *   the table by eye.
 */

/** `12`, `-3.5`, `.5`, `+1e3`. No thousands separators, no currency, no `%`. */
const NUMERIC_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * True when every non-empty value in this column parses as a plain number and
 * at least one value is present. A single blank cell does not disqualify the
 * column (a missing value should not change how the neighbouring numbers read).
 */
export function isNumericColumn(rows: string[][], index: number): boolean {
  let seen = false;
  for (const row of rows) {
    const raw = row[index];
    if (raw == null) continue;
    const value = raw.trim();
    if (value === "") continue;
    if (!NUMERIC_RE.test(value)) return false;
    seen = true;
  }
  return seen;
}

/** One flag per column, cached by the caller. */
export function numericColumns(rows: string[][], width: number): boolean[] {
  return Array.from({ length: width }, (_, index) =>
    isNumericColumn(rows, index),
  );
}

/**
 * Steps are often already named "1 去掉空金额" by the user or the sample
 * template; the chain shows its own `01` chip, so that prefix would read
 * "01 1 去掉空金额". Strip the number only when it matches the step's
 * position — a label like "2026 汇总" is left alone.
 */
export function stripLeadingIndex(label: string, position: number): string {
  const match = /^\s*0*(\d{1,2})[.、:：)\s]+\s*(.*)$/.exec(label);
  if (!match) return label;
  if (Number(match[1]) !== position) return label;
  return match[2].trim() || label;
}

/**
 * Height the dock needs to show `rows` rows without scrolling: grip 5 +
 * header row 32 + table head 32 + rows*30.
 *
 * Capped at 8 rows on purpose: a 500-row preview must not yank the drawer over
 * the canvas on every run. Beyond that the table scrolls, which is what a
 * table is for. The dock only ever grows to meet this (design 084).
 */
export function resultPanelHeight(rows: number): number {
  const visible = Math.min(Math.max(rows, 1), 8);
  // grip 5 + tab row 32 (chain + counts + copy live in it) + head 32 + rows
  return 5 + 32 + 32 + visible * 30;
}

/** RFC 4180-ish quoting: only when the value needs it. */
function csvCell(value: string): string {
  return value.includes(",") || value.includes('"') || value.includes("\n")
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

export function toCsvText(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function toMarkdownText(headers: string[], rows: string[][]): string {
  const esc = (value: string) =>
    value.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const head = `| ${headers.map(esc).join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(esc).join(" | ")} |`);
  return [head, rule, ...body].join("\n");
}
