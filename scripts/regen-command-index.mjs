// Regenerates `src/components/dialog/commands/index.ts` so that COMMAND_FORMS
// imports each form from its own `forms/<command-id>.tsx` file (design 019 §3.4).
//
// The command-id -> form-name mapping is taken from the existing COMMAND_FORMS
// object, so the mapping itself is never re-derived by hand.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/components/dialog/commands");
const formsDir = path.join(root, "forms");

const indexText = fs.readFileSync(path.join(root, "index.ts"), "utf8");
const block = indexText.slice(
  indexText.indexOf("export const COMMAND_FORMS"),
  indexText.indexOf("};", indexText.indexOf("export const COMMAND_FORMS")),
);

/** [commandId, formName] in declaration order, grouped by the original comments. */
const entries = [];
const groups = [];
let current = { comment: null, items: [] };
for (const raw of block.split(/\r?\n/)) {
  const line = raw.trim();
  if (line.startsWith("//")) {
    if (current.items.length) groups.push(current);
    current = { comment: line, items: [] };
    continue;
  }
  const m = line.match(/^"?([A-Za-z-]+)"?:\s*([A-Za-z0-9_]+),$/);
  if (m) {
    entries.push([m[1], m[2]]);
    current.items.push([m[1], m[2]]);
  }
}
if (current.items.length) groups.push(current);

if (entries.length === 0) {
  console.error("could not parse COMMAND_FORMS");
  process.exit(1);
}

// exported form name per generated file
const exportsByFile = new Map();
for (const f of fs.readdirSync(formsDir)) {
  if (!f.endsWith(".tsx") || f.startsWith("_")) continue;
  const text = fs.readFileSync(path.join(formsDir, f), "utf8");
  const names = [...text.matchAll(/^export function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  exportsByFile.set(f.replace(/\.tsx$/, ""), names);
}

const lines = [
  "import { ComponentType } from \"react\";",
  "import type { CommandDialogType } from \"@/types/dialog\";",
  "import type { CommandFormProps } from \"@/types/dialog\";",
  "",
];

for (const f of [...exportsByFile.keys()].sort()) {
  const names = exportsByFile.get(f);
  if (!names.length) continue;
  lines.push(`import { ${names.join(", ")} } from "./forms/${f}";`);
}

lines.push("", "export const COMMAND_FORMS: Record<", "  CommandDialogType,", "  ComponentType<CommandFormProps>", "> = {");

for (const g of groups) {
  if (g.comment) lines.push(`  ${g.comment}`);
  for (const [id, form] of g.items) {
    const key = /^[A-Za-z][A-Za-z0-9]*$/.test(id) ? id : `"${id}"`;
    lines.push(`  ${key}: ${form},`);
  }
  lines.push("");
}
// drop the trailing blank line before the closing brace
while (lines[lines.length - 1] === "") lines.pop();
lines.push("};", "");
lines.push('export { getParameterDescription } from "@/components/dialog/commands/parameterDescriptions";');
lines.push('export { COMMAND_LABELS } from "@/types/dialog";');
lines.push('export type { CommandFormProps } from "@/types/dialog";');
lines.push("");

fs.writeFileSync(path.join(root, "index.ts"), lines.join("\n"), "utf8");
console.log(`regenerated index.ts with ${entries.length} command mappings`);
