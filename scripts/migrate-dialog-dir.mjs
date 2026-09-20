// One-off migrator for design 019 §3.3 / §3.5 / §2.1:
//   src/components/dialog/**  ->  src/modules/dialogs/{command,file,app,common}/**
//   commands/CommandFormWrapper.tsx -> command/CommandFormShell.tsx
//   commands/VariableHint.tsx       -> components/ui/VariableHint.tsx
//
// Pure moves + import rewriting — no behaviour changes. Every rewritten
// specifier is also validated afterwards by `tsc --noEmit`.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const OLD = path.join(SRC, "components/dialog");
const NEW = path.join(SRC, "modules/dialogs");

// The 11 legacy floating dialogs. §3.1 turns them into thin triggers and §1.7
// deletes them; until that lands they live under `command/legacy/` so the
// "command parameter configuration" grouping stays honest.
const LEGACY = [
  "FilterDialog",
  "BatchFilterDialog",
  "SplitDialog",
  "PivotDialog",
  "WindowDialog",
  "TextTransformDialog",
  "NumberTransformDialog",
  "ReplaceDialog",
  "SortDialog",
  "DateTransformDialog",
  "PadDialog",
];

/** [from (relative to OLD), to (relative to NEW)] — files */
const fileMoves = [
  ["CommandDialog.tsx", "command/CommandDialog.tsx"],
  ["commands/CommandFormWrapper.tsx", "command/CommandFormShell.tsx"],
  ["commands/helpers.ts", "command/lib/helpers.ts"],
  ["commands/parameterDescriptions.ts", "command/lib/parameterDescriptions.ts"],
  ["commands/index.ts", "command/index.ts"],

  ["SeparateCSVDialog.tsx", "file/SeparateCSVDialog.tsx"],
  ["CsvDiffDialog.tsx", "file/CsvDiffDialog.tsx"],
  ["CsvEncodingDialog.tsx", "file/CsvEncodingDialog.tsx"],
  ["PipelineTemplateDialog.tsx", "file/PipelineTemplateDialog.tsx"],

  ["ExecutionHistoryDialog.tsx", "app/ExecutionHistoryDialog.tsx"],
  ["UpdateDialog.tsx", "app/UpdateDialog.tsx"],

  ["ConfirmDialog.tsx", "common/ConfirmDialog.tsx"],
  ["VariableValuesDialog.tsx", "common/VariableValuesDialog.tsx"],

  ...LEGACY.map((n) => [`${n}.tsx`, `command/legacy/${n}.tsx`]),
];

/** [old module specifier, new module specifier] — longest first */
const specRewrites = [
  // forms sub-tree (directory move only)
  ["@/components/dialog/commands/forms/", "@/modules/dialogs/command/forms/"],
  ["@/components/dialog/commands/CommandFormWrapper", "@/modules/dialogs/command/CommandFormShell"],
  ["@/components/dialog/commands/helpers", "@/modules/dialogs/command/lib/helpers"],
  ["@/components/dialog/commands/parameterDescriptions", "@/modules/dialogs/command/lib/parameterDescriptions"],
  ["@/components/dialog/commands/VariableHint", "@/components/ui/VariableHint"],
  ["@/components/dialog/commands/types", "@/types/dialog"],
  ["@/components/dialog/commands", "@/modules/dialogs/command"],
  ["@/components/dialog/CommandDialog", "@/modules/dialogs/command/CommandDialog"],
  ["@/components/dialog/SeparateCSVDialog", "@/modules/dialogs/file/SeparateCSVDialog"],
  ["@/components/dialog/CsvDiffDialog", "@/modules/dialogs/file/CsvDiffDialog"],
  ["@/components/dialog/CsvEncodingDialog", "@/modules/dialogs/file/CsvEncodingDialog"],
  ["@/components/dialog/PipelineTemplateDialog", "@/modules/dialogs/file/PipelineTemplateDialog"],
  ["@/components/dialog/ExecutionHistoryDialog", "@/modules/dialogs/app/ExecutionHistoryDialog"],
  ["@/components/dialog/UpdateDialog", "@/modules/dialogs/app/UpdateDialog"],
  ["@/components/dialog/ConfirmDialog", "@/modules/dialogs/common/ConfirmDialog"],
  ["@/components/dialog/VariableValuesDialog", "@/modules/dialogs/common/VariableValuesDialog"],
  ...LEGACY.map((n) => [
    `@/components/dialog/${n}`,
    `@/modules/dialogs/command/legacy/${n}`,
  ]),
];

// --- 1. move files ---------------------------------------------------------
for (const [from, to] of fileMoves) {
  const src = path.join(OLD, from);
  const dst = path.join(NEW, to);
  if (!fs.existsSync(src)) {
    console.error(`MISSING source: ${from}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
}

// forms/ moves wholesale
const formsFrom = path.join(OLD, "commands/forms");
const formsTo = path.join(NEW, "command/forms");
fs.mkdirSync(path.dirname(formsTo), { recursive: true });
fs.renameSync(formsFrom, formsTo);

// VariableHint belongs with the generic UI atoms (§3.3).
fs.renameSync(
  path.join(OLD, "commands/VariableHint.tsx"),
  path.join(SRC, "components/ui/VariableHint.tsx"),
);

// `commands/types.ts` is now a bare re-export barrel with no importers left —
// everything points at `@/types/dialog` directly.
fs.rmSync(path.join(OLD, "commands/types.ts"));

// --- 2. rewrite import specifiers + the shell's identifier ------------------
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) rewrite(p);
  }
}

let touched = 0;
function rewrite(file) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [from, to] of specRewrites) {
    after = after.split(`"${from}"`).join(`"${to}"`);
  }
  // File + identifier rename of the shared form shell.
  after = after.replace(/\bCommandFormWrapperProps\b/g, "CommandFormShellProps");
  after = after.replace(/\bCommandFormWrapper\b/g, "CommandFormShell");
  // Relative sibling imports inside the moved command module.
  if (file.startsWith(path.join(NEW, "command"))) {
    after = after
      .split('"./helpers"').join('"./lib/helpers"')
      .split('"./parameterDescriptions"').join('"./lib/parameterDescriptions"');
  }
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    touched++;
  }
}

walk(SRC);

// --- 3. drop the now-empty old tree ----------------------------------------
function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) prune(path.join(dir, e.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
prune(OLD);

console.log(`moved ${fileMoves.length + 1} files, rewrote ${touched} files`);
console.log(`old dialog dir still present: ${fs.existsSync(OLD)}`);
