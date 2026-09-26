// One-off migrator for design 019 §3.4: split the aggregated command form
// files (`FormatForms.tsx` 1351 lines / 11 forms, `ExploreForms.tsx` 7 forms,
// `SearchFilterForms.tsx` 8 forms, ...) into one file per command id.
//
// Mechanism: locate each `export function <Name>Form` with the TypeScript 6
// compiler API (the `typescript` package name resolves to
// @types/typescript6 here, since TS 7 ships no stable programmatic API),
// then emit it into `forms/<command-id>.tsx` with only the imports it uses.
//
// Mixed-declaration helpers (`Checkbox`, `TextField`, `PatternListInput`) go to
// `forms/_shared.tsx`.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/components/dialog/commands");
const formsDir = path.join(root, "forms");

// --- 1. command id -> form name, from COMMAND_FORMS in index.ts -------------
const indexText = fs.readFileSync(path.join(root, "index.ts"), "utf8");
const indexSf = ts.createSourceFile(
  "index.ts",
  indexText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);

/** formName -> commandId */
const formToCommand = new Map();
for (const st of indexSf.statements) {
  if (!ts.isVariableStatement(st)) continue;
  const decl = st.declarationList.declarations[0];
  if (!decl || decl.name.getText(indexSf) !== "COMMAND_FORMS") continue;
  const obj = decl.initializer;
  if (!obj || !ts.isObjectLiteralExpression(obj)) continue;
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = prop.name.getText(indexSf).replace(/^["']|["']$/g, "");
    const value = prop.initializer.getText(indexSf).trim();
    formToCommand.set(value, key);
  }
}

if (formToCommand.size === 0) {
  console.error("Could not read COMMAND_FORMS from index.ts");
  process.exit(1);
}

// --- helpers ---------------------------------------------------------------
/** Collapse an import declaration to a single-line, quote-normalised form. */
function normalizeImport(text) {
  return text.replace(/\s+/g, " ").replace(/;\s*$/, ";");
}

/** Every identifier-ish token inside a subtree (over-approximates on purpose). */
function collectIdentifiers(node, sf, out = new Set()) {
  if (ts.isIdentifier(node)) out.add(node.text);
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
    if (ts.isIdentifier(tag)) out.add(tag.text);
  }
  // NB: the callback MUST use a block body — `ts.forEachChild` stops walking as
  // soon as the callback returns a truthy value, and an expression-bodied arrow
  // would return the accumulator and cut the traversal short.
  ts.forEachChild(node, (c) => {
    collectIdentifiers(c, sf, out);
  });
  return out;
}

/** Local binding names introduced by an import declaration. */
function importBindings(stmt) {
  const names = [];
  const clause = stmt.importClause;
  if (!clause) return names;
  if (clause.name) names.push(clause.name.text);
  const nb = clause.namedBindings;
  if (nb) {
    if (ts.isNamespaceImport(nb)) names.push(nb.name.text);
    else for (const el of nb.elements) names.push((el.name ?? el.propertyName).text);
  }
  return names;
}

/**
 * Type declarations were sunk to `@/types/dialog` in §3.2. Importing them via
 * `CommandDialog` would re-form a `CommandDialog -> commands/index -> forms/*`
 * cycle, so those specifiers are rewritten on the way out.
 */
const SPECIFIER_REWRITES = {
  "@/components/dialog/CommandDialog": "@/types/dialog",
  "@/components/dialog/commands/types": "@/types/dialog",
};

/** Emit an import declaration, dropping named bindings that are unused. */
function emitImport(stmt, sf, used) {
  const clause = stmt.importClause;
  if (!clause) return normalizeImport(stmt.getText(sf));
  const moduleSpec = (() => {
    const raw = stmt.moduleSpecifier.getText(sf);
    return SPECIFIER_REWRITES[raw.replace(/^["']|["']$/g, "")]
      ? `"${SPECIFIER_REWRITES[raw.replace(/^["']|["']$/g, "")]}"`
      : raw;
  })();
  const isTypeOnly = Boolean(clause.isTypeOnly);

  const parts = [];
  if (clause.name) {
    if (!used.has(clause.name.text)) return null;
    parts.push(clause.name.text);
    if (clause.namedBindings) parts.push(", ");
  }
  const nb = clause.namedBindings;
  if (nb) {
    if (ts.isNamespaceImport(nb)) {
      if (!used.has(nb.name.text)) return null;
      parts.push(`* as ${nb.name.text}`);
    } else {
      const kept = nb.elements.filter((el) =>
        used.has((el.name ?? el.propertyName).text),
      );
      if (kept.length === 0) return null;
      const rendered = kept
        .map((el) => el.getText(sf))
        .join(", ");
      parts.push(`{ ${rendered} }`);
    }
  }
  if (parts.length === 0) return null;
  return `import ${isTypeOnly ? "type " : ""}${parts.join("")} from ${moduleSpec};`;
}

// --- 2. walk every aggregated form file ------------------------------------
const aggFiles = fs
  .readdirSync(root)
  .filter((f) => f.endsWith("Forms.tsx"))
  .sort();

fs.mkdirSync(formsDir, { recursive: true });

/** name -> emitted code for shared, non-exported helpers */
const sharedChunks = [];
const sharedUsedNames = new Set();
let sharedImports = null;

const written = new Map(); // commandId -> file
const unmapped = [];

// --- pass 1: parse every aggregated file ------------------------------------
const parsed = []; // { file, sf, importStmts, forms[], shared[] }

for (const file of aggFiles) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, "utf8");
  const sf = ts.createSourceFile(full, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const importStmts = [];
  const forms = [];
  const shared = [];

  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) importStmts.push(st);
    else if (ts.isFunctionDeclaration(st) && st.name) {
      const mods = st.modifiers?.map((m) => m.getText(sf)).join(" ") ?? "";
      const entry = { name: st.name.text, node: st };
      if (mods.includes("export") && st.name.text.endsWith("Form")) forms.push(entry);
      else shared.push(entry);
    } else if (
      ts.isVariableStatement(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isEnumDeclaration(st)
    ) {
      shared.push({ name: null, node: st });
    }
  }

  parsed.push({ file, sf, importStmts, forms, shared });
}

// Collect every module-scope helper used by any form, before emitting anything —
// `SearchFilterForms.tsx` declares `Checkbox` / `TextField` / `PatternListInput`
// *below* the forms that use them, so a single pass would miss them.
for (const p of parsed) {
  for (const s of p.shared) {
    if (!s.name) continue;
    const lead = p.sf.text
      .slice(s.node.getFullStart(), s.node.getStart(p.sf))
      .replace(/^[ \t\r\n]+/, "");
    const decl = p.sf.text.slice(s.node.getStart(p.sf), s.node.end);
    sharedChunks.push({
      name: s.name,
      // Forms live in sibling modules now, so the helper must be exported.
      // Insert the keyword at the declaration itself rather than anchoring on
      // the start of the slice — the helper may be preceded by a comment.
      text: lead + decl.replace(/^function(\s)/, "export function$1"),
      sf: p.sf,
      importStmts: p.importStmts,
      node: s.node,
    });
  }
}

// --- pass 2: emit one file per command id -----------------------------------
for (const p of parsed) {
  const { sf, importStmts } = p;
  if (importStmts.length && sharedImports === null) sharedImports = { sf, importStmts };

  for (const d of p.forms) {
    const commandId = formToCommand.get(d.name);
    if (!commandId) {
      unmapped.push(`${p.file}:${d.name}`);
      continue;
    }

    // getFullStart() keeps the JSDoc/line comments sitting directly above the
    // function; getText() would silently drop them.
    const body = sf.text
      .slice(d.node.getFullStart(), d.node.end)
      .replace(/^[ \t\r\n]+/, "");
    const used = collectIdentifiers(d.node, sf);
    // The signature references CommandFormProps.
    const imports = importStmts.map((s) => emitImport(s, sf, used)).filter(Boolean);

    // Pull in shared helpers referenced by this form.
    const needsShared = sharedChunks
      .filter((c) => used.has(c.name))
      .map((c) => c.name);
    for (const n of needsShared) sharedUsedNames.add(n);

    const lines = [];
    if (needsShared.length) {
      lines.push(`import { ${needsShared.join(", ")} } from "./_shared";`);
    }
    lines.push(...imports);
    lines.push("");
    lines.push(body);
    lines.push("");

    fs.writeFileSync(path.join(formsDir, `${commandId}.tsx`), lines.join("\n"), "utf8");
    written.set(commandId, `${commandId}.tsx`);
  }
}

// --- pass 3: shared helpers -------------------------------------------------
if (sharedUsedNames.size) {
  const included = sharedChunks.filter((c) => sharedUsedNames.has(c.name));
  // The helpers' own bodies decide which imports they need.
  const used = new Set();
  for (const c of included) collectIdentifiers(c.node, c.sf, used);
  const src = included[0];
  const lines = src.importStmts.map((s) => emitImport(s, src.sf, used)).filter(Boolean);
  lines.push("");
  for (const c of included) lines.push(c.text, "");
  fs.writeFileSync(path.join(formsDir, "_shared.tsx"), lines.join("\n"), "utf8");
}

console.log(`wrote ${written.size} form files`);
if (unmapped.length) console.log(`UNMAPPED: ${unmapped.join(", ")}`);
console.log(`shared: ${[...sharedUsedNames].join(", ") || "(none)"}`);
