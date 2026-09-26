// One-off migrator for design 019 §4.5: split the 4,188-line
// `src/data/commands.ts` into `src/data/commands/<category>.ts`.
//
// The aggregate export name and shape must not change — `commands.test.ts`
// imports `@/data/commands` and is required to stay untouched and green, which
// is the strongest correctness signal for this split.
//
// Command order inside `xanCommands` is user-visible (it drives the command
// list), so the script asserts every category forms one contiguous run in the
// original array and then concatenates the per-category arrays in that same
// order.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const src = path.resolve("src/data/commands.ts");
const outDir = path.resolve("src/data/commands");

const text = fs.readFileSync(src, "utf8");
const sf = ts.createSourceFile(src, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** category label -> file basename, per design 019 §4.5 */
const FILE_FOR_CATEGORY = {
  "Explore & visualize": "explore",
  "Search & filter": "searchFilter",
  "Sort & deduplicate": "sortDedup",
  Aggregate: "aggregate",
  "Combine multiple CSV files": "combine",
  "Add, transform, drop and move columns": "transform",
  "Format, convert & recombobulate": "format",
  "Transpose & pivot": "transposePivot",
  "Split a CSV file into multiple": "partition",
  "Generate CSV files": "generate",
  Scripting: "scripting",
  Output: "custom",
  "Batch method": "custom",
  Plugins: "plugins",
};

const arrayDecl = sf.statements.find(
  (s) =>
    ts.isVariableStatement(s) &&
    s.declarationList.declarations.some((d) => d.name.getText(sf) === "xanCommands"),
);
if (!arrayDecl) throw new Error("xanCommands not found");
const decl = arrayDecl.declarationList.declarations.find(
  (d) => d.name.getText(sf) === "xanCommands",
);
const elements = decl.initializer.elements;

/** @type {{id: string, category: string, text: string, line: number}[]} */
const commands = elements.map((el) => {
  const obj = el;
  const get = (key) => {
    const prop = obj.properties.find(
      (p) => ts.isPropertyAssignment(p) && p.name.getText(sf).replace(/"/g, "") === key,
    );
    return prop ? prop.initializer.getText(sf).replace(/^["']|["']$/g, "") : undefined;
  };
  return {
    id: get("id"),
    category: get("category"),
    text: text.slice(el.getFullStart(), el.end).replace(/^[\s\r\n]+/, "").replace(/\s+$/, ""),
    line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
  };
});

// --- assert categories are contiguous runs ---------------------------------
const runs = [];
for (const c of commands) {
  if (runs.length && runs[runs.length - 1].category === c.category) {
    runs[runs.length - 1].count++;
  } else {
    runs.push({ category: c.category, count: 1 });
  }
}
const runCategories = runs.map((r) => r.category);
if (new Set(runCategories).size !== runCategories.length) {
  console.error("Category is NOT a contiguous run — order would change. Runs:", runCategories);
  process.exit(1);
}

const unknown = commands.filter((c) => !FILE_FOR_CATEGORY[c.category]);
if (unknown.length) {
  console.error("Unmapped categories:", [...new Set(unknown.map((c) => c.category))]);
  process.exit(1);
}

// --- emit one file per category (custom.ts collects two categories) ---------
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

/** basename -> [command] */
const byFile = new Map();
for (const c of commands) {
  const file = FILE_FOR_CATEGORY[c.category];
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file).push(c);
}

const EXPORT_FOR_FILE = {};
for (const [file, list] of byFile) {
  const name = `${file}Commands`;
  EXPORT_FOR_FILE[file] = name;
  const body = [
    'import { XanCommand } from "@/types/xan";',
    "",
    `/** ${[...new Set(list.map((c) => c.category))].join(" + ")} (design 019 §4.5). */`,
    `export const ${name}: XanCommand[] = [`,
    ...list.map((c) => c.text + ","),
    "];",
    "",
  ];
  fs.writeFileSync(path.join(outDir, `${file}.ts`), body.join("\n"), "utf8");
}

// --- index.ts: same export names and order as before ------------------------
const categoriesDecl = sf.statements.find(
  (s) =>
    ts.isVariableStatement(s) &&
    s.declarationList.declarations.some((d) => d.name.getText(sf) === "commandCategories"),
);
const categoryList = categoriesDecl.declarationList.declarations
  .find((d) => d.name.getText(sf) === "commandCategories")
  .initializer.elements.map((e) => e.getText(sf));

const orderedFiles = [];
for (const c of commands) {
  const f = FILE_FOR_CATEGORY[c.category];
  if (!orderedFiles.includes(f)) orderedFiles.push(f);
}

const index = [
  'import { XanCommand } from "@/types/xan";',
  ...orderedFiles.map((f) => `import { ${EXPORT_FOR_FILE[f]} } from "./${f}";`),
  "",
  "/**",
  " * All xan commands, in the canonical order the command list renders them.",
  " *",
  " * Split out of the former 4,188-line `data/commands.ts` (design 019 §4.5);",
  " * this barrel keeps `@/data/commands` working unchanged — `commands.test.ts`",
  " * covers all 59 commands through it and is deliberately left untouched.",
  " */",
  "export const xanCommands: XanCommand[] = [",
  ...orderedFiles.map((f) => `  ...${EXPORT_FOR_FILE[f]},`),
  "];",
  "",
  "export const commandCategories = [",
  ...categoryList.map((c) => `  ${c},`),
  "];",
  "",
];
fs.writeFileSync(path.join(outDir, "index.ts"), index.join("\n"), "utf8");

fs.rmSync(src);

console.log(`split ${commands.length} commands into ${byFile.size} files: ${orderedFiles.join(", ")}`);
console.log(`categories preserved in order: ${runCategories.length} runs`);
