/**
 * Pure helpers behind the data profile panel (design 042).
 *
 * Kept out of the component so the `xan stats` parsing and the derived
 * "missing" numbers can be unit tested without rendering anything.
 */

export interface ColumnStat {
  field: string;
  count: string;
  count_empty: string;
  types: string;
  sum: string;
  mean: string;
  min: string;
  max: string;
  min_length: string;
  max_length: string;
  lex_first?: string;
  lex_last?: string;
  [key: string]: string | undefined;
}

export type ColumnKind = "int" | "float" | "text" | "mixed" | "empty";

export interface ProfileRow {
  stat: ColumnStat;
  kind: ColumnKind;
  /** Non-empty cells (`xan stats` counts non-empty values only). */
  filled: number;
  missing: number;
  /** filled + missing, i.e. the real row count of the file. */
  total: number;
  /** Share of non-empty cells, 0-100. */
  percent: number;
}

/** `types` is a pipe separated list (`Float|Text`); the first token wins. */
export function columnKind(types: string | undefined): ColumnKind {
  const first = (types || "").split("|")[0]?.trim().toLowerCase();
  if (first === "integer" || first === "int") return "int";
  if (first === "float" || first === "number") return "float";
  if (first === "mixed") return "mixed";
  if (first === "empty") return "empty";
  return "text";
}

export function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Counts never carry decimals; one format for every integer on the panel. */
export function fmtCount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function fmtStat(value: string | undefined, decimals = 0): string {
  if (!value) return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function parseXanStatsCsv(raw: string): ColumnStat[] {
  const lines = raw.trim().split("\n");
  if (lines.length < 2) return [];

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCsvLine(lines[0]);
  const rows: ColumnStat[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row as ColumnStat);
  }

  return rows;
}

/**
 * `xan stats` reports `count` as **non-empty** values, so the file's row count
 * is `count + count_empty` — using `count` alone under-reports rows for any
 * column that has holes (the old panel did exactly that).
 */
export function buildProfileRows(columns: ColumnStat[]): ProfileRow[] {
  return columns.map((stat) => {
    const filled = toNumber(stat.count);
    const missing = toNumber(stat.count_empty);
    const total = filled + missing;
    return {
      stat,
      kind: columnKind(stat.types),
      filled,
      missing,
      total,
      percent: total > 0 ? (filled / total) * 100 : 0,
    };
  });
}
