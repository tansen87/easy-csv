/**
 * Minimal CSV-string parser shared by result previews.
 * Handles quoted fields, escaped quotes (`""`), and skips blank lines.
 */

function parseCsvLine(line: string): string[] {
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
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  /** True when the input was capped (more rows existed but were not parsed). */
  truncated: boolean;
}

/**
 * Parse a CSV string into headers + rows.
 *
 * @param raw      The CSV text.
 * @param maxRows  Optional cap on number of data rows parsed. When exceeded,
 *                 `truncated` is set to true and parsing stops (perf guard).
 */
export function parseCsvString(raw: string, maxRows?: number): ParsedCsv {
  const lines = raw.trim().split("\n");
  if (lines.length === 0) return { headers: [], rows: [], truncated: false };

  const headers = parseCsvLine(lines[0]);
  const rows: string[][] = [];
  let truncated = false;
  const cap = maxRows ?? Number.POSITIVE_INFINITY;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    if (rows.length >= cap) {
      truncated = true;
      break;
    }
    rows.push(parseCsvLine(lines[i]));
  }

  return { headers, rows, truncated };
}
