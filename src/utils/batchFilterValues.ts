/**
 * Parsing helpers for the `xan frequency` table that Batch Filter reads when
 * "value source" is set to *from column*.
 *
 * Three properties of that table drive everything here:
 *
 * 1. It has three columns - `field`, `value`, `count` - not one. The value we
 *    want is the **second** cell of each record.
 * 2. It is written with the delimiter xan read the input with (`-d` applies to
 *    stdout too), so a comma CSV yields `品类,服饰,3` records. Parsing those as
 *    a single tab-separated column produced a fake value per record
 *    (`品类,服饰,3`), which then matched nothing when used as a filter pattern.
 * 3. A cell may contain the delimiter, quotes or even newlines (xan quotes it),
 *    so records have to be split with quote awareness - not by `split("\n")`.
 *
 * Values are never trimmed: they must match the column byte for byte.
 */

const FREQUENCY_HEADER = ["field", "value", "count"];

/** Extra cells xan adds to a frequency table; neither is a real column value. */
const EXTRA_VALUE_SENTINELS = new Set(["<empty>", "<rest>"]);

/** Delimiters worth trying when the preferred one does not reproduce the header. */
const DELIMITER_CANDIDATES = ["\t", ",", ";", "|"];

/**
 * Split delimited text into records of cells, honouring `"..."` quoting, `""`
 * escapes and newlines inside quotes. Blank lines yield a single empty cell.
 */
function splitDelimitedRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let current = "";
  let inQuotes = false;

  const endCell = () => {
    cells.push(current);
    current = "";
  };
  const endRecord = () => {
    endCell();
    records.push(cells);
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
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
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\n") {
      endRecord();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRecord();
    } else {
      current += ch;
    }
  }

  // Flush the last record unless the text ended exactly on a line break.
  if (current !== "" || cells.length > 0) endRecord();

  return records;
}

function isFrequencyHeader(cells: string[]): boolean {
  return (
    cells.length === FREQUENCY_HEADER.length &&
    FREQUENCY_HEADER.every((name, i) => cells[i] === name)
  );
}

function singleCharDelimiter(value: string | undefined): string | null {
  return value && value.length === 1 && value !== "\n" && value !== "\r"
    ? value
    : null;
}

/**
 * Delimiter the frequency table was written with: the first candidate whose
 * header record splits into exactly `field,value,count`. Falls back to
 * `preferredDelimiter` (then `,`) when nothing matches - e.g. output written
 * with `--no-headers`, where there is no header record to sniff.
 */
export function detectFrequencyDelimiter(
  output: string,
  preferredDelimiter?: string,
): string {
  const text = output.replace(/^\uFEFF/, "");
  const firstLine = text.split("\n")[0] ?? "";
  const preferred = singleCharDelimiter(preferredDelimiter);
  const candidates = [
    ...(preferred ? [preferred] : []),
    ...DELIMITER_CANDIDATES,
  ];

  for (const delimiter of new Set(candidates)) {
    const [header] = splitDelimitedRecords(firstLine, delimiter);
    if (header && isFrequencyHeader(header)) return delimiter;
  }

  return preferred ?? ",";
}

/**
 * Distinct column values from `xan frequency` stdout, in the order xan printed
 * them (most frequent first). Duplicates and the `<empty>` / `<rest>` sentinel
 * records are dropped.
 */
export function parseFrequencyValues(
  output: string,
  preferredDelimiter?: string,
): string[] {
  const text = output.replace(/^\uFEFF/, "");
  if (!text.trim()) return [];

  const delimiter = detectFrequencyDelimiter(text, preferredDelimiter);
  const records = splitDelimitedRecords(text, delimiter);
  if (records.length === 0) return [];

  // `--no-headers` output has no header record; the first record is data.
  const dataRecords = isFrequencyHeader(records[0])
    ? records.slice(1)
    : records;

  const values: string[] = [];
  const seen = new Set<string>();

  for (const cells of dataRecords) {
    if (cells.length === 0) continue;
    // `field,value,count`; a one-column table would mean xan changed shape, so
    // fall back to the first cell rather than dropping the record.
    const value = cells.length >= 2 ? cells[1] : cells[0];
    if (value === "" || EXTRA_VALUE_SENTINELS.has(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }

  return values;
}
