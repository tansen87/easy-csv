// One-off migrator for design 019 stage 3.1–3.4:
//   3.1/3.2  components/panel/** + the three bare components -> modules/**
//   3.3      ui/ lowercase files -> PascalCase
//   3.4      hooks/ files -> useXxx (+ matching export names)
//
// MainMenuHooks is deliberately NOT renamed here: §4.2 replaces it with
// hooks/execution/*, so renaming it first would be throwaway work.
//
// Note: ui/ renames are case-only (`button.tsx` -> `Button.tsx`), which a
// case-insensitive filesystem ignores — hence the two-step rename via a temp
// name.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");

/** [from (relative to src), to (relative to src)] */
const moves = [
  ["components/HomeView.tsx", "modules/data-preview/HomeView.tsx"],
  ["components/CommandList.tsx", "modules/logs/CommandList.tsx"],
  ["components/CommandPalette.tsx", "modules/logs/CommandPalette.tsx"],

  ["components/panel/FlowPanel.tsx", "modules/pipeline/FlowPanel.tsx"],
  ["components/panel/CoordinateGrid.tsx", "modules/pipeline/CoordinateGrid.tsx"],
  ["components/panel/nodes/PipelineStepNode.tsx", "modules/pipeline/nodes/PipelineStepNode.tsx"],
  ["components/panel/nodes/ResultTableNode.tsx", "modules/pipeline/nodes/ResultTableNode.tsx"],
  ["components/panel/nodes/TableNode.tsx", "modules/pipeline/nodes/TableNode.tsx"],
  ["components/panel/nodes/index.ts", "modules/pipeline/nodes/index.ts"],
  ["components/panel/overlays/ConnectionVisualization.tsx", "modules/pipeline/overlays/ConnectionVisualization.tsx"],
  ["components/panel/overlays/CutVisualization.tsx", "modules/pipeline/overlays/CutVisualization.tsx"],
  ["components/panel/overlays/KeyIndicatorOverlay.tsx", "modules/pipeline/overlays/KeyIndicatorOverlay.tsx"],
  ["components/panel/overlays/SearchOverlay.tsx", "modules/pipeline/overlays/SearchOverlay.tsx"],
  ["components/panel/hooks/useCanvasKeyboardPan.ts", "modules/pipeline/hooks/useCanvasKeyboardPan.ts"],
  ["components/panel/hooks/useCanvasPointerHud.ts", "modules/pipeline/hooks/useCanvasPointerHud.ts"],
  ["components/panel/utils/layout.ts", "modules/pipeline/lib/layout.ts"],
  ["components/panel/utils/cutGeometry.ts", "modules/pipeline/lib/cutGeometry.ts"],
  ["components/panel/VersionControlPanel.tsx", "modules/pipeline/panels/VersionControlPanel.tsx"],
  ["components/panel/DataLineagePanel.tsx", "modules/pipeline/panels/DataLineagePanel.tsx"],
  ["components/panel/LineageGraph.tsx", "modules/pipeline/panels/LineageGraph.tsx"],

  ["components/panel/ChartPanel.tsx", "modules/data-preview/charts/ChartPanel.tsx"],
  ["components/panel/DataProfilePanel.tsx", "modules/data-preview/DataProfilePanel.tsx"],
  ["components/panel/AIPanel.tsx", "modules/ai/AIPanel.tsx"],
  ["components/panel/VariablePanel.tsx", "modules/variables/VariablePanel.tsx"],
  ["components/panel/LogPanel.tsx", "modules/logs/LogPanel.tsx"],
];

/** [old module specifier, new module specifier] — longest first */
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
  ["@/components/panel/", "@/modules/pipeline/"],
  ["@/components/HomeView", "@/modules/data-preview/HomeView"],
  ["@/components/CommandList", "@/modules/logs/CommandList"],
  ["@/components/CommandPalette", "@/modules/logs/CommandPalette"],

  // 3.3 — ui/ atoms move to PascalCase with the files
  ["@/components/ui/resize-handle", "@/components/ui/ResizeHandle"],
  ["@/components/ui/scroll-area", "@/components/ui/ScrollArea"],
  ["@/components/ui/textarea", "@/components/ui/Textarea"],
  ["@/components/ui/tooltip", "@/components/ui/Tooltip"],
  ["@/components/ui/select", "@/components/ui/Select"],
  ["@/components/ui/button", "@/components/ui/Button"],
  ["@/components/ui/input", "@/components/ui/Input"],
  ["@/components/ui/card", "@/components/ui/Card"],

  // 3.4 — hooks/ file renames
  ["@/hooks/BatchFilterHooks", "@/hooks/useBatchFilter"],
  ["@/hooks/BatchConvertHooks", "@/hooks/useBatchConvert"],
  ["@/hooks/KeyboardShortcuts", "@/hooks/useKeyboardShortcuts"],
];

/** identifier renames that go with the hook file renames (§5.1) */
const identRenames = [
  [/\bBatchFilterHooks\b/g, "useBatchFilter"],
  [/\bBatchConvertHooks\b/g, "useBatchConvert"],
];

// --- 1. move files ---------------------------------------------------------
for (const [from, to] of moves) {
  const a = path.join(SRC, from);
  const b = path.join(SRC, to);
  if (!fs.existsSync(a)) {
    console.error(`MISSING: ${from}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.renameSync(a, b);
}

// --- 2. rename ui/ atoms to PascalCase -------------------------------------
const uiRenames = [
  ["button.tsx", "Button.tsx"],
  ["card.tsx", "Card.tsx"],
  ["input.tsx", "Input.tsx"],
  ["resize-handle.tsx", "ResizeHandle.tsx"],
  ["scroll-area.tsx", "ScrollArea.tsx"],
  ["select.tsx", "Select.tsx"],
  ["textarea.tsx", "Textarea.tsx"],
  ["tooltip.tsx", "Tooltip.tsx"],
];
for (const [from, to] of uiRenames) {
  const a = path.join(SRC, "components/ui", from);
  const b = path.join(SRC, "components/ui", to);
  if (!fs.existsSync(a)) {
    console.error(`MISSING ui atom: ${from}`);
    process.exit(1);
  }
  if (a === b) continue;
  const tmp = a + ".case-tmp";
  fs.renameSync(a, tmp);
  fs.renameSync(tmp, b);
}

// --- 3. rename hook files --------------------------------------------------
const hookRenames = [
  ["BatchFilterHooks.ts", "useBatchFilter.ts"],
  ["BatchConvertHooks.ts", "useBatchConvert.ts"],
  ["KeyboardShortcuts.ts", "useKeyboardShortcuts.ts"],
];
for (const [from, to] of hookRenames) {
  fs.renameSync(path.join(SRC, "hooks", from), path.join(SRC, "hooks", to));
}

// --- 4. rewrite import specifiers + hook identifiers -----------------------
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
  for (const [from, to] of specRewrites) {
    after = after.split(`"${from}"`).join(`"${to}"`);
  }
  for (const [re, to] of identRenames) after = after.replace(re, to);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    touched++;
  }
}
walk(SRC);

// --- 5. prune now-empty dirs ----------------------------------------------
function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) prune(path.join(dir, e.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
prune(path.join(SRC, "components/panel"));
prune(path.join(SRC, "components"));

console.log(`moved ${moves.length} files, renamed ${uiRenames.length + hookRenames.length}, rewrote ${touched} files`);
console.log(`components/panel still present: ${fs.existsSync(path.join(SRC, "components/panel"))}`);
console.log(`components still present: ${fs.existsSync(path.join(SRC, "components"))}`);
