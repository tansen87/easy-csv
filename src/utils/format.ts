export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * `2026-11-06 14:32:00` → `11-06 14:32`, for the compact "recent files" rows
 * (the empty state, design 032). Anything that does not match the stored
 * format is returned untouched.
 */
export function formatShortDateTime(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value;
}

/**
 * A timestamp split into the parts the version log needs, so the copy can stay
 * in i18n (`今天 {time}` / `Today {time}`) instead of being baked into a
 * formatter. `kind` picks the template:
 *
 * - `today` / `yesterday` carry `clock` as `HH:mm`
 * - `date` (same year) carries `month` / `day`
 * - `dateYear` carries `year` / `month` / `day`
 */
export type RelativeStamp =
  | { kind: "today" | "yesterday"; clock: string }
  | { kind: "date"; month: number; day: number }
  | { kind: "dateYear"; year: number; month: number; day: number };

const STAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * `2026-11-07 20:12:37` → `{ kind: "today", clock: "20:12" }`.
 *
 * Versions are persisted with `formatDateTime`, i.e. a bare local
 * `YYYY-MM-DD HH:mm:ss`; `new Date(value)` interprets that shape as local only
 * on some engines (Safari reads it as UTC), so the fields are parsed by hand.
 * Returns `null` for anything unrecognisable — the caller falls back to the
 * stored string.
 */
export function relativeStamp(
  value: string,
  now: Date = new Date(),
): RelativeStamp | null {
  const match = STAMP_PATTERN.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const stamp = new Date(
    year,
    month - 1,
    day,
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0,
  );
  if (Number.isNaN(stamp.getTime())) return null;

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(stamp)) / 86_400_000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const clock = `${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;

  // `days < 0` means the clock is ahead of `now` (skew); read it as today
  // rather than inventing a "tomorrow" state.
  if (days <= 0) return { kind: "today", clock };
  if (days === 1) return { kind: "yesterday", clock };
  if (stamp.getFullYear() === now.getFullYear()) {
    return { kind: "date", month, day };
  }
  return { kind: "dateYear", year, month, day };
}

/** `"820 ms"` / `"1.4 s"`; empty string when unknown. */
export function formatElapsed(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * `"512 B"` / `"3.4 KB"` / `"12.0 MB"`.
 *
 * Hoisted out of `ExecutionHistoryDialog` so the update dialog can show
 * download progress with the same formatting (same move as `formatElapsed`).
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** How the chart axis/tooltip renders numeric values. */
export type NumberFormatMode =
  | "auto"
  | "integer"
  | "decimal1"
  | "decimal2"
  | "percent"
  | "compact";

function decimalsFor(value: number, maxDecimals = 2): number {
  if (Number.isInteger(value)) return 0;
  const abs = Math.abs(value);
  // Very small magnitudes need more precision than the default, otherwise they
  // would render as a flat 0.
  if (abs > 0 && abs < 0.01) return 4;
  return maxDecimals;
}

/**
 * Format a numeric value for chart surfaces.
 *
 * `compact` (the axis default) shortens large magnitudes to `1.2M` / `900k`
 * while tooltips ask for the full grouped value, so an axis label like
 * `1200000` stops eating the plot width.
 */
export function formatNumber(
  value: number | null | undefined,
  mode: NumberFormatMode = "auto",
  suffix = "",
): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "—";

  switch (mode) {
    case "integer":
      return `${Math.round(value).toLocaleString("en-US")}${suffix}`;
    case "decimal1":
      return `${value.toFixed(1)}${suffix}`;
    case "decimal2":
      return `${value.toFixed(2)}${suffix}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "compact": {
      const abs = Math.abs(value);
      const sign = value < 0 ? "-" : "";
      if (abs >= 1_000_000_000)
        return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
      if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}k`;
      return `${sign}${abs.toFixed(decimalsFor(abs))}`;
    }
    default:
      return `${value.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimalsFor(value),
      })}${suffix}`;
  }
}
