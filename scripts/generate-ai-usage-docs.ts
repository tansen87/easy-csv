import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { xanCommands } from "../src/data/commands";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, "..", "docs", "AI_usage");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const SKIP_PARAMS = new Set([
  "parallel",
  "threads",
  "external",
  "tmp-dir",
  "memory-limit",
  "compress",
  "unstable",
  "check",
  "sorted",
  "verbose",
  "approx",
  "fast-parser",
  "segments",
  "evaluate-file",
  "patterns",
  "pattern-column",
  "replacement-column",
  "name-column",
  "add-pattern",
  "breakdown",
  "unique-matches",
  "sep",
  "overlapping",
  "path-column",
  "preprocess",
  "shell-preprocess",
  "raw",
  "run",
  "dtype",
  "sample-size",
  "sort-keys",
  "key-column",
  "value-column",
  "single-object",
  "root",
  "model",
  "nth-table",
  "columns2",
  "sheet-index",
  "list-sheets",
  "zstd",
  "gzip",
  "vcf",
  "gtf",
  "gff",
  "sam",
  "bed",
  "cdx",
  "in-place",
  "inclusive",
  "byte-offset",
  "accumulate",
  "cursed",
  "skip-lines",
  "skip-until",
  "skip-while",
  "comment",
  "escape",
  "quote-never",
  "quote-always",
  "crlf",
  "ascii",
  "rainbow",
  "cols",
  "row-separator",
  "split",
  "highlight",
  "ignore-case",
  "condense",
  "wrap",
  "flatter",
  "hide-info",
  "expand",
  "theme",
  "x-ticks",
  "y-ticks",
  "x-min",
  "x-max",
  "y-min",
  "y-max",
  "x-scale",
  "y-scale",
  "density-gradient",
  "density-scale",
  "timezone",
  "square",
  "hide-legend",
  "hide-x-axis",
  "hide-y-axis",
  "hide-all",
  "grid",
  "marker",
  "small-multiples",
  "share-x-scale",
  "share-y-scale",
  "bar-size",
  "domain-max",
  "unit",
  "dates",
  "compress-gaps",
  "scale",
  "hide-percent",
  "category",
  "regression-line",
  "granularity",
  "aggregate",
  "time",
  "ignore",
  "levenstein",
  "levenshtein",
  "damerau-levenshtein",
  "url-prefix",
  "simplified-urls",
  "npy",
  "progress",
  "bins-heuristic",
  "prefix-length",
  "case-sensitive",
  "lines",
  "singularize",
  "pluralize",
  "cmp",
  "force",
  "slugify",
  "replace",
  "boolean",
  "left",
  "ties",
  "rank",
  "weight",
  "groupby-sorted",
  "output",
]);

const EXAMPLES: Record<string, string> = {
  search:
    'Filter rows where "city" column contains "Shanghai": search -s city Shanghai\nRows with id starting with "CN": search -s id -r \'^CN\'\nRows with id ending with "1": search -s id -r \'1$\'\nExact match, rows where idx equals 1001: search -s idx -e 1001',
  filter:
    'Filter rows with age > 30: filter \'age > 30\'\nFilter rows where name contains "Zhang" and score >= 90: filter \'name.contains("Zhang") && score >= 90\'',
  count: "Count ALL rows in the file: count",
  view: "View first 10 rows: view\nView first 50 rows: view -l 50",
  head: "View first 10 rows: head\nView first 20 rows: head -l 20",
  tail: "View last 10 rows: tail\nView last 20 rows: tail -l 20",
  sort: "Sort by age ascending: sort -s age\nSort by age descending (numeric): sort -s age -R -N",
  select: "Keep only name and age columns: select name,age",
  drop: "Drop the remark column: drop remark",
  map: 'Add column full_name = first_name + " " + last_name: map \'first_name ++ " " ++ last_name\'',
  transform: "Uppercase the price column: transform price 'price.uppercase()'",
  groupby: "Group by region, sum sales: groupby region 'sales.sum()'",
  agg: "Sum all sales: agg 'sales.sum()'",
  frequency: "Frequency table of name column values: frequency -s name",
  stats: "Compute stats of numeric columns: stats",
  rename: "Rename column a to b: rename a b",
  dedup: "Deduplicate on email column: dedup -s email",
  slice: "Take rows 5 to 15: slice -s 5 -e 15",
  fill: "Fill empty cells in col with 0: fill -s col -v 0",
  join:
    "Inner join two files on id: join id a.csv b.csv\nLeft join: join --left id a.csv b.csv",
  pivot:
    "Pivot product column into columns, grouped by category, value = sum of sales: pivot product 'sales.sum()' -g category",
  "batch-filter":
    "Split file into multiple files by city column values: batch-filter --column city",
  window: "Add rank column, ranked by score descending: window 'score.rank()'",
  sample: "Randomly sample 100 rows: sample 100",
  explode: "Explode tags column by | separator: explode tags",
  implode: "Implode consecutive rows by id, join tags with |: implode id",
  separate: "Split full_name into multiple columns by space: separate full_name ' '",
  headless: "Show column names: headers",
  to: "Convert to Excel: to xlsx",
  from: "Convert from Excel to CSV: from xlsx",
  range: "Generate numeric column 1 to 100: range 100",
  enum: "Add index column: enum",
  partition: "Partition file by region column values: partition region",
  transpose: "Transpose rows and columns: transpose",
  unpivot: "Stack v1,v2,v3 columns into key/value: unpivot v1,v2,v3",
  cat: "Concatenate files by rows: cat a.csv b.csv",
  merge: "Merge sorted files and sort: merge a.csv b.csv -s id",
  reverse: "Reverse row order: reverse",
  behead: "Drop the header row: behead",
  scrape: "Scrape web page with CSS selector: scrape -e '.title'",
};

const WARNINGS: Record<string, string> = {
  count:
    "Warning: count only counts ALL rows in the file, it has NO filtering capability. If the user asks to filter/search first and then count, output a two-step array [search or filter, count]. NEVER output count alone when the request contains filtering intent.",
};

xanCommands.forEach((cmd) => {
  const lines: string[] = [];
  lines.push(`# ${cmd.name}`);
  lines.push("");
  lines.push(`Purpose: ${cmd.description}`);
  lines.push("");

  const params = cmd.parameters.filter((p) => !SKIP_PARAMS.has(p.name));
  if (params.length > 0) {
    lines.push("Parameters:");
    params.forEach((p) => {
      const required = p.required ? " (required)" : "";
      const options = p.options?.length ? ` [${p.options.join("|")}]` : "";
      lines.push(`- ${p.name}: ${p.description}${options}${required}`);
    });
    lines.push("");
  }

  const example = EXAMPLES[cmd.name];
  if (example) {
    lines.push("Examples:");
    example.split("\n").forEach((e) => lines.push(`- ${e}`));
    lines.push("");
  }

  const warning = WARNINGS[cmd.name];
  if (warning) {
    lines.push(warning);
    lines.push("");
  }

  const content = lines.join("\n").trim() + "\n";
  fs.writeFileSync(path.join(outputDir, `${cmd.name}.md`), content, "utf-8");
});

console.log(`✓ Generated ${xanCommands.length} AI usage docs in docs/AI_usage/`);
