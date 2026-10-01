export function formatDateTime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
