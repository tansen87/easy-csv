// Design 019 §6 stage 4.3 (and 005 F2): verify that every file path INDEX.md
// registers actually exists.
//
// The index is the map AI-assisted development navigates by, so a stale path is
// worse than a missing entry. Line counts are deliberately NOT checked here —
// they drift on every edit (see 019 §4.4); only existence is asserted.
//
// Usage: `pnpm check:index`
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const INDEX = resolve(ROOT, "docs/AI/INDEX.md");

const text = readFileSync(INDEX, "utf8")
  // Fenced blocks (the ASCII architecture diagram, code samples) are prose, not
  // path registrations — and a naive backtick regex would span across their
  // fences, so drop them before scanning.
  .replace(/```[\s\S]*?```/g, "");

const PREFIXES = ["src/", "src-tauri/", "docs/", "plugins/", "scripts/"];

/** Backtick spans that look like concrete repo paths. */
const candidates = new Set();
for (const m of text.matchAll(/`([^`\n]+)`/g)) {
  const raw = m[1].trim();
  if (!PREFIXES.some((p) => raw.startsWith(p))) continue;
  // Templates and globs are not checkable.
  if (/[*<>{}|]/.test(raw)) continue;
  // Multi-path cells like `a` + `b` never make it here (backticks are single).
  candidates.add(raw);
}

const missing = [];
for (const raw of [...candidates].sort()) {
  // Strip a trailing slash: `src/modules/pipeline/` registers a directory.
  const clean = raw.replace(/\/+$/, "");
  if (existsSync(resolve(ROOT, clean))) continue;
  missing.push(raw);
}

if (missing.length) {
  console.error(`\n${missing.length} path(s) in docs/AI/INDEX.md do not exist:\n`);
  for (const m of missing) console.error(`  - ${m}`);
  console.error(
    `\nUpdate docs/AI/INDEX.md (or create the file). Relative to ${relative(ROOT, ".") || "."}`,
  );
  process.exit(1);
}

console.log(`check:index OK — ${candidates.size} paths in docs/AI/INDEX.md all exist.`);
