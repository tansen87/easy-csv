// One-off migrator for design 019 §4.6: split the 1,774-line
// `src/i18n/translations.ts` into `translations/{en,zh}/<domain>.ts` behind a
// barrel, so `@/i18n/translations` keeps resolving unchanged.
//
// Key structure is not changed — keys are only regrouped by the domain comments
// already present in the source. Two safety properties are asserted here:
//   * every domain comment maps to a file (no key can be silently dropped),
//   * a key appears exactly once per language (no silent spread collision).
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const src = path.resolve("src/i18n/translations.ts");
const outDir = path.resolve("src/i18n/translations");

/** domain comment -> domain file. Every group must be listed. */
const GROUP_DOMAIN = {
  "(none)": "common",
  HomeView: "common",
  "Floating panel docking": "common",
  CommandPalette: "common",
  ConfirmDialog: "common",
  UpdateDialog: "common",
  Plugins: "common",
  "Result preview (F1)": "common",
  HelpDialog: "help",

  MainMenu: "pipeline",
  "Variables (F3)": "pipeline",
  FlowPanel: "pipeline",
  ContextMenu: "pipeline",
  CommandList: "pipeline",
  VersionControl: "pipeline",
  "Execution history": "pipeline",
  "Pipeline Templates": "pipeline",
  LogPanel: "pipeline",

  ChartPanel: "canvas",
  DataProfile: "canvas",

  "SearchForm (009 S1 multi-pattern)": "dialog",
  CsvDiff: "dialog",
  CsvEncoding: "dialog",
  SeparateGoodBad: "dialog",
  BatchFilterDialog: "dialog",
  FilterDialog: "dialog",
  PivotDialog: "dialog",
  DateTransformDialog: "dialog",
  WindowDialog: "dialog",
  TextTransformDialog: "dialog",
  NumberTransformDialog: "dialog",
  SplitDialog: "dialog",
  PadDialog: "dialog",
  ReplaceDialog: "dialog",
  SortDialog: "dialog",

  AIPanel: "ai",
  "AI Settings": "ai",

  Settings: "settings",
};

const DOMAIN_ORDER = ["common", "pipeline", "canvas", "dialog", "ai", "settings", "help"];

const text = fs.readFileSync(src, "utf8");
const sf = ts.createSourceFile(src, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

const findDecl = (name) =>
  sf.statements
    .filter((s) => ts.isVariableStatement(s))
    .flatMap((s) => s.declarationList.declarations)
    .find((d) => d.name.getText(sf) === name);

const translationsDecl = findDecl("translations");
const langObjects = new Map();
for (const p of translationsDecl.initializer.properties) {
  langObjects.set(p.name.getText(sf), p.initializer);
}

/** @returns {{domain: string, key: string, text: string}[]} */
function collect(lang) {
  const obj = langObjects.get(lang);
  let group = "(none)";
  const out = [];
  for (const prop of obj.properties) {
    const lead = text.slice(prop.getFullStart(), prop.getStart(sf));
    const m = lead.match(/\/\/\s*([^\n\r]+)/);
    if (m) group = m[1].trim();
    const domain = GROUP_DOMAIN[group];
    if (!domain) {
      console.error(`Unmapped i18n group in ${lang}: "${group}"`);
      process.exit(1);
    }
    out.push({
      domain,
      group,
      key: prop.name.getText(sf).replace(/^["']|["']$/g, ""),
      text: prop.getText(sf),
    });
  }
  // duplicate guard
  const seen = new Map();
  for (const e of out) {
    if (seen.has(e.key)) {
      console.error(`Duplicate key in ${lang}: ${e.key}`);
      process.exit(1);
    }
    seen.set(e.key, true);
  }
  return out;
}

const collected = { zh: collect("zh"), en: collect("en") };
if (collected.zh.length !== collected.en.length) {
  console.error(`Key count mismatch: zh=${collected.zh.length} en=${collected.en.length}`);
  process.exit(1);
}

// --- types.ts: the shared type surface, re-exported by the barrel -----------
const iface = sf.statements.find(
  (s) => ts.isInterfaceDeclaration(s) && s.name.text === "Translations",
);
const typeAliases = sf.statements
  .filter((s) => ts.isTypeAliasDeclaration(s))
  .map((s) => s.getText(sf));

const typesFile = [
  "/**",
  " * Shared i18n type surface. Split out of the former single-file",
  " * `i18n/translations.ts` (design 019 §4.6).",
  " */",
  "",
  ...typeAliases,
  "",
  iface.getText(sf),
  "",
];

// --- emit ------------------------------------------------------------------
fs.rmSync(outDir, { recursive: true, force: true });

for (const lang of ["zh", "en"]) {
  const dir = path.join(outDir, lang);
  fs.mkdirSync(dir, { recursive: true });

  const byDomain = new Map(DOMAIN_ORDER.map((d) => [d, []]));
  for (const e of collected[lang]) byDomain.get(e.domain).push(e);

  const usedDomains = DOMAIN_ORDER.filter((d) => byDomain.get(d).length);

  for (const domain of usedDomains) {
    const entries = byDomain.get(domain);
    const groups = [...new Set(entries.map((e) => e.group))];
    const name = `${lang}${domain[0].toUpperCase()}${domain.slice(1)}`;
    const lines = [
      'import type { Translations } from "../types";',
      "",
      `/** ${groups.join(" · ")} */`,
      `export const ${name} = {`,
      ...entries.map((e) => "  " + e.text.replace(/;\s*$/, "") + ","),
      "} satisfies Partial<Translations>;",
      "",
    ];
    fs.writeFileSync(path.join(dir, `${domain}.ts`), lines.join("\n"), "utf8");
  }

  const barrels = [
    'import type { Translations } from "../types";',
    ...usedDomains.map(
      (d) =>
        `import { ${lang}${d[0].toUpperCase()}${d.slice(1)} } from "./${d}";`,
    ),
    "",
    `/**`,
    ` * Every ${lang} string, merged back into one flat object.`,
    ` *`,
    ` * Typed as \`Translations\`, so a key missing from any section is a compile`,
    ` * error. Keys are unique by construction — the split was generated from the`,
    ` * original single object and verified for duplicates.`,
    ` */`,
    `export const ${lang}: Translations = {`,
    ...usedDomains.map(
      (d) => `  ...${lang}${d[0].toUpperCase()}${d.slice(1)},`,
    ),
    "};",
    "",
  ];
  fs.writeFileSync(path.join(dir, "index.ts"), barrels.join("\n"), "utf8");
}

fs.writeFileSync(path.join(outDir, "types.ts"), typesFile.join("\n"), "utf8");

fs.writeFileSync(
  path.join(outDir, "index.ts"),
  [
    'import type { EffectiveLanguage, Translations } from "./types";',
    'import { en } from "./en";',
    'import { zh } from "./zh";',
    "",
    "export type { Language, EffectiveLanguage, Translations } from \"./types\";",
    "",
    "export const translations: Record<EffectiveLanguage, Translations> = {",
    "  en,",
    "  zh,",
    "};",
    "",
  ].join("\n"),
  "utf8",
);

fs.rmSync(src);

console.log(`split ${collected.zh.length} keys per language into ${DOMAIN_ORDER.length} domains`);
