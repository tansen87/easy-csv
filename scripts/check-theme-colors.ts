// Design 034 §5.3 (phase F): keep raw Tailwind palette classes out of the app.
//
// Colours must come from tokens (`success` / `warning` / `danger` / `info` /
// `brand`) or the dedicated chart / syntax palettes. Raw `green-*`, `blue-*`,
// `slate-*`… reintroduce the drift this migration removed.
//
// Usage: `pnpm check:theme-colors`
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = resolve(ROOT, "src");

/** A Tailwind palette utility, e.g. `text-green-600`, `bg-amber-500/10`. */
const RAW_COLOR =
  /(?:text|bg|border|ring|from|to|via|fill|stroke|shadow|decoration|outline|divide|placeholder|caret|accent)-(?:green|emerald|amber|yellow|orange|blue|indigo|sky|cyan|red|rose|teal|violet|purple|fuchsia|slate|gray|zinc|neutral|stone)-[0-9]+(?:\/[0-9]+)?/;

/**
 * Known exceptions. Both are data-type palettes (design 034 §3.4): they keep
 * several distinguishable hues per type and will move to `--type-*` tokens in
 * the remaining D follow-up. Matching the declaration line keeps the waiver
 * narrow instead of exempting the whole file.
 */
const ALLOWED: { file: string; line: RegExp; reason: string }[] = [
  {
    file: "modules/data-preview/DataProfilePanel.tsx",
    line: /^\s*(Float|Integer|Text|Mixed|Empty): \{ bg: "/,
    reason: "data-type palette (pending --type-* tokens)",
  },
  {
    file: "modules/pipeline/panels/DataLineagePanel.tsx",
    line: /^\s*(string|number|date|boolean): "/,
    reason: "data-type palette (pending --type-* tokens)",
  },
];

function collect(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return collect(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const files = collect(SRC);
const failures: { file: string; line: number; classes: string[] }[] = [];
let allowed = 0;

for (const file of files) {
  const rel = relative(SRC, file).split(sep).join("/");
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((text, index) => {
    if (!RAW_COLOR.test(text)) return;
    const waiver = ALLOWED.find(
      (item) => item.file === rel && item.line.test(text),
    );
    if (waiver) {
      allowed += 1;
      return;
    }
    failures.push({
      file: rel,
      line: index + 1,
      classes: text.match(new RegExp(RAW_COLOR.source, "g")) ?? [],
    });
  });
}

if (failures.length > 0) {
  console.error(
    `\ncheck:theme-colors — ${failures.length} raw palette class occurrence(s):\n`,
  );
  for (const failure of failures) {
    console.error(
      `  src/${failure.file}:${failure.line}  ${failure.classes.join(", ")}`,
    );
  }
  console.error(
    "\nUse success / warning / danger / info / brand tokens, or the chart / " +
      "syntax palettes (design 034). Add a narrow waiver only for typed " +
      "palettes that still need --type-* tokens.\n",
  );
  process.exit(1);
}

console.log(
  `check:theme-colors OK — no raw palette classes in src ` +
    `(${files.length} files scanned, ${allowed} allowlisted type-palette line(s)).`,
);
