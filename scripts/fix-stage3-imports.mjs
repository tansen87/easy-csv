// Follow-up to scripts/migrate-stage3.mjs: the first pass replaced *quoted*
// specifiers, which only fixed exact-import rules and silently skipped every
// prefix rule (`@/components/panel/nodes/...` etc.). This re-applies the same
// mapping against the bare specifier, which is idempotent.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

const specRewrites = [
  ["@/components/panel/VersionControlPanel", "@/modules/pipeline/panels/VersionControlPanel"],
  ["@/components/panel/DataLineagePanel", "@/modules/pipeline/panels/DataLineagePanel"],
  ["@/components/panel/LineageGraph", "@/modules/pipeline/panels/LineageGraph"],
  ["@/components/panel/CoordinateGrid", "@/modules/pipeline/CoordinateGrid"],
  ["@/components/panel/DataProfilePanel", "@/modules/data-preview/DataProfilePanel"],
  ["@/components/panel/ChartPanel", "@/modules/data-preview/charts/ChartPanel"],
  ["@/components/panel/VariablePanel", "@/modules/variables/VariablePanel"],
  ["@/components/panel/LogPanel", "@/modules/logs/LogPanel"],
  ["@/components/panel/AIPanel", "@/modules/ai/AIPanel"],
  ["@/components/panel/FlowPanel", "@/modules/pipeline/FlowPanel"],
  ["@/components/panel/hooks/", "@/modules/pipeline/hooks/"],
  ["@/components/panel/utils/", "@/modules/pipeline/lib/"],
  ["@/components/panel/overlays/", "@/modules/pipeline/overlays/"],
  ["@/components/panel/nodes/", "@/modules/pipeline/nodes/"],
  ["@/components/panel/nodes", "@/modules/pipeline/nodes"],
  ["@/components/panel/", "@/modules/pipeline/"],
  ["@/components/panel", "@/modules/pipeline"],
  ["@/components/HomeView", "@/modules/data-preview/HomeView"],
  ["@/components/CommandList", "@/modules/logs/CommandList"],
  ["@/components/CommandPalette", "@/modules/logs/CommandPalette"],
  ["@/components/ui/resize-handle", "@/components/ui/ResizeHandle"],
  ["@/components/ui/scroll-area", "@/components/ui/ScrollArea"],
  ["@/components/ui/textarea", "@/components/ui/Textarea"],
  ["@/components/ui/tooltip", "@/components/ui/Tooltip"],
  ["@/components/ui/select", "@/components/ui/Select"],
  ["@/components/ui/button", "@/components/ui/Button"],
  ["@/components/ui/input", "@/components/ui/Input"],
  ["@/components/ui/card", "@/components/ui/Card"],
  ["@/hooks/BatchFilterHooks", "@/hooks/useBatchFilter"],
  ["@/hooks/BatchConvertHooks", "@/hooks/useBatchConvert"],
  ["@/hooks/KeyboardShortcuts", "@/hooks/useKeyboardShortcuts"],
];

const identRenames = [
  [/\bBatchFilterHooks\b/g, "useBatchFilter"],
  [/\bBatchConvertHooks\b/g, "useBatchConvert"],
];

let touched = 0;
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) rewrite(p);
  }
}
function rewrite(file) {
  const before = fs.readFileSync(file, "utf8");
  let after = before;
  for (const [from, to] of specRewrites) after = after.split(from).join(to);
  for (const [re, to] of identRenames) after = after.replace(re, to);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    touched++;
  }
}
walk(SRC);
console.log(`rewrote ${touched} files`);
